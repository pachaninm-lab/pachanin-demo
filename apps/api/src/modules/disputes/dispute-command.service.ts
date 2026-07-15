import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { RlsTransactionService } from '../../common/prisma/rls-transaction.service';
import type { RequestUser } from '../../common/types/request-user';

const SAFE_ID = /^[A-Za-z0-9:_.-]{1,240}$/;
const MAX_TEXT = 4_000;

type JsonRecord = Record<string, unknown>;
type CommandRow = Readonly<{ result: Prisma.JsonValue }>;

export type DisputeOutcome = 'BUYER_WINS' | 'SELLER_WINS' | 'SPLIT' | 'CANCELLED';
export type DisputeSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type OpenDisputeInput = Readonly<{
  dealId: string;
  shipmentId?: string | null;
  type: string;
  description: string;
  claimAmountKopecks: string;
  severity?: DisputeSeverity;
  idempotencyKey: string;
}>;

export type AddDisputeEvidenceInput = Readonly<{
  type: string;
  description: string;
  source: string;
  fileId?: string | null;
  idempotencyKey: string;
}>;

export type ResolveDisputeInput = Readonly<{
  outcome: DisputeOutcome;
  splitBuyerPct?: number | null;
  reason: string;
  idempotencyKey: string;
}>;

export type OpenDisputeAppealInput = Readonly<{
  requestedOutcome: DisputeOutcome;
  requestedSplitBuyerPct?: number | null;
  reason: string;
  idempotencyKey: string;
}>;

export type ResolveDisputeAppealInput = Readonly<{
  granted: boolean;
  finalOutcome?: DisputeOutcome | null;
  finalSplitBuyerPct?: number | null;
  note: string;
  idempotencyKey: string;
}>;

@Injectable()
export class DisputeCommandService {
  constructor(private readonly rls: RlsTransactionService) {}

  async open(input: OpenDisputeInput, user: RequestUser): Promise<JsonRecord> {
    const commandId = `dispute-command:${randomUUID()}`;
    const dealId = safeId(input.dealId, 'dealId');
    const shipmentId = optionalSafeId(input.shipmentId, 'shipmentId');
    const type = requiredText(input.type, 'type', 120);
    const description = requiredText(input.description, 'description');
    const amount = nonNegativeBigInt(input.claimAmountKopecks, 'claimAmountKopecks');
    const severity = severityValue(input.severity ?? 'MEDIUM');
    const idempotencyKey = safeId(input.idempotencyKey, 'idempotencyKey');

    return this.execute(user, commandId, async (tx) => {
      const rows = await tx.$queryRaw<CommandRow[]>(Prisma.sql`
        SELECT dispute.open_case(
          ${dealId}, ${shipmentId}, ${type}, ${description}, ${amount}, ${severity},
          ${commandId}, ${idempotencyKey}
        ) AS result
      `);
      return commandResult(rows, commandId);
    });
  }

  async triage(caseIdInput: string, idempotencyKeyInput: string, user: RequestUser): Promise<JsonRecord> {
    const commandId = `dispute-command:${randomUUID()}`;
    const caseId = safeId(caseIdInput, 'caseId');
    const idempotencyKey = safeId(idempotencyKeyInput, 'idempotencyKey');
    return this.execute(user, commandId, async (tx) => {
      const rows = await tx.$queryRaw<CommandRow[]>(Prisma.sql`
        SELECT dispute.triage_case(${caseId}, ${commandId}, ${idempotencyKey}) AS result
      `);
      return commandResult(rows, commandId);
    });
  }

  async addEvidence(caseIdInput: string, input: AddDisputeEvidenceInput, user: RequestUser): Promise<JsonRecord> {
    const commandId = `dispute-command:${randomUUID()}`;
    const caseId = safeId(caseIdInput, 'caseId');
    const type = requiredText(input.type, 'type', 120);
    const description = requiredText(input.description, 'description');
    const source = requiredText(input.source, 'source', 240);
    const fileId = optionalSafeId(input.fileId, 'fileId');
    const idempotencyKey = safeId(input.idempotencyKey, 'idempotencyKey');
    return this.execute(user, commandId, async (tx) => {
      const rows = await tx.$queryRaw<CommandRow[]>(Prisma.sql`
        SELECT dispute.add_evidence(
          ${caseId}, ${type}, ${description}, ${source}, ${fileId},
          ${commandId}, ${idempotencyKey}
        ) AS result
      `);
      return commandResult(rows, commandId);
    });
  }

