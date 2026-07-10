import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Role } from '../../common/types/request-user';
import { DealCommandService } from './deal-command.service';
import {
  IndustrialDealCommandGateway,
  type VerifiedBankCallbackInput,
} from './industrial-deal-command.gateway';
import { CANONICAL_TEST_DEAL_ID } from './deal-command.policy';

type JsonRecord = Record<string, unknown>;

function stable(value: unknown): unknown {
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

function jsonRecord(value: Prisma.JsonValue | null | undefined): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};
}

function isUniqueConstraintError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: unknown }).code === 'P2002',
  );
}

/**
 * Production registration for the industrial gateway.
 *
 * Successful bank callbacks continue through the canonical command state machine.
 * Failed callbacks are handled here because they must validate and mutate the deal,
 * payment, bank operation, event, audit and receipt in one serializable transaction.
 */
@Injectable()
export class AtomicIndustrialDealCommandGateway extends IndustrialDealCommandGateway {
  constructor(
    private readonly database: PrismaService,
    commands: DealCommandService,
  ) {
    super(database, commands);
  }

  override async executeBankCallback(input: VerifiedBankCallbackInput) {
    if (input.status !== 'FAILED') {
      return super.executeBankCallback(input);
    }

    this.validateFailedCallback(input);
    return this.recordFailedCallbackAtomically(input);
  }

  private validateFailedCallback(input: VerifiedBankCallbackInput): void {
    if (input.dealId !== CANONICAL_TEST_DEAL_ID) {
      throw new NotFoundException('Industrial execution workspace is enabled only for the canonical test deal.');
    }
    if (!input.eventId || input.eventId.length < 8) {
      throw new BadRequestException({ code: 'BANK_EVENT_ID_REQUIRED' });
    }
    if (!input.bankRef || input.bankRef.length < 4) {
      throw new BadRequestException({ code: 'BANK_REFERENCE_REQUIRED' });
    }
    if (!['RESERVE', 'RELEASE'].includes(input.operation)) {
      throw new BadRequestException({ code: 'BANK_OPERATION_INVALID' });
    }
  }

