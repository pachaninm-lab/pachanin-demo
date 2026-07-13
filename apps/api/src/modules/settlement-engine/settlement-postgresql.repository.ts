import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  RlsTransactionService,
  type TrustedRlsContext,
} from '../../common/prisma/rls-transaction.service';
import { RequestUser, Role } from '../../common/types/request-user';

export type SettlementOperationType = 'RESERVE' | 'RELEASE' | 'REFUND';
export type BankCallbackStatus = 'SUCCESS' | 'FAILED';

export type SettlementBeneficiaryInput = Readonly<{
  organizationId: string;
  role: 'SELLER' | 'CARRIER' | 'PLATFORM' | 'TAX' | 'OTHER';
  allocationKopecks: string | number | bigint;
  priority?: number;
  destinationRef?: string;
}>;

export type ConfigureSettlementTermsInput = Readonly<{
  commandId: string;
  idempotencyKey: string;
  dealId: string;
  reserveAmountKopecks: string | number | bigint;
  currency?: string;
  releaseBasis?: Record<string, unknown>;
  beneficiaries: readonly SettlementBeneficiaryInput[];
}>;

export type RequestSettlementOperationInput = Readonly<{
  commandId: string;
  idempotencyKey: string;
  dealId: string;
  operation: SettlementOperationType;
  amountKopecks?: string | number | bigint;
  beneficiaryId?: string;
  partnerId?: string;
  expectedPaymentVersion?: string | number | bigint;
  expectedDealVersion?: string | number | bigint;
}>;

export type VerifiedSettlementCallbackInput = Readonly<{
  dealId: string;
  operationId: string;
  eventId: string;
  operation: SettlementOperationType;
  status: BankCallbackStatus;
  bankRef: string;
  partnerId: string;
  keyId: string;
  payloadFingerprint: string;
  payload: Record<string, unknown>;
  errorMessage?: string;
}>;

export type PlaceSettlementHoldInput = Readonly<{
  commandId: string;
  idempotencyKey: string;
  dealId: string;
  amountKopecks: string | number | bigint;
  basisType: 'DISPUTE' | 'COMPLIANCE' | 'DOCUMENT' | 'OTHER';
  basisId: string;
  reason: string;
  expectedPaymentVersion?: string | number | bigint;
}>;

export type ReleaseSettlementHoldInput = Readonly<{
  commandId: string;
  idempotencyKey: string;
  holdId: string;
  dealId: string;
  expectedPaymentVersion?: string | number | bigint;
}>;

export type ReconcileSettlementOperationInput = Readonly<{
  commandId: string;
  idempotencyKey: string;
  dealId: string;
  operationId: string;
  statementEntryId?: string;
  observedAmountKopecks: string | number | bigint;
  reason?: string;
  expectedPaymentVersion?: string | number | bigint;
}>;

type DealRow = {
  id: string;
  tenantId: string;
  sellerOrgId: string;
  buyerOrgId: string;
  status: string;
  totalKopecks: bigint | null;
  version: bigint;
  updatedAt: Date;
};

type TermsRow = {
  id: string;
  tenantId: string;
  dealId: string;
  version: bigint;
  currency: string;
  reserveAmountMinor: bigint;
  requestFingerprint: string;
};

type PaymentRow = {
  id: string;
  tenantId: string;
  dealId: string;
  paymentTermsId: string;
  status: string;
  currency: string;
  confirmedReservedMinor: bigint;
  pendingReservedMinor: bigint;
  confirmedReleasedMinor: bigint;
  pendingReleasedMinor: bigint;
  confirmedRefundedMinor: bigint;
  pendingRefundedMinor: bigint;
  activeHoldMinor: bigint;
  reconciliationStatus: string;
  manualReviewReason: string | null;
  version: bigint;
  createdAt: Date;
  updatedAt: Date;
};

type OperationRow = {
  id: string;
  tenantId: string;
  dealId: string;
  paymentId: string;
  paymentTermsId: string;
  operationType: SettlementOperationType;
  status: string;
  amountMinor: bigint;
  currency: string;
  beneficiaryId: string | null;
  requiredPartnerId: string;
  requestFingerprint: string;
  commandId: string;
  idempotencyKey: string;
  expectedPaymentVersion: bigint;
  bankRef: string | null;
  callbackEventId: string | null;
  callbackKeyId: string | null;
  callbackPayloadFingerprint: string | null;
  createdAt: Date;
};

type CallbackRow = {
  eventId: string;
  dealId: string;
  operationId: string;
  partnerId: string;
  keyId: string;
  callbackStatus: BankCallbackStatus;
  payloadFingerprint: string;
  bankRef: string;
};

type HoldRow = {
  id: string;
  tenantId: string;
  dealId: string;
  paymentId: string;
  amountMinor: bigint;
  status: string;
  requestFingerprint: string;
  version: bigint;
};

type JsonRecord = Record<string, unknown>;

const WRITE_ROLES = new Set<Role>([
  Role.BUYER,
  Role.ACCOUNTING,
  Role.ADMIN,
  Role.SUPPORT_MANAGER,
]);
const OVERSIGHT_ROLES = new Set<Role>([
  Role.ACCOUNTING,
  Role.ADMIN,
  Role.SUPPORT_MANAGER,
]);
const MAX_MINOR_UNITS = 9_223_372_036_854_775_807n;

function stable(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as JsonRecord)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, stable(item)]),
    );
  }
  return value;
}

function digest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

function identifier(value: unknown, field: string): string {
  const normalized = String(value ?? '').trim();
  if (!normalized || normalized.length > 240 || !/^[A-Za-z0-9:_.-]+$/.test(normalized)) {
    throw new BadRequestException({ code: 'INVALID_IDENTIFIER', field });
  }
  return normalized;
}

function text(value: unknown, field: string, min = 1, max = 500): string {
  const normalized = String(value ?? '').normalize('NFKC').trim();
  if (
    normalized.length < min
    || normalized.length > max
    || /[\u0000-\u001f\u007f]/.test(normalized)
  ) {
    throw new BadRequestException({ code: 'INVALID_TEXT', field });
  }
  return normalized;
}

function currency(value: unknown): string {
  const normalized = String(value ?? 'RUB').trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalized)) {
    throw new BadRequestException({ code: 'INVALID_CURRENCY' });
  }
  return normalized;
}

function minorUnits(value: unknown, field: string, allowZero = false): bigint {
  let result: bigint;
  try {
    if (typeof value === 'bigint') result = value;
    else if (typeof value === 'number') {
      if (!Number.isSafeInteger(value)) throw new Error('unsafe');
      result = BigInt(value);
    } else {
      const normalized = String(value ?? '').trim();
      if (!/^-?\d+$/.test(normalized)) throw new Error('invalid');
      result = BigInt(normalized);
    }
  } catch {
    throw new BadRequestException({ code: 'INVALID_MINOR_UNITS', field });
  }
  if ((allowZero ? result < 0n : result <= 0n) || result > MAX_MINOR_UNITS) {
    throw new BadRequestException({
      code: result > MAX_MINOR_UNITS ? 'MINOR_UNITS_OVERFLOW' : 'MINOR_UNITS_MUST_BE_POSITIVE',
      field,
    });
  }
  return result;
}

function optionalVersion(value: unknown, field: string): bigint | null {
  if (value === undefined || value === null || value === '') return null;
  return minorUnits(value, field, true);
}

function jsonSafe<T>(value: T): T {
  return stable(value) as T;
}

function isUniqueConstraintError(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code === 'P2002') return true;
  if (error.code !== 'P2010') return false;
  const meta = error.meta as Record<string, unknown> | undefined;
  return meta?.code === '23505';
}

