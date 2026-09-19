import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import { RlsTransactionService } from '../../common/prisma/rls-transaction.service';
import type { RequestUser } from '../../common/types/request-user';
import type { AddDisputeEvidenceDto } from './dto/add-dispute-evidence.dto';
import type { AppealDisputeDto } from './dto/appeal-dispute.dto';
import type { BindDisputeOperationsDto } from './dto/bind-dispute-operations.dto';
import type { CreateDisputeDto } from './dto/create-dispute.dto';
import type { DecideDisputeDto } from './dto/decide-dispute.dto';
import type { DisputeVersionCommandDto } from './dto/dispute-version-command.dto';
import type { ResolveDisputeAppealDto } from './dto/resolve-dispute-appeal.dto';

type JsonObject = Record<string, unknown>;
type JsonRow = Readonly<{ result: Prisma.JsonValue }>;

const SAFE_ID = /^[A-Za-z0-9:_.-]{1,240}$/;
const MAX_MINOR = 9_223_372_036_854_775_807n;

function stable(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as JsonObject)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, stable(item)]),
    );
  }
  return value;
}

function fingerprint(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

function persistedIdempotencyKey(
  user: RequestUser,
  action: string,
  target: string,
  clientKey: string,
): string {
  return `dispute:${fingerprint({
    tenantId: user.tenantId,
    actorId: user.id,
    action,
    target,
    clientKey,
  })}`;
}

function safeId(value: unknown, field: string): string {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!SAFE_ID.test(normalized)) {
    throw new BadRequestException({ code: 'DISPUTE_INPUT_INVALID', field });
  }
  return normalized;
}

function optionalSafeId(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === '') return null;
  return safeId(value, field);
}

function requiredText(value: unknown, field: string, min: number, max: number): string {
  const normalized = typeof value === 'string' ? value.normalize('NFKC').trim() : '';
  if (
    normalized.length < min
    || normalized.length > max
    || /[\u0000-\u001f\u007f]/.test(normalized)
  ) {
    throw new BadRequestException({ code: 'DISPUTE_INPUT_INVALID', field });
  }
  return normalized;
}

function positiveBigInt(value: unknown, field: string): bigint {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!/^(?:[1-9]\d{0,18})$/.test(normalized)) {
    throw new BadRequestException({ code: 'DISPUTE_INPUT_INVALID', field });
  }
  const parsed = BigInt(normalized);
  if (parsed > MAX_MINOR) {
    throw new BadRequestException({ code: 'DISPUTE_MINOR_UNITS_OVERFLOW', field });
  }
  return parsed;
}

function optionalPositiveBigInt(value: unknown, field: string): bigint | null {
  if (value === undefined || value === null || value === '') return null;
  return positiveBigInt(value, field);
}

function commandResult(rows: readonly JsonRow[], commandId?: string): JsonObject {
  const value = rows[0]?.result;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new InternalServerErrorException({
      code: 'DISPUTE_COMMAND_RESULT_MISSING',
      commandId,
    });
  }
  return value as JsonObject;
}

function postgresCode(error: unknown): string {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const meta = error.meta as Record<string, unknown> | undefined;
    for (const key of ['code', 'database_error_code', 'dbErrorCode', 'sqlState']) {
      if (typeof meta?.[key] === 'string') return String(meta[key]);
    }
    return error.code;
  }
  if (error && typeof error === 'object' && typeof (error as { code?: unknown }).code === 'string') {
    return String((error as { code: string }).code);
  }
  return '';
}

function disputeCode(error: unknown): string {
  const message = String((error as { message?: unknown })?.message ?? error);
  return message.match(/DISPUTE_[A-Z0-9_]+/)?.[0] ?? 'DISPUTE_COMMAND_FAILED';
}

