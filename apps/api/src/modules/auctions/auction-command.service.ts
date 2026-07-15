import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { RlsTransactionService } from '../../common/prisma/rls-transaction.service';
import type { RequestUser } from '../../common/types/request-user';

const SAFE_ID = /^[A-Za-z0-9:_.-]{1,240}$/;
const DECIMAL_6 = /^(?:0|[1-9]\d{0,19})(?:\.\d{1,6})?$/;
const MAX_TEXT = 500;

type JsonRecord = Record<string, unknown>;
type CommandRow = Readonly<{ result: Prisma.JsonValue }>;

export type RegisterAuctionLotInput = Readonly<{
  title: string;
  culture: string;
  grade?: string | null;
  volumeTons: string;
  startPriceKopecksPerTon: string;
  stepPriceKopecksPerTon: string;
  region: string;
  address?: string | null;
  auctionEndsAt: string;
  sourceType: 'FGIS' | 'ERP' | 'MANUAL_VERIFIED' | 'OTHER';
  sourceExternalId: string;
  sourceCertificateId?: string | null;
  autoExtendEnabled?: boolean;
  autoExtendWindowMinutes?: number;
  autoExtendMinutes?: number;
  idempotencyKey: string;
}>;

export type RecordAuctionAdmissionInput = Readonly<{
  buyerOrgId: string;
  buyerUserId: string;
  status: 'ADMITTED' | 'BLOCKED';
  validUntil: string;
  reason: string;
  expectedVersion: string;
  idempotencyKey: string;
}>;

export type PlaceAuctionBidInput = Readonly<{
  amountKopecksPerTon: string;
  volumeTons: string;
  expectedVersion: string;
  idempotencyKey: string;
}>;

export type CloseAuctionLotInput = Readonly<{
  expectedVersion: string;
  idempotencyKey: string;
}>;

@Injectable()
export class AuctionCommandService {
  constructor(private readonly rls: RlsTransactionService) {}

  async registerLot(input: RegisterAuctionLotInput, user: RequestUser) {
    const commandId = `auction-command:${randomUUID()}`;
    const idempotencyKey = safeId(input.idempotencyKey, 'idempotencyKey');
    const title = requiredText(input.title, 'title');
    const culture = requiredText(input.culture, 'culture');
    const grade = optionalText(input.grade, 'grade');
    const volumeTons = positiveDecimal(input.volumeTons, 'volumeTons');
    const startPrice = nonNegativeBigInt(input.startPriceKopecksPerTon, 'startPriceKopecksPerTon');
    const stepPrice = positiveBigInt(input.stepPriceKopecksPerTon, 'stepPriceKopecksPerTon');
    const region = requiredText(input.region, 'region');
    const address = optionalText(input.address, 'address');
    const auctionEndsAt = isoDate(input.auctionEndsAt, 'auctionEndsAt');
    const sourceType = sourceTypeValue(input.sourceType);
    const sourceExternalId = safeId(input.sourceExternalId, 'sourceExternalId');
    const sourceCertificateId = optionalSafeId(input.sourceCertificateId, 'sourceCertificateId');
    const autoExtendEnabled = input.autoExtendEnabled ?? true;
    const autoExtendWindowMinutes = boundedInteger(input.autoExtendWindowMinutes, 0, 120, 10, 'autoExtendWindowMinutes');
    const autoExtendMinutes = boundedInteger(input.autoExtendMinutes, 0, 120, 10, 'autoExtendMinutes');

    return this.execute(user, async (tx) => {
      const rows = await tx.$queryRaw<CommandRow[]>(Prisma.sql`
        SELECT auction.register_verified_lot(
          ${title},
          ${culture},
          ${grade},
          ${volumeTons},
          ${startPrice},
          ${stepPrice},
          ${region},
          ${address},
          ${auctionEndsAt},
          ${sourceType},
          ${sourceExternalId},
          ${sourceCertificateId},
          ${autoExtendEnabled},
          ${autoExtendWindowMinutes}::integer,
          ${autoExtendMinutes}::integer,
          ${commandId},
          ${idempotencyKey}
        ) AS result
      `);
      return commandResult(rows, commandId);
    });
  }

  async recordAdmission(
    lotIdInput: string,
    input: RecordAuctionAdmissionInput,
    user: RequestUser,
  ) {
    const commandId = `auction-command:${randomUUID()}`;
    const lotId = safeId(lotIdInput, 'lotId');
    const buyerOrgId = safeId(input.buyerOrgId, 'buyerOrgId');
    const buyerUserId = safeId(input.buyerUserId, 'buyerUserId');
    const status = input.status;
    if (status !== 'ADMITTED' && status !== 'BLOCKED') {
      throw fieldError('status', 'Допуск должен иметь статус ADMITTED или BLOCKED.');
    }
    const validUntil = isoDate(input.validUntil, 'validUntil');
    const reason = requiredText(input.reason, 'reason');
    const expectedVersion = positiveBigInt(input.expectedVersion, 'expectedVersion');
    const idempotencyKey = safeId(input.idempotencyKey, 'idempotencyKey');

    return this.execute(user, async (tx) => {
      const rows = await tx.$queryRaw<CommandRow[]>(Prisma.sql`
        SELECT auction.record_admission(
          ${lotId},
          ${buyerOrgId},
          ${buyerUserId},
          ${status},
          ${validUntil},
          ${reason},
          ${expectedVersion},
          ${commandId},
          ${idempotencyKey}
        ) AS result
      `);
      return commandResult(rows, commandId);
    });
  }

