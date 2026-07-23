import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RateLimitService } from '../../common/security/rate-limit.service';
import {
  CreateOrganizationIntakeDto,
  ORGANIZATION_INTAKE_CONSENT_VERSION,
  OrganizationIntakeResponse,
} from './organization-intake.dto';

type NormalizedRequest = Readonly<{
  organizationName: string;
  inn: string;
  contactName: string;
  position: string;
  phone: string;
  email: string;
  organizationRole: string;
  scenario: string;
  locale: string;
  consentVersion: string;
}>;

type AuthorityRow = {
  request_number: string;
  request_status: string;
  replay: boolean;
  correlation_id: string;
};

type CreateContext = Readonly<{
  idempotencyKey: string;
  correlationId: string;
  sourceIp: string;
}>;

const IDEMPOTENCY_PATTERN = /^[A-Za-z0-9._:-]{16,128}$/;
const CORRELATION_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;
const MAX_TRANSACTION_ATTEMPTS = 3;

function cleanText(value: string): string {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

function normalizePhone(value: string): string {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) throw new BadRequestException('INVALID_PHONE');
  if (digits.length === 11 && digits.startsWith('8')) return `+7${digits.slice(1)}`;
  if (digits.length === 10) return `+7${digits}`;
  return `+${digits}`;
}

function canonicalHash(value: NormalizedRequest): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function databaseMessage(error: unknown): string {
  return String((error as { message?: unknown })?.message ?? error ?? '');
}

function isIdempotencyConflict(error: unknown): boolean {
  return databaseMessage(error).includes('IDEMPOTENCY_PAYLOAD_MISMATCH');
}

function isRetryableTransactionError(error: unknown): boolean {
  const code = String((error as { code?: unknown })?.code ?? '');
  const message = databaseMessage(error);
  return code === 'P2034' || code === '40001' || code === '40P01'
    || message.includes('could not serialize access')
    || message.includes('deadlock detected');
}

@Injectable()
export class OrganizationIntakeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rateLimit: RateLimitService,
  ) {}

  async create(dto: CreateOrganizationIntakeDto, context: CreateContext): Promise<OrganizationIntakeResponse> {
    const idempotencyKey = String(context.idempotencyKey ?? '').trim();
    if (!IDEMPOTENCY_PATTERN.test(idempotencyKey)) {
      throw new BadRequestException('INVALID_IDEMPOTENCY_KEY');
    }
    if (String(dto.website ?? '').trim()) throw new BadRequestException('INVALID_REQUEST');

    const sourceIp = String(context.sourceIp ?? '').trim();
    if (!sourceIp) throw new ServiceUnavailableException('REQUEST_SOURCE_UNAVAILABLE');
    const correlationId = CORRELATION_PATTERN.test(String(context.correlationId ?? '').trim())
      ? String(context.correlationId).trim()
      : randomUUID();
    const request = this.normalize(dto);
    const payloadHash = canonicalHash(request);

    const replay = await this.lookup(idempotencyKey, payloadHash);
    if (replay) return replay;

    const ipDecision = await this.rateLimit.consume('public_org_connect_ip', sourceIp, 5, 15 * 60);
    if (!ipDecision.allowed) {
      throw new HttpException('PUBLIC_INTAKE_RATE_LIMITED', HttpStatus.TOO_MANY_REQUESTS);
    }
    const emailDecision = await this.rateLimit.consume('public_org_connect_email', request.email, 3, 24 * 60 * 60);
    if (!emailDecision.allowed) {
      throw new HttpException('PUBLIC_INTAKE_RATE_LIMITED', HttpStatus.TOO_MANY_REQUESTS);
    }

    for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
      try {
        return await this.createThroughAuthority(request, payloadHash, idempotencyKey, correlationId);
      } catch (error) {
        if (isIdempotencyConflict(error)) throw new ConflictException('IDEMPOTENCY_PAYLOAD_MISMATCH');
        if (attempt < MAX_TRANSACTION_ATTEMPTS && isRetryableTransactionError(error)) continue;
        const concurrent = await this.lookup(idempotencyKey, payloadHash).catch((lookupError) => {
          if (lookupError instanceof ConflictException) throw lookupError;
          return null;
        });
        if (concurrent) return concurrent;
        throw new ServiceUnavailableException('PUBLIC_INTAKE_TRANSACTION_UNAVAILABLE');
      }
    }

    throw new ServiceUnavailableException('PUBLIC_INTAKE_TRANSACTION_UNAVAILABLE');
  }

  private normalize(dto: CreateOrganizationIntakeDto): NormalizedRequest {
    return {
      organizationName: cleanText(dto.organizationName),
      inn: String(dto.inn ?? '').replace(/\D/g, ''),
      contactName: cleanText(dto.contactName),
      position: cleanText(dto.position),
      phone: normalizePhone(dto.phone),
      email: String(dto.email ?? '').trim().toLowerCase(),
      organizationRole: dto.organizationRole,
      scenario: dto.scenario,
      locale: dto.locale,
      consentVersion: ORGANIZATION_INTAKE_CONSENT_VERSION,
    };
  }

  private async lookup(idempotencyKey: string, payloadHash: string): Promise<OrganizationIntakeResponse | null> {
    try {
      const rows = await this.prisma.$queryRaw<AuthorityRow[]>(Prisma.sql`
        SELECT request_number, request_status, replay, correlation_id
        FROM public.lookup_public_organization_connection_request(${idempotencyKey}, ${payloadHash})
      `);
      return rows[0] ? this.result(rows[0]) : null;
    } catch (error) {
      if (isIdempotencyConflict(error)) throw new ConflictException('IDEMPOTENCY_PAYLOAD_MISMATCH');
      throw error;
    }
  }

  private async createThroughAuthority(
    request: NormalizedRequest,
    payloadHash: string,
    idempotencyKey: string,
    correlationId: string,
  ): Promise<OrganizationIntakeResponse> {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<AuthorityRow[]>(Prisma.sql`
        SELECT request_number, request_status, replay, correlation_id
        FROM public.create_public_organization_connection_request(
          ${request.organizationName},
          ${request.inn},
          ${request.contactName},
          ${request.position},
          ${request.phone},
          ${request.email},
          ${request.organizationRole},
          ${request.scenario},
          ${request.locale},
          ${request.consentVersion},
          ${payloadHash},
          ${idempotencyKey},
          ${correlationId}
        )
      `);
      if (!rows[0]) throw new Error('PUBLIC_INTAKE_AUTHORITY_RETURNED_NO_ROW');
      return this.result(rows[0]);
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 5_000,
      timeout: 10_000,
    });
  }

  private result(row: AuthorityRow): OrganizationIntakeResponse {
    return {
      requestNumber: row.request_number,
      status: row.request_status,
      replay: Boolean(row.replay),
      correlationId: row.correlation_id,
    };
  }
}