  async assignArbitrator(caseIdInput: string, idempotencyKeyInput: string, user: RequestUser): Promise<JsonRecord> {
    const commandId = `dispute-command:${randomUUID()}`;
    const caseId = safeId(caseIdInput, 'caseId');
    const idempotencyKey = safeId(idempotencyKeyInput, 'idempotencyKey');
    return this.execute(user, commandId, async (tx) => {
      const rows = await tx.$queryRaw<CommandRow[]>(Prisma.sql`
        SELECT dispute.assign_arbitrator(${caseId}, ${commandId}, ${idempotencyKey}) AS result
      `);
      return commandResult(rows, commandId);
    });
  }

  async addNote(caseIdInput: string, noteInput: string, idempotencyKeyInput: string, user: RequestUser): Promise<JsonRecord> {
    const commandId = `dispute-command:${randomUUID()}`;
    const caseId = safeId(caseIdInput, 'caseId');
    const note = requiredText(noteInput, 'note');
    const idempotencyKey = safeId(idempotencyKeyInput, 'idempotencyKey');
    return this.execute(user, commandId, async (tx) => {
      const rows = await tx.$queryRaw<CommandRow[]>(Prisma.sql`
        SELECT dispute.add_note(${caseId}, ${note}, ${commandId}, ${idempotencyKey}) AS result
      `);
      return commandResult(rows, commandId);
    });
  }

  async resolve(caseIdInput: string, input: ResolveDisputeInput, user: RequestUser): Promise<JsonRecord> {
    const commandId = `dispute-command:${randomUUID()}`;
    const caseId = safeId(caseIdInput, 'caseId');
    const outcome = outcomeValue(input.outcome);
    const splitBuyerPct = splitValue(outcome, input.splitBuyerPct);
    const reason = requiredText(input.reason, 'reason');
    const idempotencyKey = safeId(input.idempotencyKey, 'idempotencyKey');
    return this.execute(user, commandId, async (tx) => {
      const rows = await tx.$queryRaw<CommandRow[]>(Prisma.sql`
        SELECT dispute.resolve_case(
          ${caseId}, ${outcome}, ${splitBuyerPct}, ${reason},
          ${commandId}, ${idempotencyKey}
        ) AS result
      `);
      return commandResult(rows, commandId);
    });
  }

  async openAppeal(caseIdInput: string, input: OpenDisputeAppealInput, user: RequestUser): Promise<JsonRecord> {
    const commandId = `dispute-command:${randomUUID()}`;
    const caseId = safeId(caseIdInput, 'caseId');
    const outcome = outcomeValue(input.requestedOutcome);
    const splitBuyerPct = splitValue(outcome, input.requestedSplitBuyerPct);
    const reason = requiredText(input.reason, 'reason');
    const idempotencyKey = safeId(input.idempotencyKey, 'idempotencyKey');
    return this.execute(user, commandId, async (tx) => {
      const rows = await tx.$queryRaw<CommandRow[]>(Prisma.sql`
        SELECT dispute.open_appeal(
          ${caseId}, ${outcome}, ${splitBuyerPct}, ${reason},
          ${commandId}, ${idempotencyKey}
        ) AS result
      `);
      return commandResult(rows, commandId);
    });
  }

  async resolveAppeal(caseIdInput: string, input: ResolveDisputeAppealInput, user: RequestUser): Promise<JsonRecord> {
    const commandId = `dispute-command:${randomUUID()}`;
    const caseId = safeId(caseIdInput, 'caseId');
    const outcome = input.granted ? outcomeValue(input.finalOutcome) : null;
    const splitBuyerPct = input.granted && outcome ? splitValue(outcome, input.finalSplitBuyerPct) : null;
    const note = requiredText(input.note, 'note');
    const idempotencyKey = safeId(input.idempotencyKey, 'idempotencyKey');
    return this.execute(user, commandId, async (tx) => {
      const rows = await tx.$queryRaw<CommandRow[]>(Prisma.sql`
        SELECT dispute.resolve_appeal(
          ${caseId}, ${input.granted}, ${outcome}, ${splitBuyerPct}, ${note},
          ${commandId}, ${idempotencyKey}
        ) AS result
      `);
      return commandResult(rows, commandId);
    });
  }

  private async execute<T>(
    user: RequestUser,
    commandId: string,
    work: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.rls.withTrustedContext(
        user,
        async (tx) => work(tx),
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxConflictRetries: 5,
          timeout: 20_000,
        },
      );
    } catch (error) {
      throw mapDisputeError(error, commandId);
    }
  }
}