  private async recordFailedCallbackAtomically(input: VerifiedBankCallbackInput) {
    const callbackKey = `bank-callback-failure:${input.eventId}`;
    const expectedDealStatus = input.operation === 'RESERVE' ? 'RESERVE_REQUESTED' : 'RELEASE_REQUESTED';
    const expectedPaymentStatus = input.operation === 'RESERVE' ? 'RESERVE_REQUESTED' : 'RELEASE_REQUESTED';
    const operationId = input.operation === 'RESERVE'
      ? `bank-reserve:${input.dealId}`
      : `bank-release:${input.dealId}`;
    const paymentId = `payment:${input.dealId}`;
    const eventPayload = {
      eventId: input.eventId,
      operation: input.operation,
      bankRef: input.bankRef,
      operationId: input.operationId ?? null,
      errorMessage: input.errorMessage ?? 'bank_callback_failed',
    };
    const fingerprint = digest(eventPayload);
    const result = {
      ok: false,
      dealId: input.dealId,
      eventId: input.eventId,
      operation: input.operation,
      status: 'FAILED',
      bankRef: input.bankRef,
    };

    const existing = await this.database.outboxEntry.findUnique({
      where: { idempotencyKey: callbackKey },
    });
    if (existing) return this.resolveExistingFailure(existing.payload, fingerprint);

    try {
      return await this.database.$transaction(async (tx) => {
        const replay = await tx.outboxEntry.findUnique({
          where: { idempotencyKey: callbackKey },
        });
        if (replay) return this.resolveExistingFailure(replay.payload, fingerprint);

        const deal = await tx.deal.findUnique({
          where: { id: input.dealId },
          select: {
            id: true,
            tenantId: true,
            buyerOrgId: true,
            status: true,
          },
        });
        if (!deal) throw new NotFoundException(`Deal ${input.dealId} not found`);
        if (!deal.tenantId) {
          throw new ConflictException({
            code: 'BANK_CALLBACK_TENANT_REQUIRED',
            message: 'Deal has no tenant context and cannot accept a bank callback.',
          });
        }
        if (deal.status !== expectedDealStatus) {
          throw new ConflictException({
            code: 'BANK_CALLBACK_STATE_MISMATCH',
            message: `Failed ${input.operation} callback requires ${expectedDealStatus}; current status is ${deal.status}.`,
            expectedStatus: expectedDealStatus,
            currentStatus: deal.status,
          });
        }

        const operation = await tx.bankOperation.findFirst({
          where: {
            id: operationId,
            dealId: deal.id,
            type: input.operation,
            status: 'PENDING',
          },
          select: { id: true },
        });
        if (!operation || (input.operationId && input.operationId !== operation.id)) {
          throw new ConflictException({
            code: 'BANK_CALLBACK_OPERATION_MISMATCH',
            message: 'No matching pending bank operation exists for this callback.',
          });
        }

        const payment = await tx.payment.updateMany({
          where: {
            id: paymentId,
            dealId: deal.id,
            status: expectedPaymentStatus,
            callbackState: 'PENDING',
          },
          data: {
            status: 'FAILED',
            callbackState: 'FAILED',
            bankRef: input.bankRef,
          },
        });
        if (payment.count !== 1) {
          throw new ConflictException({
            code: 'BANK_CALLBACK_PAYMENT_MISMATCH',
            message: 'Payment is not waiting for this bank callback.',
          });
        }

        const bankOperation = await tx.bankOperation.updateMany({
          where: {
            id: operation.id,
            dealId: deal.id,
            status: 'PENDING',
          },
          data: {
            status: 'FAILED',
            bankRef: input.bankRef,
            responsePayload: eventPayload as Prisma.InputJsonValue,
          },
        });
        if (bankOperation.count !== 1) {
          throw new ConflictException({
            code: 'BANK_CALLBACK_CONCURRENT_UPDATE',
            message: 'Bank operation changed concurrently; no failure receipt was committed.',
          });
        }

        const previous = await tx.dealEvent.findFirst({
          where: { dealId: deal.id },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        });
        const eventId = `bank-failure:${input.eventId}`;
        const eventHash = digest({
          id: eventId,
          dealId: deal.id,
          eventType: 'BANK_CALLBACK_FAILED',
          payload: eventPayload,
          prevHash: previous?.hash ?? null,
        });
        await tx.dealEvent.create({
          data: {
            id: eventId,
            dealId: deal.id,
            eventType: 'BANK_CALLBACK_FAILED',
            actorId: `bank-callback:${input.partnerId ?? 'safe-deals'}`,
            actorRole: Role.BANK_CALLBACK,
            tenantId: deal.tenantId,
            payload: eventPayload as Prisma.InputJsonValue,
            hash: eventHash,
            prevHash: previous?.hash ?? null,
          },
        });

        await tx.auditEvent.create({
          data: {
            action: 'deal.bank_callback.failed',
            actorUserId: `bank-callback:${input.partnerId ?? 'safe-deals'}`,
            actorRole: Role.BANK_CALLBACK,
            tenantId: deal.tenantId,
            orgId: deal.buyerOrgId,
            dealId: deal.id,
            objectType: 'bank_operation',
            objectId: operation.id,
            beforeState: { status: 'PENDING' },
            afterState: { status: 'FAILED', bankRef: input.bankRef },
            outcome: 'FAILURE',
            reason: input.errorMessage ?? 'bank_callback_failed',
            correlationId: input.eventId,
            hash: digest({ dealId: deal.id, eventPayload, result }),
          },
        });

        await tx.outboxEntry.create({
          data: {
            type: 'bank.callback.receipt',
            dealId: deal.id,
            status: 'CONFIRMED',
            idempotencyKey: callbackKey,
            correlationId: input.eventId,
            confirmedAt: new Date(),
            payload: {
              fingerprint,
              eventPayload,
              result,
            } as Prisma.InputJsonValue,
          },
        });

        return result;
      }, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5_000,
        timeout: 15_000,
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
      const replay = await this.database.outboxEntry.findUnique({
        where: { idempotencyKey: callbackKey },
      });
      if (!replay) throw error;
      return this.resolveExistingFailure(replay.payload, fingerprint);
    }
  }

  private resolveExistingFailure(payloadValue: Prisma.JsonValue, fingerprint: string) {
    const payload = jsonRecord(payloadValue);
    if (payload.fingerprint !== fingerprint) {
      throw new ConflictException({
        code: 'BANK_EVENT_REPLAY_MISMATCH',
        message: 'Bank event ID was already used with a different payload.',
      });
    }
    const result = payload.result;
    return result && typeof result === 'object' && !Array.isArray(result)
      ? { ...(result as JsonRecord), duplicate: true }
      : { ok: false, duplicate: true };
  }
}
