import {
  ConflictException,
  Injectable,
  ServiceUnavailableException,
  TooManyRequestsException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
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

type ExistingRequestRow = {
  id: string;
  request_number: string;
  status: string;
  payload_hash: string;
};

type CreateContext = Readonly<{
  idempotencyKey: string;
  correlationId: string;
  sourceIp: string;
}>;

const IDEMPOTENCY_PATTERN = /^[A-Za-z0-9._:-]{16,128}$/;
const CORRELATION_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;
const MAX_TRANSACTION_ATTEMPTS = 3;
const RETENTION_DAYS = 180;

function cleanText(value: string): string {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

function normalizePhone(value: string): string {
  const raw = String(value ?? '').trim();
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) throw new ConflictException('INVALID_PHONE');
  if (digits.length === 11 && digits.startsWith('8')) return `+7${digits.slice(1)}`;
  if (digits.length === 10) return `+7${digits}`;
  return `+${digits}`;
}

function canonicalHash(value: NormalizedRequest): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function publicEventPayload(params: {
  requestId: string;
  requestNumber: string;
  payloadHash: string;
  request: NormalizedRequest;
  createdAt: Date;
}) {
  return {
    requestId: params.requestId,
    requestNumber: params.requestNumber,
    status: 'NEW',
    source: 'PUBLIC_PLATFORM_V7',
    locale: params.request.locale,
    organizationRole: params.request.organizationRole,
    scenario: params.request.scenario,
    payloadHash: params.payloadHash,
    consentVersion: params.request.consentVersion,
    createdAt: params.createdAt.toISOString(),
  };
}

function isRetryableTransactionError(error: unknown): boolean {
  const code = String((error as { code?: unknown })?.code ?? '');
  return code === 'P2034' || code === '40001' || code === '40P01';
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
      throw new ConflictException('INVALID_IDEMPOTENCY_KEY');
    }
    const sourceIp = String(context.sourceIp ?? '').trim();
    if (!sourceIp) throw new ServiceUnavailableException('REQUEST_SOURCE_UNAVAILABLE');
    const correlationId = CORRELATION_PATTERN.test(String(context.correlationId ?? '').trim())
      ? String(context.correlationId).trim()
      : randomUUID();

    const request = this.normalize(dto);
    const payloadHash = canonicalHash(request);

    const ipDecision = await this.rateLimit.consume('public_org_connect_ip', sourceIp, 5, 15 * 60);
    if (!ipDecision.allowed) throw new TooManyRequestsException('PUBLIC_INTAKE_RATE_LIMITED');

    const replay = await this.findByIdempotencyKey(idempotencyKey);
    if (replay) return this.replayOrConflict(replay, payloadHash, correlationId);

    const emailDecision = await this.rateLimit.consume('public_org_connect_email', request.email, 3, 24 * 60 * 60);
    if (!emailDecision.allowed) throw new TooManyRequestsException('PUBLIC_INTAKE_RATE_LIMITED');

    for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
      try {
        return await this.persist(request, payloadHash, idempotencyKey, correlationId);
      } catch (error) {
        if (attempt < MAX_TRANSACTION_ATTEMPTS && isRetryableTransactionError(error)) continue;
        const concurrent = await this.findByIdempotencyKey(idempotencyKey).catch(() => null);
        if (concurrent) return this.replayOrConflict(concurrent, payloadHash, correlationId);
        throw error;
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

  private async findByIdempotencyKey(idempotencyKey: string): Promise<ExistingRequestRow | null> {
    const rows = await this.prisma.$queryRaw<ExistingRequestRow[]>(Prisma.sql`
      SELECT
        id,
        "requestNumber" AS request_number,
        status,
        "payloadHash" AS payload_hash
      FROM public.public_organization_connection_requests
      WHERE "idempotencyKey" = ${idempotencyKey}
      LIMIT 1
    `);
    return rows[0] ?? null;
  }

  private replayOrConflict(
    existing: ExistingRequestRow,
    payloadHash: string,
    correlationId: string,
  ): OrganizationIntakeResponse {
    if (existing.payload_hash !== payloadHash) {
      throw new ConflictException('IDEMPOTENCY_PAYLOAD_MISMATCH');
    }
    return {
      requestNumber: existing.request_number,
      status: existing.status,
      replay: true,
      correlationId,
    };
  }

  private async persist(
    request: NormalizedRequest,
    payloadHash: string,
    idempotencyKey: string,
    correlationId: string,
  ): Promise<OrganizationIntakeResponse> {
    const requestId = `public-org-request-${randomUUID()}`;
    const auditId = `audit-${randomUUID()}`;
    const outboxId = `outbox-${randomUUID()}`;
    const requestNumber = this.issueRequestNumber();
    const createdAt = new Date();
    const retentionUntil = new Date(createdAt.getTime() + RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const event = publicEventPayload({ requestId, requestNumber, payloadHash, request, createdAt });
    const auditHash = createHash('sha256').update(JSON.stringify({
      id: auditId,
      action: 'public:organization-intake:create',
      actorUserId: 'public:organization-intake',
      actorRole: 'PUBLIC',
      objectType: 'PublicOrganizationConnectionRequest',
      objectId: requestId,
      outcome: 'SUCCESS',
      payloadHash,
    })).digest('hex');

    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw(Prisma.sql`
        SELECT pg_advisory_xact_lock(hashtextextended(${idempotencyKey}, 0))
      `);

      const existingRows = await tx.$queryRaw<ExistingRequestRow[]>(Prisma.sql`
        SELECT
          id,
          "requestNumber" AS request_number,
          status,
          "payloadHash" AS payload_hash
        FROM public.public_organization_connection_requests
        WHERE "idempotencyKey" = ${idempotencyKey}
        LIMIT 1
      `);
      const existing = existingRows[0];
      if (existing) return this.replayOrConflict(existing, payloadHash, correlationId);

      await tx.$executeRaw(Prisma.sql`
        INSERT INTO public.audit_events (
          id, action, "actorUserId", "actorRole", "objectType", "objectId",
          outcome, metadata, "correlationId", hash, "prevHash", "createdAt"
        ) VALUES (
          ${auditId},
          'public:organization-intake:create',
          'public:organization-intake',
          'PUBLIC',
          'PublicOrganizationConnectionRequest',
          ${requestId},
          'SUCCESS',
          ${JSON.stringify(event)}::jsonb,
          ${correlationId},
          ${auditHash},
          NULL,
          ${createdAt}
        )
      `);

      await tx.$executeRaw(Prisma.sql`
        INSERT INTO public.outbox_entries (
          id, type, payload, status, "triggeredByUserId", "idempotencyKey",
          "maxRetries", "retryCount", "nextRetryAt", "correlationId", "auditId", "createdAt"
        ) VALUES (
          ${outboxId},
          'PUBLIC_ORGANIZATION_CONNECTION_REQUESTED',
          ${JSON.stringify(event)}::jsonb,
          'PENDING',
          NULL,
          ${`public-org-intake:${idempotencyKey}`},
          5,
          0,
          ${createdAt},
          ${correlationId},
          ${auditId},
          ${createdAt}
        )
      `);

      await tx.$executeRaw(Prisma.sql`
        INSERT INTO public.public_organization_connection_requests (
          id, "requestNumber", status, locale, "organizationName", inn,
          "contactName", position, phone, email, "organizationRole", scenario,
          "consentVersion", "consentedAt", "payloadHash", "idempotencyKey",
          "correlationId", source, "auditEventId", "outboxEntryId",
          "retentionUntil", "createdAt", "updatedAt"
        ) VALUES (
          ${requestId},
          ${requestNumber},
          'NEW',
          ${request.locale},
          ${request.organizationName},
          ${request.inn},
          ${request.contactName},
          ${request.position},
          ${request.phone},
          ${request.email},
          ${request.organizationRole},
          ${request.scenario},
          ${request.consentVersion},
          ${createdAt},
          ${payloadHash},
          ${idempotencyKey},
          ${correlationId},
          'PUBLIC_PLATFORM_V7',
          ${auditId},
          ${outboxId},
          ${retentionUntil},
          ${createdAt},
          ${createdAt}
        )
      `);

      return {
        requestNumber,
        status: 'NEW',
        replay: false,
        correlationId,
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private issueRequestNumber(): string {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return `PC-${date}-${randomBytes(6).toString('hex').toUpperCase()}`;
  }
}