  async placeBid(
    lotIdInput: string,
    input: PlaceAuctionBidInput,
    user: RequestUser,
  ) {
    const commandId = `auction-command:${randomUUID()}`;
    const lotId = safeId(lotIdInput, 'lotId');
    const amountKopecksPerTon = positiveBigInt(
      input.amountKopecksPerTon,
      'amountKopecksPerTon',
    );
    const volumeTons = positiveDecimal(input.volumeTons, 'volumeTons');
    const expectedVersion = positiveBigInt(input.expectedVersion, 'expectedVersion');
    const idempotencyKey = safeId(input.idempotencyKey, 'idempotencyKey');

    return this.execute(user, async (tx) => {
      const rows = await tx.$queryRaw<CommandRow[]>(Prisma.sql`
        SELECT auction.place_bid(
          ${lotId},
          ${amountKopecksPerTon},
          ${volumeTons},
          ${expectedVersion},
          ${commandId},
          ${idempotencyKey}
        ) AS result
      `);
      return commandResult(rows, commandId);
    });
  }

  async closeLot(
    lotIdInput: string,
    input: CloseAuctionLotInput,
    user: RequestUser,
  ) {
    const commandId = `auction-command:${randomUUID()}`;
    const lotId = safeId(lotIdInput, 'lotId');
    const expectedVersion = positiveBigInt(input.expectedVersion, 'expectedVersion');
    const idempotencyKey = safeId(input.idempotencyKey, 'idempotencyKey');

    return this.execute(user, async (tx) => {
      const rows = await tx.$queryRaw<CommandRow[]>(Prisma.sql`
        SELECT auction.close_lot(
          ${lotId},
          ${expectedVersion},
          ${commandId},
          ${idempotencyKey}
        ) AS result
      `);
      return commandResult(rows, commandId);
    });
  }

  async bindDeal(
    lotIdInput: string,
    winningBidIdInput: string,
    dealIdInput: string,
    user: RequestUser,
  ) {
    const lotId = safeId(lotIdInput, 'lotId');
    const winningBidId = safeId(winningBidIdInput, 'winningBidId');
    const dealId = safeId(dealIdInput, 'dealId');
    return this.execute(user, async (tx) => {
      const rows = await tx.$queryRaw<CommandRow[]>(Prisma.sql`
        SELECT auction.bind_deal(${lotId}, ${winningBidId}, ${dealId}) AS result
      `);
      return commandResult(rows, `auction-bind:${dealId}`);
    });
  }

  private async execute<T>(
    user: RequestUser,
    work: Parameters<RlsTransactionService['withTrustedContext']>[1],
  ): Promise<T> {
    try {
      return await this.rls.withTrustedContext(
        user,
        work as Parameters<RlsTransactionService['withTrustedContext']>[1],
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxConflictRetries: 5,
          timeout: 20_000,
        },
      ) as T;
    } catch (error) {
      throw mapAuctionError(error);
    }
  }
}

function commandResult(rows: CommandRow[], commandId: string): JsonRecord {
  const result = rows[0]?.result;
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    throw new InternalServerErrorException({
      code: 'AUCTION_COMMAND_RECEIPT_MISSING',
      commandId,
    });
  }
  return {
    ...(result as JsonRecord),
    commandId,
  };
}

function safeId(value: unknown, field: string): string {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!SAFE_ID.test(normalized)) {
    throw fieldError(field, `${field} должен быть безопасным идентификатором.`);
  }
  return normalized;
}

function optionalSafeId(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === '') return null;
  return safeId(value, field);
}

function requiredText(value: unknown, field: string): string {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized || normalized.length > MAX_TEXT || /[\u0000-\u001F\u007F]/.test(normalized)) {
    throw fieldError(field, `${field} обязательно и не должно содержать управляющие символы.`);
  }
  return normalized;
}

function optionalText(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === '') return null;
  return requiredText(value, field);
}

function positiveDecimal(value: unknown, field: string): Prisma.Decimal {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!DECIMAL_6.test(normalized)) throw fieldError(field, `${field} должен быть десятичной строкой с точностью до 6 знаков.`);
  const decimal = new Prisma.Decimal(normalized);
  if (!decimal.isPositive()) throw fieldError(field, `${field} должен быть больше нуля.`);
  return decimal;
}

function positiveBigInt(value: unknown, field: string): bigint {
  const result = nonNegativeBigInt(value, field);
  if (result <= 0n) throw fieldError(field, `${field} должен быть больше нуля.`);
  return result;
}