function mapError(error: unknown): never {
  if (
    error instanceof BadRequestException
    || error instanceof ConflictException
    || error instanceof ForbiddenException
    || error instanceof NotFoundException
  ) {
    throw error;
  }
  const sqlState = postgresCode(error);
  const code = disputeCode(error);
  if (sqlState === 'P0002' || code === 'DISPUTE_NOT_FOUND') {
    throw new NotFoundException({ code });
  }
  if (sqlState === '42501') {
    throw new ForbiddenException({ code });
  }
  if (sqlState === '22023') {
    throw new BadRequestException({ code });
  }
  if (['40001', '40P01', '23505', '23514'].includes(sqlState)) {
    throw new ConflictException({ code, sqlState });
  }
  throw error;
}

@Injectable()
export class PostgresqlDisputeRepository {
  constructor(private readonly rls: RlsTransactionService) {}

  async list(user: RequestUser): Promise<JsonObject[]> {
    try {
      return await this.rls.withTrustedContext(user, async (tx) => {
        const rows = await tx.$queryRaw<JsonRow[]>(Prisma.sql`
          SELECT dispute.list_cases() AS result
        `);
        return rows.map((row) => commandResult([row]));
      });
    } catch (error) {
      mapError(error);
    }
  }

  async getOne(idInput: string, user: RequestUser): Promise<JsonObject> {
    const id = safeId(idInput, 'id');
    try {
      return await this.rls.withTrustedContext(user, async (tx) => {
        const rows = await tx.$queryRaw<JsonRow[]>(Prisma.sql`
          SELECT dispute.get_case(${id}) AS result
        `);
        return commandResult(rows);
      });
    } catch (error) {
      mapError(error);
    }
  }

  async open(input: CreateDisputeDto, user: RequestUser): Promise<JsonObject> {
    const dealId = safeId(input.dealId, 'dealId');
    const clientKey = safeId(input.idempotencyKey, 'idempotencyKey');
    const normalized = {
      dealId,
      shipmentId: optionalSafeId(input.shipmentId, 'shipmentId'),
      type: requiredText(input.reason, 'reason', 2, 100).toUpperCase(),
      description: requiredText(input.detail, 'detail', 5, 4000),
      claimAmountMinor: optionalPositiveBigInt(input.claimAmountKopecks, 'claimAmountKopecks'),
      currency: requiredText(input.currency ?? 'RUB', 'currency', 3, 3).toUpperCase(),
      clientIdempotencyKey: clientKey,
      idempotencyKey: persistedIdempotencyKey(user, 'open', dealId, clientKey),
    };
    return this.command(user, 'open', normalized, async (tx, commandId, requestHash) => {
      return tx.$queryRaw<JsonRow[]>(Prisma.sql`
        SELECT dispute.open_case(
          ${normalized.dealId}, ${normalized.shipmentId}, ${normalized.type},
          ${normalized.description}, ${normalized.claimAmountMinor}, ${normalized.currency},
          ${commandId}, ${normalized.idempotencyKey}, ${requestHash}
        ) AS result
      `);
    });
  }

  async triage(idInput: string, input: DisputeVersionCommandDto, user: RequestUser) {
    return this.versionCommand('triage', idInput, input, user,
      (tx, id, version, commandId, idempotencyKey, requestHash) => tx.$queryRaw<JsonRow[]>(Prisma.sql`
        SELECT dispute.triage_case(
          ${id}, ${version}, ${commandId}, ${idempotencyKey}, ${requestHash}
        ) AS result
      `));
  }

  async addEvidence(idInput: string, input: AddDisputeEvidenceDto, user: RequestUser) {
    const id = safeId(idInput, 'id');
    const clientKey = safeId(input.idempotencyKey, 'idempotencyKey');
    const normalized = {
      id,
      type: requiredText(input.type, 'type', 2, 20).toUpperCase(),
      fileId: optionalSafeId(input.fileId, 'fileId'),
      description: requiredText(input.description, 'description', 2, 4000),
      source: requiredText(input.source, 'source', 2, 500),
      expectedVersion: positiveBigInt(input.expectedVersion, 'expectedVersion'),
      clientIdempotencyKey: clientKey,
      idempotencyKey: persistedIdempotencyKey(user, 'add-evidence', id, clientKey),
    };
    return this.command(user, 'add-evidence', normalized,
      async (tx, commandId, requestHash) => tx.$queryRaw<JsonRow[]>(Prisma.sql`
        SELECT dispute.add_evidence(
          ${normalized.id}, ${normalized.type}, ${normalized.fileId},
          ${normalized.description}, ${normalized.source}, ${normalized.expectedVersion},
          ${commandId}, ${normalized.idempotencyKey}, ${requestHash}
        ) AS result
      `));
  }

