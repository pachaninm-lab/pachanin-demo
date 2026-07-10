import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RequestUser, Role } from '../../common/types/request-user';
import { DealCommandService } from './deal-command.service';
import { ExecuteDealCommandDto } from './dto/execute-deal-command.dto';
import {
  CANONICAL_TEST_DEAL_ID,
  getDealActionDefinition,
  isDealActionId,
  type DealActionId,
} from './deal-command.policy';

export interface VerifiedBankCallbackInput {
  readonly dealId: string;
  readonly eventId: string;
  readonly operation: 'RESERVE' | 'RELEASE';
  readonly status: 'SUCCESS' | 'FAILED';
  readonly bankRef: string;
  readonly operationId?: string;
  readonly errorMessage?: string;
  readonly partnerId?: string;
}

type JsonRecord = Record<string, unknown>;
type IntentEntry = { readonly status: string; readonly payload: Prisma.JsonValue };
type CanonicalDealRecord = {
  readonly id: string;
  readonly tenantId: string;
  readonly sellerOrgId: string;
  readonly buyerOrgId: string;
  readonly status: string;
  readonly updatedAt: Date;
  readonly totalKopecks: number | null;
};

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
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function isUniqueConstraintError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: unknown }).code === 'P2002',
  );
}

function errorSnapshot(error: unknown): JsonRecord {
  if (error instanceof Error) return { name: error.name, message: error.message };
  return { name: 'UnknownError', message: String(error) };
}

@Injectable()
export class IndustrialDealCommandGateway {
  constructor(
    private readonly prisma: PrismaService,
    private readonly commands: DealCommandService,
  ) {}

  async workspace(dealId: string, user: RequestUser) {
    const scoped = await this.resolveCanonicalMembership(dealId, user);
    return this.commands.workspace(dealId, scoped.user);
  }

  async executeUser(
    dealId: string,
    rawActionId: string,
    dto: ExecuteDealCommandDto,
    user: RequestUser,
  ) {
    if (!isDealActionId(rawActionId)) {
      throw new BadRequestException(`Unknown deal action: ${rawActionId}`);
    }

    const actionId = rawActionId as DealActionId;
    const definition = getDealActionDefinition(actionId);
    if ((definition.source ?? 'USER') !== 'USER') {
      throw new ForbiddenException({
        code: 'BANK_CALLBACK_REQUIRED',
        message: 'Подтверждение банковской операции принимается только через подписанный callback банка.',
      });
    }

    const scoped = await this.resolveCanonicalMembership(dealId, user);
    return this.executeWithStrictIdempotency(dealId, actionId, dto, scoped.user);
  }

  async executeBankCallback(input: VerifiedBankCallbackInput) {
    this.validateBankCallback(input);
    const deal = await this.readCanonicalDeal(input.dealId);
    const actionId: DealActionId = input.operation === 'RESERVE' ? 'confirm_reserve' : 'confirm_release';
    const definition = getDealActionDefinition(actionId);

    if (definition.source !== 'BANK_CALLBACK') {
      throw new ConflictException({ code: 'INVALID_BANK_ACTION_POLICY' });
    }

    if (input.status === 'FAILED') {
      return this.recordBankFailure(input, deal);
    }

    const callbackUser: RequestUser = {
      id: `bank-callback:${input.partnerId ?? 'safe-deals'}`,
      email: 'bank-callback@system.invalid',
      fullName: 'Verified bank callback',
      role: Role.BANK_CALLBACK,
      orgId: deal.buyerOrgId,
      tenantId: deal.tenantId,
      sessionId: `bank-event:${input.eventId}`,
      mfaVerified: true,
    };

    const dto: ExecuteDealCommandDto = {
      commandId: `bank-callback:${input.eventId}`,
      idempotencyKey: `bank-callback:${input.eventId}`,
      expectedUpdatedAt: deal.updatedAt.toISOString(),
      payload: {
        eventId: input.eventId,
        operation: input.operation,
        operationId: input.operationId ?? null,
        bankRef: input.bankRef,
        partnerId: input.partnerId ?? 'safe-deals',
      },
    };

    return this.executeWithStrictIdempotency(input.dealId, actionId, dto, callbackUser);
  }