function commandResult(rows: CommandRow[], commandId: string): JsonRecord {
  const result = rows[0]?.result;
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    throw new InternalServerErrorException({ code: 'DISPUTE_COMMAND_RECEIPT_MISSING', commandId });
  }
  return { ...(result as JsonRecord), commandId };
}

function safeId(value: unknown, field: string): string {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!SAFE_ID.test(normalized)) throw fieldError(field, `${field} must be a safe identifier.`);
  return normalized;
}

function optionalSafeId(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === '') return null;
  return safeId(value, field);
}

function requiredText(value: unknown, field: string, maximum = MAX_TEXT): string {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized || normalized.length > maximum || /[\u0000-\u001F\u007F]/.test(normalized)) {
    throw fieldError(field, `${field} is required and must not contain control characters.`);
  }
  return normalized;
}

function nonNegativeBigInt(value: unknown, field: string): bigint {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!/^(?:0|[1-9]\d{0,18})$/.test(normalized)) {
    throw fieldError(field, `${field} must be an integer string in minor units.`);
  }
  const result = BigInt(normalized);
  if (result > 9_000_000_000_000_000_000n) throw fieldError(field, `${field} is outside bigint range.`);
  return result;
}

function severityValue(value: unknown): DisputeSeverity {
  if (value === 'LOW' || value === 'MEDIUM' || value === 'HIGH' || value === 'CRITICAL') return value;
  throw fieldError('severity', 'Unsupported dispute severity.');
}

function outcomeValue(value: unknown): DisputeOutcome {
  if (value === 'BUYER_WINS' || value === 'SELLER_WINS' || value === 'SPLIT' || value === 'CANCELLED') return value;
  throw fieldError('outcome', 'Unsupported dispute outcome.');
}

function splitValue(outcome: DisputeOutcome, value: unknown): number | null {
  if (outcome !== 'SPLIT') return null;
  if (!Number.isInteger(value) || Number(value) < 0 || Number(value) > 100) {
    throw fieldError('splitBuyerPct', 'splitBuyerPct must be an integer from 0 to 100.');
  }
  return Number(value);
}

function fieldError(field: string, message: string): BadRequestException {
  return new BadRequestException({ code: 'DISPUTE_VALIDATION_FAILED', field, message });
}

function mapDisputeError(error: unknown, commandId: string): Error {
  if (error instanceof BadRequestException || error instanceof ForbiddenException || error instanceof ConflictException || error instanceof NotFoundException) {
    return error;
  }
  const message = databaseMessage(error);
  if (message.includes('DISPUTE_IDEMPOTENCY_PAYLOAD_MISMATCH')) {
    return new ConflictException({ code: 'DISPUTE_IDEMPOTENCY_PAYLOAD_MISMATCH', commandId });
  }
  if (message.includes('DISPUTE_CASE_NOT_FOUND') || message.includes('DISPUTE_DEAL_NOT_FOUND')) {
    return new NotFoundException({ code: message.includes('CASE') ? 'DISPUTE_CASE_NOT_FOUND' : 'DISPUTE_DEAL_NOT_FOUND', commandId });
  }
  if (message.includes('DISPUTE_ROLE_DENIED') || message.includes('DISPUTE_DEAL_ACCESS_DENIED') || message.includes('DISPUTE_ARBITRATOR_REQUIRED') || message.includes('DISPUTE_ALREADY_ASSIGNED')) {
    return new ForbiddenException({ code: extractCode(message), commandId });
  }
  if (message.includes('DISPUTE_INVALID_STATE') || message.includes('DISPUTE_APPEAL_WINDOW_CLOSED') || message.includes('DISPUTE_INSUFFICIENT_LEDGER_BALANCE')) {
    return new ConflictException({ code: extractCode(message), commandId });
  }
  if (message.includes('DISPUTE_')) {
    return new BadRequestException({ code: extractCode(message), commandId });
  }
  return new InternalServerErrorException({ code: 'DISPUTE_COMMAND_FAILED', commandId });
}

function databaseMessage(error: unknown): string {
  if (!error || typeof error !== 'object') return String(error ?? '');
  const record = error as Record<string, unknown>;
  const meta = record.meta && typeof record.meta === 'object' ? record.meta as Record<string, unknown> : undefined;
  return [record.message, meta?.message, meta?.database_error].filter((value): value is string => typeof value === 'string').join(' ');
}

function extractCode(message: string): string {
  return message.match(/DISPUTE_[A-Z0-9_]+/)?.[0] ?? 'DISPUTE_COMMAND_REJECTED';
}