  async decide(idInput: string, input: DecideDisputeDto, user: RequestUser) {
    const id = safeId(idInput, 'id');
    const clientKey = safeId(input.idempotencyKey, 'idempotencyKey');
    const normalized = {
      id,
      outcome: requiredText(input.outcome, 'outcome', 2, 30).toUpperCase(),
      sellerSplitPct: input.sellerSplitPct ?? null,
      note: requiredText(input.note, 'note', 5, 4000),
      expectedVersion: positiveBigInt(input.expectedVersion, 'expectedVersion'),
      clientIdempotencyKey: clientKey,
      idempotencyKey: persistedIdempotencyKey(user, 'decide', id, clientKey),
    };
    return this.command(user, 'decide', normalized,
      async (tx, commandId, requestHash) => tx.$queryRaw<JsonRow[]>(Prisma.sql`
        SELECT dispute.decide_case(
          ${normalized.id}, ${normalized.outcome}, ${normalized.sellerSplitPct},
          ${normalized.note}, ${normalized.expectedVersion}, ${commandId},
          ${normalized.idempotencyKey}, ${requestHash}
        ) AS result
      `));
  }

  async appeal(idInput: string, input: AppealDisputeDto, user: RequestUser) {
    const id = safeId(idInput, 'id');
    const clientKey = safeId(input.idempotencyKey, 'idempotencyKey');
    const normalized = {
      id,
      reason: requiredText(input.reason, 'reason', 10, 4000),
      expectedVersion: positiveBigInt(input.expectedVersion, 'expectedVersion'),
      clientIdempotencyKey: clientKey,
      idempotencyKey: persistedIdempotencyKey(user, 'appeal', id, clientKey),
    };
    return this.command(user, 'appeal', normalized,
      async (tx, commandId, requestHash) => tx.$queryRaw<JsonRow[]>(Prisma.sql`
        SELECT dispute.appeal_case(
          ${normalized.id}, ${normalized.reason}, ${normalized.expectedVersion},
          ${commandId}, ${normalized.idempotencyKey}, ${requestHash}
        ) AS result
      `));
  }

  async resolveAppeal(idInput: string, input: ResolveDisputeAppealDto, user: RequestUser) {
    const id = safeId(idInput, 'id');
    const clientKey = safeId(input.idempotencyKey, 'idempotencyKey');
    const normalized = {
      id,
      resolution: requiredText(input.resolution, 'resolution', 2, 30).toUpperCase(),
      finalOutcome: requiredText(input.finalOutcome, 'finalOutcome', 2, 30).toUpperCase(),
      sellerSplitPct: input.sellerSplitPct ?? null,
      note: requiredText(input.note, 'note', 5, 4000),
      expectedVersion: positiveBigInt(input.expectedVersion, 'expectedVersion'),
      clientIdempotencyKey: clientKey,
      idempotencyKey: persistedIdempotencyKey(user, 'resolve-appeal', id, clientKey),
    };
    return this.command(user, 'resolve-appeal', normalized,
      async (tx, commandId, requestHash) => tx.$queryRaw<JsonRow[]>(Prisma.sql`
        SELECT dispute.resolve_appeal(
          ${normalized.id}, ${normalized.resolution}, ${normalized.finalOutcome},
          ${normalized.sellerSplitPct}, ${normalized.note}, ${normalized.expectedVersion},
          ${commandId}, ${normalized.idempotencyKey}, ${requestHash}
        ) AS result
      `));
  }