  private async executeWithStrictIdempotency(
    dealId: string,
    actionId: DealActionId,
    dto: ExecuteDealCommandDto,
    user: RequestUser,
  ) {
    const request = {
      dealId,
      actionId,
      commandId: dto.commandId,
      expectedUpdatedAt: dto.expectedUpdatedAt,
      payload: dto.payload ?? {},
    };
    const fingerprint = digest(request);
    const intentKey = `deal-command-intent:${dealId}:${dto.idempotencyKey}`;
    const receiptKey = `deal-command:${dealId}:${dto.idempotencyKey}`;

    const existingIntent = await this.prisma.outboxEntry.findUnique({
      where: { idempotencyKey: intentKey },
    });
    if (existingIntent) {
      return this.resolveExistingIntent(existingIntent, fingerprint);
    }

    const legacyReceipt = await this.prisma.outboxEntry.findUnique({
      where: { idempotencyKey: receiptKey },
    });
    if (legacyReceipt) {
      throw new ConflictException({
        code: 'UNVERIFIABLE_LEGACY_IDEMPOTENCY_RECEIPT',
        message: 'Существующий результат команды не содержит полного отпечатка запроса. Используйте новый idempotency key.',
      });
    }

    try {
      await this.prisma.outboxEntry.create({
        data: {
          type: 'deal.command.intent',
          dealId,
          status: 'PENDING',
          idempotencyKey: intentKey,
          correlationId: dto.commandId,
          payload: { fingerprint, request } as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
      const raced = await this.prisma.outboxEntry.findUnique({
        where: { idempotencyKey: intentKey },
      });
      if (!raced) throw error;
      return this.resolveExistingIntent(raced, fingerprint);
    }

    try {
      const result = await this.commands.execute(dealId, actionId, dto, user);
      const resultRecord = result as unknown as JsonRecord;
      if (resultRecord.actionId !== actionId || resultRecord.commandId !== dto.commandId) {
        throw new ConflictException({
          code: 'IDEMPOTENCY_RESULT_MISMATCH',
          message: 'Сохранённый результат относится к другой команде.',
        });
      }

      await this.prisma.outboxEntry.update({
        where: { idempotencyKey: intentKey },
        data: {
          status: 'CONFIRMED',
          confirmedAt: new Date(),
          payload: { fingerprint, request, result: resultRecord } as Prisma.InputJsonValue,
        },
      });

      return result;
    } catch (error) {
      await this.prisma.outboxEntry.updateMany({
        where: { idempotencyKey: intentKey, status: 'PENDING' },
        data: {
          status: 'FAILED',
          payload: { fingerprint, request, failure: errorSnapshot(error) } as Prisma.InputJsonValue,
        },
      });
      throw error;
    }
  }

  private resolveExistingIntent(entry: IntentEntry, fingerprint: string) {
    const payload = jsonRecord(entry.payload);
    if (payload.fingerprint !== fingerprint) {
      throw new ConflictException({
        code: 'IDEMPOTENCY_KEY_REUSED',
        message: 'Один idempotency key нельзя использовать для разных команд, версий или payload.',
      });
    }

    const result = payload.result;
    if (entry.status === 'CONFIRMED' && result && typeof result === 'object' && !Array.isArray(result)) {
      return { ...(result as JsonRecord), duplicate: true };
    }

    if (entry.status === 'FAILED') {
      throw new ConflictException({
        code: 'PREVIOUS_COMMAND_FAILED',
        message: 'Предыдущая попытка с этим idempotency key завершилась ошибкой. Обновите сделку и используйте новый ключ.',
      });
    }

    throw new ConflictException({
      code: 'COMMAND_ALREADY_IN_PROGRESS',
      message: 'Команда с этим idempotency key уже выполняется. Повторите чтение состояния сделки.',
    });
  }

  private async resolveCanonicalMembership(dealId: string, user: RequestUser) {
    const deal = await this.readCanonicalDeal(dealId);
    const memberships = await this.prisma.userOrg.findMany({
      where: { userId: user.id },
      include: { organization: true },
    });
    const membership = memberships.find(
      (item) => item.organization.tenantId === deal.tenantId && item.role === String(user.role),
    );

    if (!membership) {
      throw new ForbiddenException({
        code: 'CANONICAL_MEMBERSHIP_REQUIRED',
        message: `No active role membership for deal tenant:${dealId}`,
      });
    }
    if (user.tenantId && user.tenantId !== membership.organization.tenantId) {
      throw new ForbiddenException({
        code: 'STALE_TENANT_SESSION',
        message: 'Session tenant no longer matches the active membership.',
      });
    }

    return {
      deal,
      user: {
        ...user,
        orgId: membership.organizationId,
        tenantId: membership.organization.tenantId,
      } as RequestUser,
    };
  }

  private async readCanonicalDeal(dealId: string): Promise<CanonicalDealRecord> {
    if (dealId !== CANONICAL_TEST_DEAL_ID) {
      throw new NotFoundException('Industrial execution workspace is enabled only for the canonical test deal.');
    }

    const deal = await this.prisma.deal.findUnique({
      where: { id: dealId },
      select: {
        id: true,
        tenantId: true,
        sellerOrgId: true,
        buyerOrgId: true,
        status: true,
        updatedAt: true,
        totalKopecks: true,
      },
    });
    if (!deal) throw new NotFoundException(`Deal ${dealId} not found`);
    if (!deal.tenantId) {
      throw new ForbiddenException({
        code: 'TENANT_CONTEXT_REQUIRED',
        message: 'Canonical deal has no tenant and cannot be exposed.',
      });
    }
    return deal as CanonicalDealRecord;
  }

  private validateBankCallback(input: VerifiedBankCallbackInput): void {
    if (!input?.eventId || input.eventId.length < 8) {
      throw new BadRequestException({ code: 'BANK_EVENT_ID_REQUIRED' });
    }
    if (!input.bankRef || input.bankRef.length < 4) {
      throw new BadRequestException({ code: 'BANK_REFERENCE_REQUIRED' });
    }
    if (!['RESERVE', 'RELEASE'].includes(input.operation)) {
      throw new BadRequestException({ code: 'BANK_OPERATION_INVALID' });
    }
    if (!['SUCCESS', 'FAILED'].includes(input.status)) {
      throw new BadRequestException({ code: 'BANK_STATUS_INVALID' });
    }
  }

  private async recordBankFailure(input: VerifiedBankCallbackInput, deal: CanonicalDealRecord) {
    const callbackKey = `bank-callback-failure:${input.eventId}`;
    const existing = await this.prisma.outboxEntry.findUnique({
      where: { idempotencyKey: callbackKey },
    });
    if (existing) return this.resolveExistingBankFailure(existing.payload, input);

    const operationId = input.operation === 'RESERVE'
      ? `bank-reserve:${deal.id}`
      : `bank-release:${deal.id}`;
    const paymentId = `payment:${deal.id}`;
    const eventPayload = {
      eventId: input.eventId,
      operation: input.operation,
      bankRef: input.bankRef,
      operationId: input.operationId ?? null,
      errorMessage: input.errorMessage ?? 'bank_callback_failed',
    };
    const result = {
      ok: false,
      dealId: deal.id,
      eventId: input.eventId,
      operation: input.operation,
      status: 'FAILED',
      bankRef: input.bankRef,
    };

    return this.prisma.$transaction(async (tx) => {
      await tx.payment.upsert({
        where: { id: paymentId },
        update: { status: 'FAILED', callbackState: 'FAILED', bankRef: input.bankRef },
        create: {
          id: paymentId,
          dealId: deal.id,
          status: 'FAILED',
          amountKopecks: deal.totalKopecks,
          callbackState: 'FAILED',
          bankRef: input.bankRef,
        },
      });

      await tx.bankOperation.updateMany({
        where: { id: operationId, dealId: deal.id },
        data: {
          status: 'FAILED',
          bankRef: input.bankRef,
          responsePayload: eventPayload as Prisma.InputJsonValue,
        },
      });

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
          objectId: operationId,
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
            fingerprint: digest(eventPayload),
            eventPayload,
            result,
          } as Prisma.InputJsonValue,
        },
      });

      return result;
    });
  }

  private resolveExistingBankFailure(payloadValue: Prisma.JsonValue, input: VerifiedBankCallbackInput) {
    const payload = jsonRecord(payloadValue);
    const expected = digest({
      eventId: input.eventId,
      operation: input.operation,
      bankRef: input.bankRef,
      operationId: input.operationId ?? null,
      errorMessage: input.errorMessage ?? 'bank_callback_failed',
    });
    if (payload.fingerprint !== expected) {
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