@Injectable()
export class SettlementPostgresqlRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rls: RlsTransactionService,
  ) {}

  async configureTerms(input: ConfigureSettlementTermsInput, user: RequestUser) {
    this.assertWriteRole(user);
    const normalized = this.normalizeTerms(input);
    const fingerprint = digest({ action: 'settlement.terms.configure', ...normalized });

    return this.rls.withTrustedContext(
      user,
      async (tx, context) => {
        await this.lockDeal(tx, normalized.dealId);
        const replay = await this.findTermsByIdempotency(tx, normalized.idempotencyKey);
        if (replay) {
          this.assertFingerprint(replay.requestFingerprint, fingerprint, 'SETTLEMENT_TERMS_REPLAY_MISMATCH');
          return { ...jsonSafe(replay), duplicate: true };
        }

        const deal = await this.requireDeal(tx, normalized.dealId, context);
        const payment = await this.findPayment(tx, deal.id, true);
        if (payment) {
          throw new ConflictException({
            code: 'PAYMENT_TERMS_ALREADY_CONSUMED',
            message: 'Payment terms cannot be replaced after the settlement aggregate exists.',
          });
        }

        const latest = await this.latestTerms(tx, deal.id);
        const version = (latest?.version ?? 0n) + 1n;
        const termsId = `settlement-terms:${deal.id}:v${version}`;

        await tx.$executeRaw(Prisma.sql`
          INSERT INTO settlement.payment_terms (
            id, tenant_id, deal_id, version, currency, reserve_amount_minor,
            release_basis, status, supersedes_id, command_id, idempotency_key,
            request_fingerprint, created_by_user_id, created_by_org_id
          ) VALUES (
            ${termsId}, ${context.tenantId}, ${deal.id}, ${version}, ${normalized.currency},
            ${normalized.reserveAmountMinor}, ${JSON.stringify(normalized.releaseBasis)}::jsonb,
            'ISSUED', ${latest?.id ?? null}, ${normalized.commandId}, ${normalized.idempotencyKey},
            ${fingerprint}, ${context.userId}, ${context.orgId}
          )
        `);

        for (const [index, beneficiary] of normalized.beneficiaries.entries()) {
          await tx.$executeRaw(Prisma.sql`
            INSERT INTO settlement.beneficiaries (
              id, tenant_id, deal_id, payment_terms_id, beneficiary_org_id,
              beneficiary_role, allocation_minor, priority, destination_ref,
              command_id, idempotency_key
            ) VALUES (
              ${`settlement-beneficiary:${termsId}:${index}`}, ${context.tenantId}, ${deal.id},
              ${termsId}, ${beneficiary.organizationId}, ${beneficiary.role},
              ${beneficiary.allocationMinor}, ${beneficiary.priority}, ${beneficiary.destinationRef},
              ${normalized.commandId}, ${`${normalized.idempotencyKey}:beneficiary:${index}`}
            )
          `);
        }

        const audit = await this.appendAudit(tx, context, {
          dealId: deal.id,
          action: 'settlement.terms.configured',
          objectType: 'settlement_payment_terms',
          objectId: termsId,
          beforeState: latest ? { termsId: latest.id, version: latest.version.toString() } : {},
          afterState: {
            termsId,
            version: version.toString(),
            reserveAmountKopecks: normalized.reserveAmountMinor.toString(),
            beneficiaryCount: normalized.beneficiaries.length,
          },
          correlationId: normalized.commandId,
        });
        await this.appendReceipt(tx, {
          dealId: deal.id,
          idempotencyKey: `settlement-receipt:${normalized.idempotencyKey}`,
          correlationId: normalized.commandId,
          auditId: audit.id,
          result: { termsId, version: version.toString(), duplicate: false },
        });

        return {
          termsId,
          dealId: deal.id,
          version: version.toString(),
          reserveAmountKopecks: normalized.reserveAmountMinor.toString(),
          beneficiaries: normalized.beneficiaries.map((item, index) => ({
            id: `settlement-beneficiary:${termsId}:${index}`,
            organizationId: item.organizationId,
            role: item.role,
            allocationKopecks: item.allocationMinor.toString(),
            priority: item.priority,
          })),
          auditId: audit.id,
          duplicate: false,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30_000 },
    );
  }

  async requestOperation(input: RequestSettlementOperationInput, user: RequestUser) {
    this.assertOperationRole(input.operation, user);
    const normalized = this.normalizeOperation(input);
    const fingerprint = digest({ action: 'settlement.operation.request', ...normalized });

    try {
      return await this.rls.withTrustedContext(
        user,
        async (tx, context) => {
          await this.lockDeal(tx, normalized.dealId);
          const replay = await this.findOperationByIdempotency(tx, normalized.idempotencyKey);
          if (replay) {
            this.assertFingerprint(replay.requestFingerprint, fingerprint, 'SETTLEMENT_COMMAND_REPLAY_MISMATCH');
            return { ...this.operationResult(replay), duplicate: true };
          }

          const deal = await this.requireDeal(tx, normalized.dealId, context);
          this.assertExpectedVersion(deal.version, normalized.expectedDealVersion, 'STALE_DEAL_VERSION');
          const terms = await this.ensureTerms(tx, deal, context, normalized, fingerprint);
          let payment = await this.findPayment(tx, deal.id, true);
          if (!payment) {
            payment = await this.createPayment(tx, deal, terms, context);
          }
          this.assertExpectedVersion(payment.version, normalized.expectedPaymentVersion, 'STALE_PAYMENT_VERSION');

          const beneficiary = normalized.beneficiaryId
            ? await this.requireBeneficiary(tx, terms.id, normalized.beneficiaryId)
            : null;
          const amount = await this.resolveOperationAmount(
            tx,
            normalized.operation,
            normalized.amountMinor,
            terms,
            payment,
            beneficiary,
          );
          const operationId = `settlement-${normalized.operation.toLowerCase()}:${randomUUID()}`;
          const paymentAfter = this.pendingPayment(payment, normalized.operation, amount);

          const paymentUpdate = await tx.$executeRaw(Prisma.sql`
            UPDATE settlement.payments
            SET status = ${paymentAfter.status},
                pending_reserved_minor = ${paymentAfter.pendingReservedMinor},
                pending_released_minor = ${paymentAfter.pendingReleasedMinor},
                pending_refunded_minor = ${paymentAfter.pendingRefundedMinor},
                version = version + 1
            WHERE id = ${payment.id} AND version = ${payment.version}
          `);
          if (paymentUpdate !== 1) {
            throw new ConflictException({ code: 'CONCURRENT_PAYMENT_UPDATE' });
          }

          await tx.$executeRaw(Prisma.sql`
            INSERT INTO settlement.bank_operations (
              id, tenant_id, deal_id, payment_id, payment_terms_id, operation_type,
              status, amount_minor, currency, beneficiary_id, required_partner_id,
              request_fingerprint, command_id, idempotency_key, expected_payment_version,
              request_payload, initiated_by_user_id
            ) VALUES (
              ${operationId}, ${context.tenantId}, ${deal.id}, ${payment.id}, ${terms.id},
              ${normalized.operation}, 'PENDING', ${amount}, ${terms.currency},
              ${beneficiary?.id ?? null}, ${normalized.partnerId}, ${fingerprint},
              ${normalized.commandId}, ${normalized.idempotencyKey}, ${payment.version},
              ${JSON.stringify({
                dealId: deal.id,
                operation: normalized.operation,
                amountKopecks: amount.toString(),
                beneficiaryId: beneficiary?.id ?? null,
                paymentVersion: payment.version.toString(),
              })}::jsonb,
              ${context.userId}
            )
          `);

          const transition = this.requestDealTransition(normalized.operation);
          let updatedDeal = deal;
          if (transition) {
            if (deal.status !== transition.from) {
              throw new ConflictException({
                code: 'DEAL_STATE_CONFLICT',
                expectedStatus: transition.from,
                currentStatus: deal.status,
              });
            }
            const dealUpdated = await tx.deal.updateMany({
              where: { id: deal.id, status: transition.from, version: deal.version },
              data: {
                status: transition.to,
                nextAction: transition.nextAction,
                version: { increment: 1 },
              },
            });
            if (dealUpdated.count !== 1) {
              throw new ConflictException({ code: 'CONCURRENT_DEAL_UPDATE' });
            }
            updatedDeal = await tx.deal.findUniqueOrThrow({ where: { id: deal.id } }) as DealRow;
          }

          const event = await this.appendDealEvent(tx, {
            dealId: deal.id,
            tenantId: context.tenantId,
            actorId: context.userId,
            actorRole: context.role,
            eventType: `SETTLEMENT_${normalized.operation}_REQUESTED`,
            payload: {
              commandId: normalized.commandId,
              operationId,
              amountKopecks: amount.toString(),
              beneficiaryId: beneficiary?.id ?? null,
              paymentVersion: (payment.version + 1n).toString(),
            },
          });
          const audit = await this.appendAudit(tx, context, {
            dealId: deal.id,
            action: `settlement.${normalized.operation.toLowerCase()}.requested`,
            objectType: 'settlement_bank_operation',
            objectId: operationId,
            beforeState: this.paymentState(payment),
            afterState: {
              ...this.paymentState(paymentAfter),
              version: (payment.version + 1n).toString(),
            },
            correlationId: normalized.commandId,
            metadata: { eventId: event.id },
          });

          await tx.outboxEntry.create({
            data: {
              type: `BANK_${normalized.operation}_REQUEST`,
              dealId: deal.id,
              status: 'PENDING',
              idempotencyKey: `settlement-bank-request:${operationId}`,
              correlationId: normalized.commandId,
              auditId: audit.id,
              payload: {
                dealId: deal.id,
                operationId,
                operation: normalized.operation,
                amountKopecks: amount.toString(),
                beneficiaryId: beneficiary?.id ?? null,
                partnerId: normalized.partnerId,
                requestFingerprint: fingerprint,
              },
            },
          });

          await this.writePublicRequestProjection(tx, context, {
            deal,
            operationId,
            operation: normalized.operation,
            amount,
            beneficiaryId: beneficiary?.id ?? null,
            commandId: normalized.commandId,
            paymentStatus: this.publicPaymentStatus(paymentAfter.status),
            termsReserve: terms.reserveAmountMinor,
          });

          return {
            ok: true,
            duplicate: false,
            dealId: deal.id,
            dealStatus: updatedDeal.status,
            dealVersion: updatedDeal.version.toString(),
            paymentId: payment.id,
            paymentVersion: (payment.version + 1n).toString(),
            operationId,
            operation: normalized.operation,
            status: 'PENDING',
            amountKopecks: amount.toString(),
            beneficiaryId: beneficiary?.id ?? null,
            outboxStatus: 'PENDING',
            auditId: audit.id,
            eventId: event.id,
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30_000 },
      );
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return this.rls.withTrustedContext(user, async (tx) => {
          const replay = await this.findOperationByIdempotency(tx, normalized.idempotencyKey);
          if (!replay) throw error;
          this.assertFingerprint(replay.requestFingerprint, fingerprint, 'SETTLEMENT_COMMAND_REPLAY_MISMATCH');
          return { ...this.operationResult(replay), duplicate: true };
        });
      }
      throw error;
    }
  }

  async placeHold(input: PlaceSettlementHoldInput, user: RequestUser) {
    this.assertOversightRole(user);
    const normalized = {
      commandId: identifier(input.commandId, 'commandId'),
      idempotencyKey: identifier(input.idempotencyKey, 'idempotencyKey'),
      dealId: identifier(input.dealId, 'dealId'),
      amountMinor: minorUnits(input.amountKopecks, 'amountKopecks'),
      basisType: String(input.basisType ?? '').toUpperCase(),
      basisId: identifier(input.basisId, 'basisId'),
      reason: text(input.reason, 'reason', 5, 500),
      expectedPaymentVersion: optionalVersion(input.expectedPaymentVersion, 'expectedPaymentVersion'),
    };
    if (!['DISPUTE', 'COMPLIANCE', 'DOCUMENT', 'OTHER'].includes(normalized.basisType)) {
      throw new BadRequestException({ code: 'INVALID_HOLD_BASIS' });
    }
    const fingerprint = digest({ action: 'settlement.hold.place', ...normalized });

    return this.rls.withTrustedContext(
      user,
      async (tx, context) => {
        await this.lockDeal(tx, normalized.dealId);
        const replay = await this.findHoldByIdempotency(tx, normalized.idempotencyKey);
        if (replay) {
          this.assertFingerprint(replay.requestFingerprint, fingerprint, 'SETTLEMENT_HOLD_REPLAY_MISMATCH');
          return { ...jsonSafe(replay), duplicate: true };
        }
        await this.requireDeal(tx, normalized.dealId, context);
        const payment = await this.requirePayment(tx, normalized.dealId, true);
        this.assertExpectedVersion(payment.version, normalized.expectedPaymentVersion, 'STALE_PAYMENT_VERSION');
        const available = this.availableMinor(payment);
        if (normalized.amountMinor > available) {
          throw new ConflictException({
            code: 'HOLD_EXCEEDS_AVAILABLE_FUNDS',
            availableKopecks: available.toString(),
          });
        }
        const holdId = `settlement-hold:${randomUUID()}`;
        await tx.$executeRaw(Prisma.sql`
          INSERT INTO settlement.holds (
            id, tenant_id, deal_id, payment_id, amount_minor, status, basis_type,
            basis_id, reason, command_id, idempotency_key, request_fingerprint,
            created_by_user_id
          ) VALUES (
            ${holdId}, ${context.tenantId}, ${normalized.dealId}, ${payment.id},
            ${normalized.amountMinor}, 'ACTIVE', ${normalized.basisType}, ${normalized.basisId},
            ${normalized.reason}, ${normalized.commandId}, ${normalized.idempotencyKey},
            ${fingerprint}, ${context.userId}
          )
        `);
        const updated = await tx.$executeRaw(Prisma.sql`
          UPDATE settlement.payments
          SET active_hold_minor = active_hold_minor + ${normalized.amountMinor},
              status = 'HOLD_ACTIVE', version = version + 1
          WHERE id = ${payment.id} AND version = ${payment.version}
        `);
        if (updated !== 1) throw new ConflictException({ code: 'CONCURRENT_PAYMENT_UPDATE' });

        const audit = await this.appendAudit(tx, context, {
          dealId: normalized.dealId,
          action: 'settlement.hold.placed',
          objectType: 'settlement_hold',
          objectId: holdId,
          beforeState: this.paymentState(payment),
          afterState: {
            activeHoldKopecks: (payment.activeHoldMinor + normalized.amountMinor).toString(),
            version: (payment.version + 1n).toString(),
          },
          correlationId: normalized.commandId,
        });
        await this.writePublicPaymentProjection(tx, normalized.dealId, {
          status: 'HOLD_ACTIVE',
          amountKopecks: payment.confirmedReservedMinor,
          holdAmountKopecks: payment.activeHoldMinor + normalized.amountMinor,
          callbackState: 'CONFIRMED',
        });
        await this.appendReceipt(tx, {
          dealId: normalized.dealId,
          idempotencyKey: `settlement-receipt:${normalized.idempotencyKey}`,
          correlationId: normalized.commandId,
          auditId: audit.id,
          result: { holdId, duplicate: false },
        });
        return {
          holdId,
          dealId: normalized.dealId,
          amountKopecks: normalized.amountMinor.toString(),
          paymentVersion: (payment.version + 1n).toString(),
          auditId: audit.id,
          duplicate: false,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30_000 },
    );
  }

  async releaseHold(input: ReleaseSettlementHoldInput, user: RequestUser) {
    this.assertOversightRole(user);
    const normalized = {
      commandId: identifier(input.commandId, 'commandId'),
      idempotencyKey: identifier(input.idempotencyKey, 'idempotencyKey'),
      holdId: identifier(input.holdId, 'holdId'),
      dealId: identifier(input.dealId, 'dealId'),
      expectedPaymentVersion: optionalVersion(input.expectedPaymentVersion, 'expectedPaymentVersion'),
    };

    return this.rls.withTrustedContext(
      user,
      async (tx, context) => {
        await this.lockDeal(tx, normalized.dealId);
        await this.requireDeal(tx, normalized.dealId, context);
        const hold = await this.requireHold(tx, normalized.holdId, true);
        if (hold.dealId !== normalized.dealId) {
          throw new ForbiddenException({ code: 'HOLD_DEAL_SCOPE_DENIED' });
        }
        if (hold.status === 'RELEASED') {
          return { holdId: hold.id, duplicate: true };
        }
        const payment = await this.requirePayment(tx, normalized.dealId, true);
        this.assertExpectedVersion(payment.version, normalized.expectedPaymentVersion, 'STALE_PAYMENT_VERSION');
        if (payment.activeHoldMinor < hold.amountMinor) {
          throw new ConflictException({ code: 'PAYMENT_HOLD_BALANCE_CORRUPTED' });
        }

        await tx.$executeRaw(Prisma.sql`
          UPDATE settlement.holds
          SET status = 'RELEASED', released_by_user_id = ${context.userId},
              released_at = now(), version = version + 1
          WHERE id = ${hold.id} AND status = 'ACTIVE' AND version = ${hold.version}
        `);
        const nextHold = payment.activeHoldMinor - hold.amountMinor;
        const nextStatus = nextHold > 0n ? 'HOLD_ACTIVE' : this.restingStatus(payment);
        const updated = await tx.$executeRaw(Prisma.sql`
          UPDATE settlement.payments
          SET active_hold_minor = ${nextHold}, status = ${nextStatus}, version = version + 1
          WHERE id = ${payment.id} AND version = ${payment.version}
        `);
        if (updated !== 1) throw new ConflictException({ code: 'CONCURRENT_PAYMENT_UPDATE' });

        const audit = await this.appendAudit(tx, context, {
          dealId: normalized.dealId,
          action: 'settlement.hold.released',
          objectType: 'settlement_hold',
          objectId: hold.id,
          beforeState: { status: hold.status, activeHoldKopecks: payment.activeHoldMinor.toString() },
          afterState: { status: 'RELEASED', activeHoldKopecks: nextHold.toString() },
          correlationId: normalized.commandId,
        });
        await this.writePublicPaymentProjection(tx, normalized.dealId, {
          status: this.publicPaymentStatus(nextStatus),
          amountKopecks: payment.confirmedReservedMinor,
          holdAmountKopecks: nextHold,
          callbackState: 'CONFIRMED',
        });
        await this.appendReceipt(tx, {
          dealId: normalized.dealId,
          idempotencyKey: `settlement-receipt:${normalized.idempotencyKey}`,
          correlationId: normalized.commandId,
          auditId: audit.id,
          result: { holdId: hold.id, duplicate: false },
        });
        return {
          holdId: hold.id,
          dealId: normalized.dealId,
          paymentVersion: (payment.version + 1n).toString(),
          auditId: audit.id,
          duplicate: false,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30_000 },
    );
  }

  async registerVerifiedCallback(input: VerifiedSettlementCallbackInput) {
    const normalized = this.normalizeCallback(input);
    const scopes = await this.prisma.$queryRaw<Array<{ tenantId: string; buyerOrgId: string }>>`
      SELECT "tenantId", "buyerOrgId"
      FROM public.app_bank_callback_scope(${normalized.dealId}, ${normalized.operationId})
    `;
    const scope = scopes[0];
    if (!scope?.tenantId || !scope.buyerOrgId) {
      throw new ConflictException({ code: 'BANK_OPERATION_NOT_PENDING' });
    }
    const callbackUser: RequestUser = {
      id: `bank-callback:${normalized.partnerId}`,
      email: 'bank-callback@system.invalid',
      fullName: 'Verified bank callback',
      role: Role.BANK_CALLBACK,
      orgId: scope.buyerOrgId,
      tenantId: scope.tenantId,
      sessionId: `bank-event:${normalized.eventId}`,
      mfaVerified: true,
    };

    try {
      return await this.rls.withTrustedContext(
        callbackUser,
        async (tx, context) => {
          await this.lockDeal(tx, normalized.dealId);
          const replay = await this.findCallback(tx, normalized.partnerId, normalized.eventId);
          if (replay) {
            this.assertCallbackReplay(replay, normalized);
            return {
              ok: replay.callbackStatus === 'SUCCESS',
              dealId: replay.dealId,
              operationId: replay.operationId,
              eventId: replay.eventId,
              status: replay.callbackStatus,
              bankRef: replay.bankRef,
              duplicate: true,
            };
          }

          const operation = await this.requireOperation(tx, normalized.operationId, true);
          if (
            operation.dealId !== normalized.dealId
            || operation.operationType !== normalized.operation
            || operation.status !== 'PENDING'
            || operation.requiredPartnerId !== normalized.partnerId
          ) {
            throw new ConflictException({ code: 'BANK_CALLBACK_OPERATION_MISMATCH' });
          }
          const payment = await this.requirePayment(tx, normalized.dealId, true);
          if (payment.id !== operation.paymentId) {
            throw new ConflictException({ code: 'BANK_CALLBACK_PAYMENT_MISMATCH' });
          }

          await tx.$executeRaw(Prisma.sql`
            INSERT INTO settlement.bank_callbacks (
              id, event_id, tenant_id, deal_id, operation_id, partner_id, key_id,
              callback_status, payload_fingerprint, bank_ref, payload
            ) VALUES (
              ${`settlement-callback:${normalized.partnerId}:${normalized.eventId}`},
              ${normalized.eventId}, ${context.tenantId}, ${normalized.dealId},
              ${normalized.operationId}, ${normalized.partnerId}, ${normalized.keyId},
              ${normalized.status}, ${normalized.payloadFingerprint}, ${normalized.bankRef},
              ${JSON.stringify(normalized.payload)}::jsonb
            )
          `);

          const counters = this.callbackPayment(payment, operation, normalized.status);
          const paymentUpdated = await tx.$executeRaw(Prisma.sql`
            UPDATE settlement.payments
            SET status = ${counters.status},
                confirmed_reserved_minor = ${counters.confirmedReservedMinor},
                pending_reserved_minor = ${counters.pendingReservedMinor},
                confirmed_released_minor = ${counters.confirmedReleasedMinor},
                pending_released_minor = ${counters.pendingReleasedMinor},
                confirmed_refunded_minor = ${counters.confirmedRefundedMinor},
                pending_refunded_minor = ${counters.pendingRefundedMinor},
                version = version + 1
            WHERE id = ${payment.id} AND version = ${payment.version}
          `);
          if (paymentUpdated !== 1) {
            throw new ConflictException({ code: 'CONCURRENT_PAYMENT_UPDATE' });
          }

          await tx.$executeRaw(Prisma.sql`
            UPDATE settlement.bank_operations
            SET status = ${normalized.status === 'SUCCESS' ? 'CONFIRMED' : 'FAILED'},
                bank_ref = ${normalized.bankRef},
                failure_reason = ${normalized.status === 'FAILED' ? normalized.errorMessage : null},
                callback_event_id = ${normalized.eventId},
                callback_key_id = ${normalized.keyId},
                callback_payload_fingerprint = ${normalized.payloadFingerprint},
                response_payload = ${JSON.stringify(normalized.payload)}::jsonb,
                confirmed_at = ${normalized.status === 'SUCCESS' ? new Date() : null},
                failed_at = ${normalized.status === 'FAILED' ? new Date() : null}
            WHERE id = ${operation.id} AND status = 'PENDING'
          `);

          let ledgerId: string | null = null;
          if (normalized.status === 'SUCCESS') {
            ledgerId = await this.appendSettlementLedger(tx, context, operation);
          }

          const deal = await this.requireDeal(tx, normalized.dealId, context);
          let updatedDeal = deal;
          const confirmedTransition = this.confirmedDealTransition(
            operation.operationType,
            counters,
          );
          if (confirmedTransition && deal.status === confirmedTransition.from) {
            const update = await tx.deal.updateMany({
              where: { id: deal.id, status: confirmedTransition.from, version: deal.version },
              data: {
                status: confirmedTransition.to,
                nextAction: confirmedTransition.nextAction,
                version: { increment: 1 },
              },
            });
            if (update.count !== 1) {
              throw new ConflictException({ code: 'CONCURRENT_DEAL_UPDATE' });
            }
            updatedDeal = await tx.deal.findUniqueOrThrow({ where: { id: deal.id } }) as DealRow;
          }

          const event = await this.appendDealEvent(tx, {
            dealId: deal.id,
            tenantId: context.tenantId,
            actorId: context.userId,
            actorRole: context.role,
            eventType: `SETTLEMENT_${operation.operationType}_CALLBACK_${normalized.status}`,
            payload: {
              eventId: normalized.eventId,
              operationId: operation.id,
              partnerId: normalized.partnerId,
              keyId: normalized.keyId,
              payloadFingerprint: normalized.payloadFingerprint,
              bankRef: normalized.bankRef,
              ledgerId,
            },
          });
          const audit = await this.appendAudit(tx, context, {
            dealId: deal.id,
            action: `settlement.${operation.operationType.toLowerCase()}.callback.${normalized.status.toLowerCase()}`,
            objectType: 'settlement_bank_operation',
            objectId: operation.id,
            beforeState: this.paymentState(payment),
            afterState: {
              ...this.paymentState(counters),
              version: (payment.version + 1n).toString(),
              bankRef: normalized.bankRef,
            },
            correlationId: normalized.eventId,
            metadata: { eventId: event.id, ledgerId },
          });

          await tx.outboxEntry.updateMany({
            where: { idempotencyKey: `settlement-bank-request:${operation.id}` },
            data: normalized.status === 'SUCCESS'
              ? { status: 'CONFIRMED', confirmedAt: new Date() }
              : { status: 'FAILED', failedAt: new Date(), lastError: normalized.errorMessage },
          });
          await this.appendReceipt(tx, {
            dealId: deal.id,
            idempotencyKey: `settlement-callback-receipt:${normalized.partnerId}:${normalized.eventId}`,
            correlationId: normalized.eventId,
            auditId: audit.id,
            result: {
              operationId: operation.id,
              eventId: normalized.eventId,
              status: normalized.status,
              bankRef: normalized.bankRef,
            },
          });
          await this.writePublicCallbackProjection(tx, context, {
            deal,
            operation,
            counters,
            status: normalized.status,
            bankRef: normalized.bankRef,
            errorMessage: normalized.errorMessage,
          });

          return {
            ok: normalized.status === 'SUCCESS',
            duplicate: false,
            dealId: deal.id,
            dealStatus: updatedDeal.status,
            dealVersion: updatedDeal.version.toString(),
            paymentId: payment.id,
            paymentVersion: (payment.version + 1n).toString(),
            operationId: operation.id,
            operation: operation.operationType,
            eventId: normalized.eventId,
            status: normalized.status,
            bankRef: normalized.bankRef,
            ledgerId,
            auditId: audit.id,
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30_000 },
      );
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
      return this.rls.withTrustedContext(callbackUser, async (tx) => {
        const replay = await this.findCallback(tx, normalized.partnerId, normalized.eventId);
        if (!replay) throw error;
        this.assertCallbackReplay(replay, normalized);
        return {
          ok: replay.callbackStatus === 'SUCCESS',
          dealId: replay.dealId,
          operationId: replay.operationId,
          eventId: replay.eventId,
          status: replay.callbackStatus,
          bankRef: replay.bankRef,
          duplicate: true,
        };
      });
    }
  }

  async reconcileOperation(input: ReconcileSettlementOperationInput, user: RequestUser) {
    this.assertOversightRole(user);
    const normalized = {
      commandId: identifier(input.commandId, 'commandId'),
      idempotencyKey: identifier(input.idempotencyKey, 'idempotencyKey'),
      dealId: identifier(input.dealId, 'dealId'),
      operationId: identifier(input.operationId, 'operationId'),
      statementEntryId: input.statementEntryId
        ? identifier(input.statementEntryId, 'statementEntryId')
        : null,
      observedAmountMinor: minorUnits(input.observedAmountKopecks, 'observedAmountKopecks', true),
      reason: input.reason ? text(input.reason, 'reason', 1, 500) : null,
      expectedPaymentVersion: optionalVersion(input.expectedPaymentVersion, 'expectedPaymentVersion'),
    };
    const fingerprint = digest({ action: 'settlement.reconcile', ...normalized });

    return this.rls.withTrustedContext(
      user,
      async (tx, context) => {
        await this.lockDeal(tx, normalized.dealId);
        const existing = await tx.$queryRaw<Array<{
          id: string;
          verdict: string;
          payloadFingerprint: string;
        }>>(Prisma.sql`
          SELECT id, verdict, payload_fingerprint AS "payloadFingerprint"
          FROM settlement.reconciliation_facts
          WHERE idempotency_key = ${normalized.idempotencyKey}
        `);
        if (existing[0]) {
          this.assertFingerprint(existing[0].payloadFingerprint, fingerprint, 'RECONCILIATION_REPLAY_MISMATCH');
          return { ...existing[0], duplicate: true };
        }
        await this.requireDeal(tx, normalized.dealId, context);
        const operation = await this.requireOperation(tx, normalized.operationId, true);
        if (operation.dealId !== normalized.dealId) {
          throw new ForbiddenException({ code: 'RECONCILIATION_DEAL_SCOPE_DENIED' });
        }
        const payment = await this.requirePayment(tx, normalized.dealId, true);
        this.assertExpectedVersion(payment.version, normalized.expectedPaymentVersion, 'STALE_PAYMENT_VERSION');
        const verdict = normalized.observedAmountMinor === operation.amountMinor ? 'MATCH' : 'MISMATCH';
        const factId = `settlement-reconciliation:${randomUUID()}`;
        await tx.$executeRaw(Prisma.sql`
          INSERT INTO settlement.reconciliation_facts (
            id, tenant_id, deal_id, operation_id, statement_entry_id, verdict,
            expected_amount_minor, observed_amount_minor, reason, payload_fingerprint,
            idempotency_key, created_by_user_id
          ) VALUES (
            ${factId}, ${context.tenantId}, ${normalized.dealId}, ${operation.id},
            ${normalized.statementEntryId}, ${verdict}, ${operation.amountMinor},
            ${normalized.observedAmountMinor}, ${normalized.reason}, ${fingerprint},
            ${normalized.idempotencyKey}, ${context.userId}
          )
        `);

        if (verdict === 'MISMATCH') {
          if (!['PENDING', 'CONFIRMED'].includes(operation.status)) {
            throw new ConflictException({ code: 'RECONCILIATION_OPERATION_NOT_REVIEWABLE' });
          }
          await tx.$executeRaw(Prisma.sql`
            UPDATE settlement.bank_operations
            SET status = 'MANUAL_REVIEW',
                failure_reason = ${normalized.reason ?? 'reconciliation_amount_mismatch'}
            WHERE id = ${operation.id} AND status = ${operation.status}
          `);
          const updated = await tx.$executeRaw(Prisma.sql`
            UPDATE settlement.payments
            SET status = 'MANUAL_REVIEW', reconciliation_status = 'MANUAL_REVIEW',
                manual_review_reason = ${normalized.reason ?? 'reconciliation_amount_mismatch'},
                version = version + 1
            WHERE id = ${payment.id} AND version = ${payment.version}
          `);
          if (updated !== 1) throw new ConflictException({ code: 'CONCURRENT_PAYMENT_UPDATE' });
          await this.writePublicPaymentProjection(tx, normalized.dealId, {
            status: 'MANUAL_REVIEW',
            amountKopecks: payment.confirmedReservedMinor,
            holdAmountKopecks: payment.activeHoldMinor,
            callbackState: 'MANUAL_REVIEW',
          });
          await this.writePublicOperationStatus(tx, operation.id, 'MANUAL_REVIEW', normalized.reason);
        } else {
          const updated = await tx.$executeRaw(Prisma.sql`
            UPDATE settlement.payments
            SET reconciliation_status = 'MATCHED', manual_review_reason = NULL,
                version = version + 1
            WHERE id = ${payment.id} AND version = ${payment.version}
          `);
          if (updated !== 1) throw new ConflictException({ code: 'CONCURRENT_PAYMENT_UPDATE' });
        }

        const audit = await this.appendAudit(tx, context, {
          dealId: normalized.dealId,
          action: `settlement.reconciliation.${verdict.toLowerCase()}`,
          objectType: 'settlement_reconciliation_fact',
          objectId: factId,
          beforeState: {
            operationStatus: operation.status,
            paymentVersion: payment.version.toString(),
          },
          afterState: {
            verdict,
            expectedAmountKopecks: operation.amountMinor.toString(),
            observedAmountKopecks: normalized.observedAmountMinor.toString(),
            paymentVersion: (payment.version + 1n).toString(),
          },
          correlationId: normalized.commandId,
        });
        return {
          factId,
          verdict,
          operationId: operation.id,
          expectedAmountKopecks: operation.amountMinor.toString(),
          observedAmountKopecks: normalized.observedAmountMinor.toString(),
          paymentVersion: (payment.version + 1n).toString(),
          manualReview: verdict === 'MISMATCH',
          auditId: audit.id,
          duplicate: false,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30_000 },
    );
  }

  async worksheet(dealId: string, user: RequestUser) {
    const normalizedDealId = identifier(dealId, 'dealId');
    return this.rls.withTrustedContext(user, async (tx, context) => {
      const deal = await this.requireDeal(tx, normalizedDealId, context);
      const [terms, payment, beneficiaries, holds, operations, ledger] = await Promise.all([
        this.latestTerms(tx, deal.id),
        this.findPayment(tx, deal.id, false),
        tx.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
          SELECT id, beneficiary_org_id AS "organizationId", beneficiary_role AS role,
                 allocation_minor AS "allocationKopecks", priority, destination_ref AS "destinationRef"
          FROM settlement.beneficiaries
          WHERE deal_id = ${deal.id}
          ORDER BY priority, id
        `),
        tx.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
          SELECT id, amount_minor AS "amountKopecks", status, basis_type AS "basisType",
                 basis_id AS "basisId", reason, created_at AS "createdAt", released_at AS "releasedAt"
          FROM settlement.holds
          WHERE deal_id = ${deal.id}
          ORDER BY created_at, id
        `),
        tx.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
          SELECT id, operation_type AS operation, status, amount_minor AS "amountKopecks",
                 beneficiary_id AS "beneficiaryId", required_partner_id AS "partnerId",
                 bank_ref AS "bankRef", callback_event_id AS "callbackEventId",
                 callback_key_id AS "callbackKeyId", created_at AS "createdAt"
          FROM settlement.bank_operations
          WHERE deal_id = ${deal.id}
          ORDER BY created_at, id
        `),
        tx.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
          SELECT id, entry_type AS "entryType", debit_account AS "debitAccount",
                 credit_account AS "creditAccount", amount_minor AS "amountKopecks",
                 operation_id AS "operationId", prev_hash AS "prevHash", hash, created_at AS "createdAt"
          FROM settlement.ledger_entries
          WHERE deal_id = ${deal.id}
          ORDER BY created_at, id
        `),
      ]);
      return jsonSafe({
        dealId: deal.id,
        dealStatus: deal.status,
        dealVersion: deal.version,
        terms,
        payment,
        beneficiaries,
        holds,
        operations,
        ledger,
        availableKopecks: payment ? this.availableMinor(payment) : 0n,
      });
    });
  }

  async bankWorkspace(dealId: string, user: RequestUser) {
    const worksheet = await this.worksheet(dealId, user) as Record<string, unknown>;
    return {
      dealId: worksheet.dealId,
      payment: worksheet.payment,
      beneficiaries: worksheet.beneficiaries,
      holds: worksheet.holds,
      operations: worksheet.operations,
      availableKopecks: worksheet.availableKopecks,
    };
  }

  async listPayments(user: RequestUser, take = 100) {
    const bounded = Math.min(Math.max(Math.trunc(take), 1), 200);
    return this.rls.withTrustedContext(user, async (tx) => {
      const rows = await tx.$queryRaw<Array<PaymentRow>>(Prisma.sql`
        SELECT id, tenant_id AS "tenantId", deal_id AS "dealId",
               payment_terms_id AS "paymentTermsId", status, currency,
               confirmed_reserved_minor AS "confirmedReservedMinor",
               pending_reserved_minor AS "pendingReservedMinor",
               confirmed_released_minor AS "confirmedReleasedMinor",
               pending_released_minor AS "pendingReleasedMinor",
               confirmed_refunded_minor AS "confirmedRefundedMinor",
               pending_refunded_minor AS "pendingRefundedMinor",
               active_hold_minor AS "activeHoldMinor",
               reconciliation_status AS "reconciliationStatus",
               manual_review_reason AS "manualReviewReason", version,
               created_at AS "createdAt", updated_at AS "updatedAt"
        FROM settlement.payments
        ORDER BY updated_at DESC
        LIMIT ${bounded}
      `);
      return jsonSafe(rows);
    });
  }

  async paymentDetail(paymentId: string, user: RequestUser) {
    const normalized = identifier(paymentId, 'paymentId');
    return this.rls.withTrustedContext(user, async (tx) => {
      const rows = await tx.$queryRaw<Array<PaymentRow>>(Prisma.sql`
        SELECT id, tenant_id AS "tenantId", deal_id AS "dealId",
               payment_terms_id AS "paymentTermsId", status, currency,
               confirmed_reserved_minor AS "confirmedReservedMinor",
               pending_reserved_minor AS "pendingReservedMinor",
               confirmed_released_minor AS "confirmedReleasedMinor",
               pending_released_minor AS "pendingReleasedMinor",
               confirmed_refunded_minor AS "confirmedRefundedMinor",
               pending_refunded_minor AS "pendingRefundedMinor",
               active_hold_minor AS "activeHoldMinor",
               reconciliation_status AS "reconciliationStatus",
               manual_review_reason AS "manualReviewReason", version,
               created_at AS "createdAt", updated_at AS "updatedAt"
        FROM settlement.payments WHERE id = ${normalized}
      `);
      if (!rows[0]) throw new NotFoundException(`Settlement payment ${normalized} not found`);
      return jsonSafe(rows[0]);
    });
  }

  async outboxStatus(dealId: string | undefined, user: RequestUser) {
    const normalized = dealId ? identifier(dealId, 'dealId') : null;
    return this.rls.withTrustedContext(user, async (tx) => {
      const entries = await tx.outboxEntry.findMany({
        where: {
          ...(normalized ? { dealId: normalized } : {}),
          type: { startsWith: 'BANK_' },
        },
        orderBy: { createdAt: 'desc' },
        take: 200,
      });
      return jsonSafe({
        total: entries.length,
        pending: entries.filter((item) => item.status === 'PENDING'),
        failed: entries.filter((item) => item.status === 'FAILED'),
        confirmed: entries.filter((item) => item.status === 'CONFIRMED'),
      });
    });
  }

  private normalizeTerms(input: ConfigureSettlementTermsInput) {
    if (!Array.isArray(input.beneficiaries) || input.beneficiaries.length === 0) {
      throw new BadRequestException({ code: 'SETTLEMENT_BENEFICIARIES_REQUIRED' });
    }
    const reserveAmountMinor = minorUnits(input.reserveAmountKopecks, 'reserveAmountKopecks');
    const beneficiaries = input.beneficiaries.map((item, index) => ({
      organizationId: identifier(item.organizationId, `beneficiaries[${index}].organizationId`),
      role: String(item.role ?? '').toUpperCase() as SettlementBeneficiaryInput['role'],
      allocationMinor: minorUnits(item.allocationKopecks, `beneficiaries[${index}].allocationKopecks`),
      priority: Number.isInteger(item.priority ?? 0) && Number(item.priority ?? 0) >= 0
        ? Number(item.priority ?? 0)
        : (() => { throw new BadRequestException({ code: 'INVALID_BENEFICIARY_PRIORITY', index }); })(),
      destinationRef: item.destinationRef
        ? identifier(item.destinationRef, `beneficiaries[${index}].destinationRef`)
        : `organization:${identifier(item.organizationId, `beneficiaries[${index}].organizationId`)}`,
    }));
    for (const [index, item] of beneficiaries.entries()) {
      if (!['SELLER', 'CARRIER', 'PLATFORM', 'TAX', 'OTHER'].includes(item.role)) {
        throw new BadRequestException({ code: 'INVALID_BENEFICIARY_ROLE', index });
      }
    }
    const allocated = beneficiaries.reduce((sum, item) => sum + item.allocationMinor, 0n);
    if (allocated > reserveAmountMinor) {
      throw new BadRequestException({
        code: 'BENEFICIARY_ALLOCATION_EXCEEDS_RESERVE',
        reserveAmountKopecks: reserveAmountMinor.toString(),
        allocatedKopecks: allocated.toString(),
      });
    }
    return {
      commandId: identifier(input.commandId, 'commandId'),
      idempotencyKey: identifier(input.idempotencyKey, 'idempotencyKey'),
      dealId: identifier(input.dealId, 'dealId'),
      reserveAmountMinor,
      currency: currency(input.currency),
      releaseBasis: input.releaseBasis ?? {},
      beneficiaries,
    };
  }

  private normalizeOperation(input: RequestSettlementOperationInput) {
    const operation = String(input.operation ?? '').toUpperCase() as SettlementOperationType;
    if (!['RESERVE', 'RELEASE', 'REFUND'].includes(operation)) {
      throw new BadRequestException({ code: 'INVALID_SETTLEMENT_OPERATION' });
    }
    return {
      commandId: identifier(input.commandId, 'commandId'),
      idempotencyKey: identifier(input.idempotencyKey, 'idempotencyKey'),
      dealId: identifier(input.dealId, 'dealId'),
      operation,
      amountMinor: input.amountKopecks === undefined
        ? null
        : minorUnits(input.amountKopecks, 'amountKopecks'),
      beneficiaryId: input.beneficiaryId
        ? identifier(input.beneficiaryId, 'beneficiaryId')
        : null,
      partnerId: identifier(input.partnerId ?? 'safe-deals', 'partnerId'),
      expectedPaymentVersion: optionalVersion(input.expectedPaymentVersion, 'expectedPaymentVersion'),
      expectedDealVersion: optionalVersion(input.expectedDealVersion, 'expectedDealVersion'),
    };
  }

  private normalizeCallback(input: VerifiedSettlementCallbackInput) {
    const operation = String(input.operation ?? '').toUpperCase() as SettlementOperationType;
    const status = String(input.status ?? '').toUpperCase() as BankCallbackStatus;
    const payloadFingerprint = String(input.payloadFingerprint ?? '').trim().toLowerCase();
    if (!['RESERVE', 'RELEASE', 'REFUND'].includes(operation)) {
      throw new BadRequestException({ code: 'INVALID_SETTLEMENT_OPERATION' });
    }
    if (!['SUCCESS', 'FAILED'].includes(status)) {
      throw new BadRequestException({ code: 'INVALID_BANK_CALLBACK_STATUS' });
    }
    if (!/^[0-9a-f]{64}$/.test(payloadFingerprint)) {
      throw new BadRequestException({ code: 'INVALID_CALLBACK_FINGERPRINT' });
    }
    return {
      dealId: identifier(input.dealId, 'dealId'),
      operationId: identifier(input.operationId, 'operationId'),
      eventId: identifier(input.eventId, 'eventId'),
      operation,
      status,
      bankRef: identifier(input.bankRef, 'bankRef'),
      partnerId: identifier(input.partnerId, 'partnerId'),
      keyId: identifier(input.keyId, 'keyId'),
      payloadFingerprint,
      payload: input.payload ?? {},
      errorMessage: input.errorMessage ? text(input.errorMessage, 'errorMessage', 1, 500) : null,
    };
  }

  private assertWriteRole(user: RequestUser) {
    this.assertTrusted(user);
    if (!WRITE_ROLES.has(user.role)) {
      throw new ForbiddenException({ code: 'SETTLEMENT_WRITE_ROLE_REQUIRED' });
    }
  }

  private assertOversightRole(user: RequestUser) {
    this.assertTrusted(user);
    if (!OVERSIGHT_ROLES.has(user.role)) {
      throw new ForbiddenException({ code: 'SETTLEMENT_OVERSIGHT_ROLE_REQUIRED' });
    }
  }

  private assertOperationRole(operation: SettlementOperationType, user: RequestUser) {
    this.assertTrusted(user);
    if (operation === 'RESERVE') this.assertWriteRole(user);
    else this.assertOversightRole(user);
  }

  private assertTrusted(user: RequestUser) {
    if (!user.id || !user.orgId || !user.tenantId || !user.sessionId) {
      throw new ForbiddenException({ code: 'TRUSTED_CONTEXT_REQUIRED' });
    }
  }

  private async lockDeal(tx: Prisma.TransactionClient, dealId: string) {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${dealId}, 84)) IS NULL AS locked`;
  }

  private async requireDeal(
    tx: Prisma.TransactionClient,
    dealId: string,
    context: TrustedRlsContext,
  ): Promise<DealRow> {
    const deal = await tx.deal.findUnique({ where: { id: dealId } });
    if (!deal) throw new NotFoundException(`Deal ${dealId} not found`);
    if (!deal.tenantId || deal.tenantId !== context.tenantId) {
      throw new ForbiddenException({ code: 'TENANT_SCOPE_DENIED' });
    }
    if (!deal.totalKopecks || BigInt(deal.totalKopecks) <= 0n) {
      throw new ConflictException({ code: 'DEAL_INTEGER_TOTAL_REQUIRED' });
    }
    return deal as DealRow;
  }

  private async findTermsByIdempotency(tx: Prisma.TransactionClient, key: string) {
    const rows = await tx.$queryRaw<Array<TermsRow>>(Prisma.sql`
      SELECT id, tenant_id AS "tenantId", deal_id AS "dealId", version, currency,
             reserve_amount_minor AS "reserveAmountMinor",
             request_fingerprint AS "requestFingerprint"
      FROM settlement.payment_terms WHERE idempotency_key = ${key}
    `);
    return rows[0] ?? null;
  }

  private async latestTerms(tx: Prisma.TransactionClient, dealId: string) {
    const rows = await tx.$queryRaw<Array<TermsRow>>(Prisma.sql`
      SELECT id, tenant_id AS "tenantId", deal_id AS "dealId", version, currency,
             reserve_amount_minor AS "reserveAmountMinor",
             request_fingerprint AS "requestFingerprint"
      FROM settlement.payment_terms
      WHERE deal_id = ${dealId}
      ORDER BY version DESC
      LIMIT 1
    `);
    return rows[0] ?? null;
  }

  private async ensureTerms(
    tx: Prisma.TransactionClient,
    deal: DealRow,
    context: TrustedRlsContext,
    operation: ReturnType<SettlementPostgresqlRepository['normalizeOperation']>,
    requestFingerprint: string,
  ): Promise<TermsRow> {
    const existing = await this.latestTerms(tx, deal.id);
    if (existing) return existing;
    if (operation.operation !== 'RESERVE') {
      throw new ConflictException({ code: 'PAYMENT_TERMS_REQUIRED' });
    }
    const termsId = `settlement-terms:${deal.id}:v1`;
    const reserve = BigInt(deal.totalKopecks ?? 0);
    const termsFingerprint = digest({
      action: 'settlement.terms.default',
      dealId: deal.id,
      reserveAmountKopecks: reserve.toString(),
      sellerOrgId: deal.sellerOrgId,
      requestFingerprint,
    });
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO settlement.payment_terms (
        id, tenant_id, deal_id, version, currency, reserve_amount_minor,
        release_basis, status, command_id, idempotency_key, request_fingerprint,
        created_by_user_id, created_by_org_id
      ) VALUES (
        ${termsId}, ${context.tenantId}, ${deal.id}, 1, 'RUB', ${reserve},
        ${JSON.stringify({ source: 'canonical-deal-total', dealStatus: deal.status })}::jsonb,
        'ISSUED', ${operation.commandId}, ${`default-terms:${deal.id}`}, ${termsFingerprint},
        ${context.userId}, ${context.orgId}
      )
    `);
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO settlement.beneficiaries (
        id, tenant_id, deal_id, payment_terms_id, beneficiary_org_id,
        beneficiary_role, allocation_minor, priority, destination_ref,
        command_id, idempotency_key
      ) VALUES (
        ${`settlement-beneficiary:${termsId}:seller`}, ${context.tenantId}, ${deal.id},
        ${termsId}, ${deal.sellerOrgId}, 'SELLER', ${reserve}, 0,
        ${`organization:${deal.sellerOrgId}`}, ${operation.commandId},
        ${`default-terms:${deal.id}:beneficiary:seller`}
      )
    `);
    return {
      id: termsId,
      tenantId: context.tenantId,
      dealId: deal.id,
      version: 1n,
      currency: 'RUB',
      reserveAmountMinor: reserve,
      requestFingerprint: termsFingerprint,
    };
  }

  private async createPayment(
    tx: Prisma.TransactionClient,
    deal: DealRow,
    terms: TermsRow,
    context: TrustedRlsContext,
  ): Promise<PaymentRow> {
    const id = `settlement-payment:${deal.id}`;
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO settlement.payments (
        id, tenant_id, deal_id, payment_terms_id, status, currency
      ) VALUES (
        ${id}, ${context.tenantId}, ${deal.id}, ${terms.id}, 'TERMS_ACTIVE', ${terms.currency}
      )
    `);
    return this.requirePayment(tx, deal.id, true);
  }

  private async findPayment(tx: Prisma.TransactionClient, dealId: string, lock: boolean) {
    const suffix = lock ? Prisma.sql` FOR UPDATE` : Prisma.empty;
    const rows = await tx.$queryRaw<Array<PaymentRow>>(Prisma.sql`
      SELECT id, tenant_id AS "tenantId", deal_id AS "dealId",
             payment_terms_id AS "paymentTermsId", status, currency,
             confirmed_reserved_minor AS "confirmedReservedMinor",
             pending_reserved_minor AS "pendingReservedMinor",
             confirmed_released_minor AS "confirmedReleasedMinor",
             pending_released_minor AS "pendingReleasedMinor",
             confirmed_refunded_minor AS "confirmedRefundedMinor",
             pending_refunded_minor AS "pendingRefundedMinor",
             active_hold_minor AS "activeHoldMinor",
             reconciliation_status AS "reconciliationStatus",
             manual_review_reason AS "manualReviewReason", version,
             created_at AS "createdAt", updated_at AS "updatedAt"
      FROM settlement.payments WHERE deal_id = ${dealId}${suffix}
    `);
    return rows[0] ?? null;
  }

  private async requirePayment(tx: Prisma.TransactionClient, dealId: string, lock: boolean) {
    const payment = await this.findPayment(tx, dealId, lock);
    if (!payment) throw new ConflictException({ code: 'SETTLEMENT_PAYMENT_REQUIRED' });
    return payment;
  }

  private async requireBeneficiary(
    tx: Prisma.TransactionClient,
    termsId: string,
    beneficiaryId: string,
  ) {
    const rows = await tx.$queryRaw<Array<{
      id: string;
      allocationMinor: bigint;
      organizationId: string;
    }>>(Prisma.sql`
      SELECT id, allocation_minor AS "allocationMinor",
             beneficiary_org_id AS "organizationId"
      FROM settlement.beneficiaries
      WHERE id = ${beneficiaryId} AND payment_terms_id = ${termsId}
    `);
    if (!rows[0]) throw new ConflictException({ code: 'SETTLEMENT_BENEFICIARY_NOT_FOUND' });
    return rows[0];
  }

  private async findOperationByIdempotency(tx: Prisma.TransactionClient, key: string) {
    const rows = await tx.$queryRaw<Array<OperationRow>>(Prisma.sql`
      ${this.operationSelect()}
      WHERE idempotency_key = ${key}
    `);
    return rows[0] ?? null;
  }

  private async requireOperation(tx: Prisma.TransactionClient, id: string, lock: boolean) {
    const suffix = lock ? Prisma.sql` FOR UPDATE` : Prisma.empty;
    const rows = await tx.$queryRaw<Array<OperationRow>>(Prisma.sql`
      ${this.operationSelect()}
      WHERE id = ${id}${suffix}
    `);
    if (!rows[0]) throw new NotFoundException(`Settlement operation ${id} not found`);
    return rows[0];
  }

  private operationSelect() {
    return Prisma.sql`
      SELECT id, tenant_id AS "tenantId", deal_id AS "dealId",
             payment_id AS "paymentId", payment_terms_id AS "paymentTermsId",
             operation_type AS "operationType", status, amount_minor AS "amountMinor",
             currency, beneficiary_id AS "beneficiaryId",
             required_partner_id AS "requiredPartnerId",
             request_fingerprint AS "requestFingerprint", command_id AS "commandId",
             idempotency_key AS "idempotencyKey",
             expected_payment_version AS "expectedPaymentVersion", bank_ref AS "bankRef",
             callback_event_id AS "callbackEventId", callback_key_id AS "callbackKeyId",
             callback_payload_fingerprint AS "callbackPayloadFingerprint",
             created_at AS "createdAt"
      FROM settlement.bank_operations
    `;
  }

  private async findCallback(tx: Prisma.TransactionClient, partnerId: string, eventId: string) {
    const rows = await tx.$queryRaw<Array<CallbackRow>>(Prisma.sql`
      SELECT event_id AS "eventId", deal_id AS "dealId", operation_id AS "operationId",
             partner_id AS "partnerId", key_id AS "keyId",
             callback_status AS "callbackStatus",
             payload_fingerprint AS "payloadFingerprint", bank_ref AS "bankRef"
      FROM settlement.bank_callbacks
      WHERE partner_id = ${partnerId} AND event_id = ${eventId}
    `);
    return rows[0] ?? null;
  }

  private async findHoldByIdempotency(tx: Prisma.TransactionClient, key: string) {
    const rows = await tx.$queryRaw<Array<HoldRow>>(Prisma.sql`
      SELECT id, tenant_id AS "tenantId", deal_id AS "dealId", payment_id AS "paymentId",
             amount_minor AS "amountMinor", status,
             request_fingerprint AS "requestFingerprint", version
      FROM settlement.holds WHERE idempotency_key = ${key}
    `);
    return rows[0] ?? null;
  }

  private async requireHold(tx: Prisma.TransactionClient, id: string, lock: boolean) {
    const suffix = lock ? Prisma.sql` FOR UPDATE` : Prisma.empty;
    const rows = await tx.$queryRaw<Array<HoldRow>>(Prisma.sql`
      SELECT id, tenant_id AS "tenantId", deal_id AS "dealId", payment_id AS "paymentId",
             amount_minor AS "amountMinor", status,
             request_fingerprint AS "requestFingerprint", version
      FROM settlement.holds WHERE id = ${id}${suffix}
    `);
    if (!rows[0]) throw new NotFoundException(`Settlement hold ${id} not found`);
    return rows[0];
  }

  private async resolveOperationAmount(
    tx: Prisma.TransactionClient,
    operation: SettlementOperationType,
    requested: bigint | null,
    terms: TermsRow,
    payment: PaymentRow,
    beneficiary: { id: string; allocationMinor: bigint } | null,
  ) {
    if (operation === 'RESERVE') {
      const amount = requested ?? terms.reserveAmountMinor;
      if (amount !== terms.reserveAmountMinor) {
        throw new ConflictException({
          code: 'RESERVE_MUST_EQUAL_ACTIVE_TERMS',
          requiredKopecks: terms.reserveAmountMinor.toString(),
        });
      }
      if (payment.confirmedReservedMinor > 0n || payment.pendingReservedMinor > 0n) {
        throw new ConflictException({ code: 'RESERVE_ALREADY_EXISTS' });
      }
      return amount;
    }

    if (!requested) throw new BadRequestException({ code: 'OPERATION_AMOUNT_REQUIRED' });
    if (payment.confirmedReservedMinor <= 0n) {
      throw new ConflictException({ code: 'CONFIRMED_RESERVE_REQUIRED' });
    }
    const available = this.availableMinor(payment);
    if (requested > available) {
      throw new ConflictException({
        code: operation === 'RELEASE' ? 'OVER_RELEASE_DENIED' : 'REFUND_EXCEEDS_AVAILABLE_FUNDS',
        availableKopecks: available.toString(),
      });
    }
    if (operation === 'RELEASE') {
      if (!beneficiary) throw new BadRequestException({ code: 'BENEFICIARY_REQUIRED' });
      const spentRows = await tx.$queryRaw<Array<{ spent: bigint }>>(Prisma.sql`
        SELECT COALESCE(sum(amount_minor), 0)::bigint AS spent
        FROM settlement.bank_operations
        WHERE beneficiary_id = ${beneficiary.id}
          AND operation_type = 'RELEASE'
          AND status IN ('PENDING','CONFIRMED','MANUAL_REVIEW')
      `);
      const spent = spentRows[0]?.spent ?? 0n;
      if (spent + requested > beneficiary.allocationMinor) {
        throw new ConflictException({
          code: 'BENEFICIARY_ALLOCATION_EXCEEDED',
          remainingKopecks: (beneficiary.allocationMinor - spent).toString(),
        });
      }
    } else if (beneficiary) {
      throw new BadRequestException({ code: 'REFUND_CANNOT_TARGET_BENEFICIARY' });
    }
    return requested;
  }

  private pendingPayment(payment: PaymentRow, operation: SettlementOperationType, amount: bigint) {
    return {
      ...payment,
      status: operation === 'RESERVE'
        ? 'RESERVE_PENDING'
        : operation === 'RELEASE'
          ? 'RELEASE_PENDING'
          : 'REFUND_PENDING',
      pendingReservedMinor: payment.pendingReservedMinor + (operation === 'RESERVE' ? amount : 0n),
      pendingReleasedMinor: payment.pendingReleasedMinor + (operation === 'RELEASE' ? amount : 0n),
      pendingRefundedMinor: payment.pendingRefundedMinor + (operation === 'REFUND' ? amount : 0n),
    };
  }

  private callbackPayment(
    payment: PaymentRow,
    operation: OperationRow,
    status: BankCallbackStatus,
  ): PaymentRow {
    const success = status === 'SUCCESS';
    const result = { ...payment };
    if (operation.operationType === 'RESERVE') {
      if (payment.pendingReservedMinor < operation.amountMinor) {
        throw new ConflictException({ code: 'PENDING_RESERVE_BALANCE_MISMATCH' });
      }
      result.pendingReservedMinor -= operation.amountMinor;
      if (success) result.confirmedReservedMinor += operation.amountMinor;
    } else if (operation.operationType === 'RELEASE') {
      if (payment.pendingReleasedMinor < operation.amountMinor) {
        throw new ConflictException({ code: 'PENDING_RELEASE_BALANCE_MISMATCH' });
      }
      result.pendingReleasedMinor -= operation.amountMinor;
      if (success) result.confirmedReleasedMinor += operation.amountMinor;
    } else {
      if (payment.pendingRefundedMinor < operation.amountMinor) {
        throw new ConflictException({ code: 'PENDING_REFUND_BALANCE_MISMATCH' });
      }
      result.pendingRefundedMinor -= operation.amountMinor;
      if (success) result.confirmedRefundedMinor += operation.amountMinor;
    }
    if (
      result.confirmedReleasedMinor + result.pendingReleasedMinor
        + result.confirmedRefundedMinor + result.pendingRefundedMinor
        + result.activeHoldMinor > result.confirmedReservedMinor
    ) {
      throw new ConflictException({ code: 'SETTLEMENT_BALANCE_INVARIANT_VIOLATION' });
    }
    result.status = this.restingStatus(result);
    return result;
  }

  private restingStatus(payment: PaymentRow) {
    if (payment.reconciliationStatus === 'MANUAL_REVIEW') return 'MANUAL_REVIEW';
    if (payment.activeHoldMinor > 0n) return 'HOLD_ACTIVE';
    if (payment.pendingReservedMinor > 0n) return 'RESERVE_PENDING';
    if (payment.pendingReleasedMinor > 0n) return 'RELEASE_PENDING';
    if (payment.pendingRefundedMinor > 0n) return 'REFUND_PENDING';
    if (payment.confirmedReservedMinor === 0n) return 'TERMS_ACTIVE';
    const consumed = payment.confirmedReleasedMinor + payment.confirmedRefundedMinor;
    if (consumed === 0n) return 'RESERVED';
    if (consumed < payment.confirmedReservedMinor) {
      return payment.confirmedRefundedMinor > 0n ? 'PARTIALLY_REFUNDED' : 'PARTIALLY_RELEASED';
    }
    return payment.confirmedReleasedMinor > 0n ? 'RELEASED' : 'REFUNDED';
  }

  private availableMinor(payment: PaymentRow) {
    const available = payment.confirmedReservedMinor
      - payment.confirmedReleasedMinor
      - payment.confirmedRefundedMinor
      - payment.pendingReleasedMinor
      - payment.pendingRefundedMinor
      - payment.activeHoldMinor;
    if (available < 0n) throw new ConflictException({ code: 'NEGATIVE_SETTLEMENT_BALANCE' });
    return available;
  }

  private requestDealTransition(operation: SettlementOperationType) {
    if (operation === 'RESERVE') {
      return { from: 'CONTRACT_SIGNED', to: 'RESERVE_REQUESTED', nextAction: 'Получить подтверждение резерва банка' };
    }
    if (operation === 'RELEASE') {
      return { from: 'DOCUMENTS_COMPLETE', to: 'RELEASE_REQUESTED', nextAction: 'Получить подтверждение выплаты банка' };
    }
    return null;
  }

  private confirmedDealTransition(operation: SettlementOperationType, payment: PaymentRow) {
    if (operation === 'RESERVE') {
      return { from: 'RESERVE_REQUESTED', to: 'RESERVED', nextAction: 'Назначить перевозку' };
    }
    if (
      operation === 'RELEASE'
      && payment.pendingReleasedMinor === 0n
      && payment.activeHoldMinor === 0n
      && payment.confirmedReleasedMinor + payment.confirmedRefundedMinor === payment.confirmedReservedMinor
    ) {
      return { from: 'RELEASE_REQUESTED', to: 'RELEASED', nextAction: 'Закрыть сделку' };
    }
    return null;
  }

  private async appendSettlementLedger(
    tx: Prisma.TransactionClient,
    context: TrustedRlsContext,
    operation: OperationRow,
  ) {
    const previous = await tx.$queryRaw<Array<{ hash: string }>>(Prisma.sql`
      SELECT hash FROM settlement.ledger_entries
      WHERE tenant_id = ${context.tenantId} AND deal_id = ${operation.dealId}
      ORDER BY created_at DESC, id DESC LIMIT 1
    `);
    const ledgerId = `settlement-ledger:${randomUUID()}`;
    const accounts = this.operationAccounts(operation);
    const material = {
      id: ledgerId,
      tenantId: context.tenantId,
      dealId: operation.dealId,
      operationId: operation.id,
      entryType: operation.operationType,
      debitAccount: accounts.debit,
      creditAccount: accounts.credit,
      amountKopecks: operation.amountMinor.toString(),
      currency: operation.currency,
      prevHash: previous[0]?.hash ?? null,
    };
    const hash = digest(material);
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO settlement.ledger_entries (
        id, tenant_id, deal_id, payment_id, operation_id, entry_type,
        debit_account, credit_account, amount_minor, currency, idempotency_key,
        prev_hash, hash, created_by_user_id
      ) VALUES (
        ${ledgerId}, ${context.tenantId}, ${operation.dealId}, ${operation.paymentId},
        ${operation.id}, ${operation.operationType}, ${accounts.debit}, ${accounts.credit},
        ${operation.amountMinor}, ${operation.currency}, ${`settlement-ledger:${operation.id}`},
        ${previous[0]?.hash ?? null}, ${hash}, ${context.userId}
      )
    `);
    return ledgerId;
  }

  private operationAccounts(operation: OperationRow) {
    if (operation.operationType === 'RESERVE') {
      return {
        debit: `buyer:${operation.dealId}`,
        credit: `nominal:${operation.dealId}`,
      };
    }
    if (operation.operationType === 'RELEASE') {
      return {
        debit: `nominal:${operation.dealId}`,
        credit: `beneficiary:${operation.beneficiaryId}`,
      };
    }
    return {
      debit: `nominal:${operation.dealId}`,
      credit: `buyer-refund:${operation.dealId}`,
    };
  }

  private async appendDealEvent(
    tx: Prisma.TransactionClient,
    input: {
      dealId: string;
      tenantId: string;
      actorId: string;
      actorRole: string;
      eventType: string;
      payload: Prisma.InputJsonValue;
    },
  ) {
    const previous = await tx.dealEvent.findFirst({
      where: { dealId: input.dealId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    const id = `event-${randomUUID()}`;
    const hash = digest({ id, ...input, prevHash: previous?.hash ?? null });
    return tx.dealEvent.create({
      data: {
        id,
        dealId: input.dealId,
        tenantId: input.tenantId,
        actorId: input.actorId,
        actorRole: input.actorRole,
        eventType: input.eventType,
        payload: input.payload,
        hash,
        prevHash: previous?.hash,
      },
    });
  }

  private async appendAudit(
    tx: Prisma.TransactionClient,
    context: TrustedRlsContext,
    input: {
      dealId: string;
      action: string;
      objectType: string;
      objectId: string;
      beforeState: Prisma.InputJsonValue;
      afterState: Prisma.InputJsonValue;
      correlationId: string;
      metadata?: Prisma.InputJsonValue;
    },
  ) {
    const previous = await tx.auditEvent.findFirst({
      where: { dealId: input.dealId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    const id = `audit-${randomUUID()}`;
    const hash = digest({ id, context, input, prevHash: previous?.hash ?? null });
    return tx.auditEvent.create({
      data: {
        id,
        action: input.action,
        actorUserId: context.userId,
        actorRole: context.role,
        tenantId: context.tenantId,
        orgId: context.orgId,
        dealId: input.dealId,
        objectType: input.objectType,
        objectId: input.objectId,
        beforeState: input.beforeState,
        afterState: input.afterState,
        outcome: 'SUCCESS',
        correlationId: input.correlationId,
        metadata: input.metadata ?? {},
        hash,
        prevHash: previous?.hash,
      },
    });
  }

  private appendReceipt(
    tx: Prisma.TransactionClient,
    input: {
      dealId: string;
      idempotencyKey: string;
      correlationId: string;
      auditId: string;
      result: Record<string, unknown>;
    },
  ) {
    return tx.outboxEntry.create({
      data: {
        type: 'settlement.command.receipt',
        dealId: input.dealId,
        status: 'CONFIRMED',
        idempotencyKey: input.idempotencyKey,
        correlationId: input.correlationId,
        auditId: input.auditId,
        confirmedAt: new Date(),
        payload: { result: stable(input.result) } as Prisma.InputJsonValue,
      },
    });
  }

  private async writePublicRequestProjection(
    tx: Prisma.TransactionClient,
    context: TrustedRlsContext,
    input: {
      deal: DealRow;
      operationId: string;
      operation: SettlementOperationType;
      amount: bigint;
      beneficiaryId: string | null;
      commandId: string;
      paymentStatus: string;
      termsReserve: bigint;
    },
  ) {
    await this.enableProjectionWrite(tx);
    await tx.payment.upsert({
      where: { id: `payment:${input.deal.id}` },
      update: {
        status: input.paymentStatus,
        amountKopecks: input.termsReserve,
        callbackState: 'PENDING',
        version: { increment: 1 },
      },
      create: {
        id: `payment:${input.deal.id}`,
        dealId: input.deal.id,
        status: input.paymentStatus,
        amountKopecks: input.termsReserve,
        callbackState: 'PENDING',
      },
    });
    const accounts = this.operationAccounts({
      id: input.operationId,
      dealId: input.deal.id,
      operationType: input.operation,
      beneficiaryId: input.beneficiaryId,
    } as OperationRow);
    await tx.bankOperation.create({
      data: {
        id: input.operationId,
        dealId: input.deal.id,
        type: input.operation,
        status: 'PENDING',
        amountKopecks: input.amount,
        debitAccount: accounts.debit,
        creditAccount: accounts.credit,
        idempotencyKey: `projection:${input.operationId}`,
        initiatorUserId: context.userId,
        requestPayload: {
          authority: 'settlement',
          operationId: input.operationId,
          commandId: input.commandId,
          beneficiaryId: input.beneficiaryId,
        },
      },
    });
  }

  private async writePublicCallbackProjection(
    tx: Prisma.TransactionClient,
    context: TrustedRlsContext,
    input: {
      deal: DealRow;
      operation: OperationRow;
      counters: PaymentRow;
      status: BankCallbackStatus;
      bankRef: string;
      errorMessage: string | null;
    },
  ) {
    await this.enableProjectionWrite(tx);
    await tx.payment.update({
      where: { id: `payment:${input.deal.id}` },
      data: {
        status: this.publicPaymentStatus(input.counters.status),
        amountKopecks: input.counters.confirmedReservedMinor,
        holdAmountKopecks: input.counters.activeHoldMinor,
        refundedKopecks: input.counters.confirmedRefundedMinor,
        callbackState: input.status === 'SUCCESS' ? 'CONFIRMED' : 'FAILED',
        bankRef: input.bankRef,
        ...(input.operation.operationType === 'RESERVE' && input.status === 'SUCCESS'
          ? { reservedAt: new Date() }
          : {}),
        ...(input.operation.operationType === 'RELEASE' && input.status === 'SUCCESS'
          ? { releasedAt: new Date() }
          : {}),
        version: { increment: 1 },
      },
    });
    await tx.bankOperation.update({
      where: { id: input.operation.id },
      data: {
        status: input.status === 'SUCCESS' ? 'DONE' : 'FAILED',
        bankRef: input.bankRef,
        failureReason: input.errorMessage,
        confirmedAt: input.status === 'SUCCESS' ? new Date() : null,
        responsePayload: {
          authority: 'settlement',
          bankRef: input.bankRef,
          callbackStatus: input.status,
        },
      },
    });
    if (input.status === 'SUCCESS') {
      const accounts = this.operationAccounts(input.operation);
      await tx.ledgerEntry.create({
        data: {
          dealId: input.deal.id,
          entryType: input.operation.operationType,
          debitAccount: accounts.debit,
          creditAccount: accounts.credit,
          amountKopecks: input.operation.amountMinor,
          currency: input.operation.currency,
          reference: input.bankRef,
          idempotencyKey: `projection-ledger:${input.operation.id}`,
          description: 'Settlement PostgreSQL authority projection',
          createdByUserId: context.userId,
        },
      });
    }
  }

  private async writePublicPaymentProjection(
    tx: Prisma.TransactionClient,
    dealId: string,
    data: {
      status: string;
      amountKopecks: bigint;
      holdAmountKopecks: bigint;
      callbackState: string;
    },
  ) {
    await this.enableProjectionWrite(tx);
    await tx.payment.update({
      where: { id: `payment:${dealId}` },
      data: { ...data, version: { increment: 1 } },
    });
  }

  private async writePublicOperationStatus(
    tx: Prisma.TransactionClient,
    operationId: string,
    status: string,
    reason: string | null,
  ) {
    await this.enableProjectionWrite(tx);
    await tx.bankOperation.update({
      where: { id: operationId },
      data: { status, failureReason: reason },
    });
  }

  private enableProjectionWrite(tx: Prisma.TransactionClient) {
    return tx.$queryRaw(Prisma.sql`
      SELECT set_config('app.settlement_projection_write', 'on', true)
    `);
  }

  private operationResult(operation: OperationRow) {
    return jsonSafe({
      ok: true,
      dealId: operation.dealId,
      paymentId: operation.paymentId,
      operationId: operation.id,
      operation: operation.operationType,
      status: operation.status,
      amountKopecks: operation.amountMinor,
      beneficiaryId: operation.beneficiaryId,
      commandId: operation.commandId,
    });
  }

  private paymentState(payment: Pick<
    PaymentRow,
    | 'status'
    | 'confirmedReservedMinor'
    | 'pendingReservedMinor'
    | 'confirmedReleasedMinor'
    | 'pendingReleasedMinor'
    | 'confirmedRefundedMinor'
    | 'pendingRefundedMinor'
    | 'activeHoldMinor'
    | 'version'
  >) {
    return {
      status: payment.status,
      confirmedReservedKopecks: payment.confirmedReservedMinor.toString(),
      pendingReservedKopecks: payment.pendingReservedMinor.toString(),
      confirmedReleasedKopecks: payment.confirmedReleasedMinor.toString(),
      pendingReleasedKopecks: payment.pendingReleasedMinor.toString(),
      confirmedRefundedKopecks: payment.confirmedRefundedMinor.toString(),
      pendingRefundedKopecks: payment.pendingRefundedMinor.toString(),
      activeHoldKopecks: payment.activeHoldMinor.toString(),
      version: payment.version.toString(),
    };
  }

  private publicPaymentStatus(status: string) {
    const map: Record<string, string> = {
      TERMS_ACTIVE: 'PENDING',
      RESERVE_PENDING: 'RESERVE_REQUESTED',
      RESERVED: 'RESERVED',
      RELEASE_PENDING: 'RELEASE_REQUESTED',
      PARTIALLY_RELEASED: 'PARTIALLY_RELEASED',
      RELEASED: 'RELEASED',
      REFUND_PENDING: 'REFUND_REQUESTED',
      PARTIALLY_REFUNDED: 'PARTIALLY_REFUNDED',
      REFUNDED: 'REFUNDED',
      HOLD_ACTIVE: 'HOLD_ACTIVE',
      MANUAL_REVIEW: 'MANUAL_REVIEW',
    };
    return map[status] ?? status;
  }

  private assertExpectedVersion(actual: bigint, expected: bigint | null, code: string) {
    if (expected !== null && expected !== actual) {
      throw new ConflictException({
        code,
        expectedVersion: expected.toString(),
        currentVersion: actual.toString(),
      });
    }
  }

  private assertFingerprint(actual: string, expected: string, code: string) {
    if (actual !== expected) throw new ConflictException({ code });
  }

  private assertCallbackReplay(
    replay: CallbackRow,
    input: ReturnType<SettlementPostgresqlRepository['normalizeCallback']>,
  ) {
    if (
      replay.dealId !== input.dealId
      || replay.operationId !== input.operationId
      || replay.partnerId !== input.partnerId
      || replay.keyId !== input.keyId
      || replay.callbackStatus !== input.status
      || replay.payloadFingerprint !== input.payloadFingerprint
      || replay.bankRef !== input.bankRef
    ) {
      throw new ConflictException({ code: 'BANK_EVENT_REPLAY_MISMATCH' });
    }
  }
}