  async finalize(idInput: string, input: DisputeVersionCommandDto, user: RequestUser) {
    return this.versionCommand('finalize', idInput, input, user,
      (tx, id, version, commandId, idempotencyKey, requestHash) => tx.$queryRaw<JsonRow[]>(Prisma.sql`
        SELECT dispute.finalize_case(
          ${id}, ${version}, ${commandId}, ${idempotencyKey}, ${requestHash}
        ) AS result
      `));
  }

  async bindOperations(idInput: string, input: BindDisputeOperationsDto, user: RequestUser) {
    const id = safeId(idInput, 'id');
    const clientKey = safeId(input.idempotencyKey, 'idempotencyKey');
    const normalized = {
      id,
      instructionId: safeId(input.instructionId, 'instructionId'),
      sellerOperationId: optionalSafeId(input.sellerOperationId, 'sellerOperationId'),
      buyerOperationId: optionalSafeId(input.buyerOperationId, 'buyerOperationId'),
      expectedVersion: positiveBigInt(input.expectedVersion, 'expectedVersion'),
      clientIdempotencyKey: clientKey,
      idempotencyKey: persistedIdempotencyKey(user, 'bind-operations', id, clientKey),
    };
    return this.command(user, 'bind-operations', normalized,
      async (tx, commandId, requestHash) => tx.$queryRaw<JsonRow[]>(Prisma.sql`
        SELECT dispute.bind_instruction_operations(
          ${normalized.id}, ${normalized.instructionId}, ${normalized.sellerOperationId},
          ${normalized.buyerOperationId}, ${normalized.expectedVersion}, ${commandId},
          ${normalized.idempotencyKey}, ${requestHash}
        ) AS result
      `));
  }

  async close(idInput: string, input: DisputeVersionCommandDto, user: RequestUser) {
    return this.versionCommand('close', idInput, input, user,
      (tx, id, version, commandId, idempotencyKey, requestHash) => tx.$queryRaw<JsonRow[]>(Prisma.sql`
        SELECT dispute.close_case(
          ${id}, ${version}, ${commandId}, ${idempotencyKey}, ${requestHash}
        ) AS result
      `));
  }

  private async versionCommand(
    action: string,
    idInput: string,
    input: DisputeVersionCommandDto,
    user: RequestUser,
    work: (
      tx: Prisma.TransactionClient,
      id: string,
      version: bigint,
      commandId: string,
      idempotencyKey: string,
      requestHash: string,
    ) => Promise<JsonRow[]>,
  ) {
    const id = safeId(idInput, 'id');
    const clientKey = safeId(input.idempotencyKey, 'idempotencyKey');
    const normalized = {
      id,
      expectedVersion: positiveBigInt(input.expectedVersion, 'expectedVersion'),
      clientIdempotencyKey: clientKey,
      idempotencyKey: persistedIdempotencyKey(user, action, id, clientKey),
    };
    return this.command(user, action, normalized,
      (tx, commandId, requestHash) => work(
        tx,
        normalized.id,
        normalized.expectedVersion,
        commandId,
        normalized.idempotencyKey,
        requestHash,
      ));
  }

  private async command(
    user: RequestUser,
    action: string,
    normalized: JsonObject,
    work: (
      tx: Prisma.TransactionClient,
      commandId: string,
      requestHash: string,
    ) => Promise<JsonRow[]>,
  ): Promise<JsonObject> {
    const commandId = `dispute-command:${randomUUID()}`;
    const requestHash = fingerprint({ action: `dispute.${action}`, ...normalized });
    try {
      return await this.rls.withTrustedContext(
        user,
        async (tx) => commandResult(await work(tx, commandId, requestHash), commandId),
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxConflictRetries: 5,
          timeout: 30_000,
        },
      );
    } catch (error) {
      mapError(error);
    }
  }
}