function nonNegativeBigInt(value: unknown, field: string): bigint {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!/^(?:0|[1-9]\d{0,18})$/.test(normalized)) {
    throw fieldError(field, `${field} должен быть целой строкой в минимальных денежных единицах.`);
  }
  try {
    const result = BigInt(normalized);
    if (result < 0n || result > 9_000_000_000_000_000_000n) throw new Error('range');
    return result;
  } catch {
    throw fieldError(field, `${field} выходит за допустимый диапазон bigint.`);
  }
}

function isoDate(value: unknown, field: string): Date {
  const normalized = typeof value === 'string' ? value.trim() : '';
  const date = new Date(normalized);
  if (!normalized || Number.isNaN(date.getTime()) || !/T/.test(normalized)) {
    throw fieldError(field, `${field} должен быть ISO date-time.`);
  }
  return date;
}

function sourceTypeValue(value: unknown): RegisterAuctionLotInput['sourceType'] {
  if (value === 'FGIS' || value === 'ERP' || value === 'MANUAL_VERIFIED' || value === 'OTHER') return value;
  throw fieldError('sourceType', 'sourceType не поддерживается.');
}

function boundedInteger(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
  field: string,
): number {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || Number(value) < min || Number(value) > max) {
    throw fieldError(field, `${field} должен быть целым числом от ${min} до ${max}.`);
  }
  return Number(value);
}

function fieldError(field: string, message: string): UnprocessableEntityException {
  return new UnprocessableEntityException({
    code: 'AUCTION_INPUT_INVALID',
    field,
    message,
  });
}

function mapAuctionError(error: unknown): Error {
  if (
    error instanceof BadRequestException
    || error instanceof ConflictException
    || error instanceof ForbiddenException
    || error instanceof NotFoundException
    || error instanceof UnprocessableEntityException
  ) return error;

  const material = errorMaterial(error);
  const code = AUCTION_CODES.find((candidate) => material.includes(candidate));
  if (!code) {
    return new InternalServerErrorException({ code: 'AUCTION_COMMAND_FAILED' });
  }
  if (code === 'AUCTION_LOT_NOT_FOUND' || code === 'AUCTION_AWARD_NOT_FOUND') {
    return new NotFoundException({ code });
  }
  if (
    code.includes('ROLE_DENIED')
    || code.includes('SCOPE_DENIED')
    || code.includes('ADMISSION_REQUIRED')
    || code.includes('ACTIVE_MEMBERSHIP_REQUIRED')
    || code.includes('AUTHORITY_INVALID')
    || code.includes('TRUSTED_CONTEXT_REQUIRED')
  ) {
    return new ForbiddenException({ code });
  }
  if (
    code.includes('STALE_VERSION')
    || code.includes('ALREADY_CLOSED')
    || code.includes('CUTOFF')
    || code.includes('NOT_OPEN')
    || code.includes('NOT_ENDED')
    || code.includes('IDEMPOTENCY_PAYLOAD_MISMATCH')
    || code.includes('AWARD_ALREADY_BOUND')
  ) {
    return new ConflictException({ code });
  }
  return new UnprocessableEntityException({ code });
}

function errorMaterial(error: unknown): string {
  if (!error || typeof error !== 'object') return String(error ?? '');
  const record = error as Record<string, unknown>;
  return [
    record.message,
    record.code,
    record.meta && JSON.stringify(record.meta),
  ].filter(Boolean).join(' ');
}

const AUCTION_CODES = [
  'AUCTION_TRUSTED_CONTEXT_REQUIRED',
  'AUCTION_ROLE_DENIED',
  'AUCTION_ACTIVE_MEMBERSHIP_REQUIRED',
  'AUCTION_IDEMPOTENCY_PAYLOAD_MISMATCH',
  'AUCTION_LOT_ID_REQUIRED',
  'AUCTION_LOT_NOT_FOUND',
  'AUCTION_STALE_VERSION',
  'AUCTION_NOT_OPEN',
  'AUCTION_BID_CUTOFF_REACHED',
  'AUCTION_SELLER_AUTHORITY_MISSING',
  'AUCTION_SELLER_SCOPE_DENIED',
  'AUCTION_ADMISSION_REQUIRED',
  'AUCTION_BID_TERMS_INVALID',
  'AUCTION_BID_BELOW_START',
  'AUCTION_BID_BELOW_CURRENT',
  'AUCTION_BID_STEP_INVALID',
  'AUCTION_ALREADY_CLOSED',
  'AUCTION_NOT_ENDED',
  'AUCTION_NO_ELIGIBLE_BIDS',
  'AUCTION_BUYER_AUTHORITY_MISSING',
  'AUCTION_AWARD_NOT_FOUND',
  'AUCTION_AWARD_ALREADY_BOUND',
  'AUCTION_DEAL_BASIS_MISMATCH',
  'AUCTION_BUYER_AUTHORITY_INVALID',
  'AUCTION_ADMISSION_DECISION_INVALID',
  'AUCTION_ADMISSION_EXPIRY_INVALID',
  'AUCTION_END_MUST_BE_FUTURE',
  'AUCTION_LOT_TERMS_INVALID',
  'AUCTION_VERIFIED_SOURCE_REQUIRED',
  'AUCTION_EXTENSION_POLICY_INVALID',
] as const;
