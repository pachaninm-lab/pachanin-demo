import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RlsTransactionService } from '../../common/prisma/rls-transaction.service';
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
type CanonicalDealRecord = {
  readonly id: string;
  readonly tenantId: string;
  readonly sellerOrgId: string;
  readonly buyerOrgId: string;
  readonly status: string;
  readonly updatedAt: Date;
  readonly totalKopecks: number | null;
};

type CanonicalMembershipCandidate = {
  readonly organizationId: string;
  readonly role: string;
  readonly isDefault: boolean;
};

const KNOWN_ROLES = new Set<string>(Object.values(Role));

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

@Injectable()
export class IndustrialDealCommandGateway {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rls: RlsTransactionService,
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
    return this.commands.execute(
      dealId,
      actionId,
      this.fingerprintedCommand(dealId, actionId, dto),
      scoped.user,
    );
  }

  async executeBankCallback(input: VerifiedBankCallbackInput) {
    this.validateBankCallback(input);
    const deal = await this.readCanonicalDeal(input.dealId);
    const actionId: DealActionId = input.operation === 'RESERVE' ? 'confirm_reserve' : 'confirm_release';
    const definition = getDealActionDefinition(actionId);

    if (definition.source !== 'BANK_CALLBACK') {
      throw new ConflictException({ code: 'INVALID_BANK_ACTION_POLICY' });
    }

    const callbackUser = this.bankCallbackUser(deal, input);
    if (input.status === 'FAILED') {
      return this.recordBankFailure(input, deal, callbackUser);
    }

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

    return this.commands.execute(
      input.dealId,
      actionId,
      this.fingerprintedCommand(input.dealId, actionId, dto),
      callbackUser,
    );
  }

  /**
   * The client key is never used as the physical receipt key. The canonical service
   * receives a deterministic SHA-256 identity over every material command field and
   * writes the only receipt inside the same trusted Serializable RLS transaction as
   * Deal, DealEvent, AuditEvent and external outbox changes.
   */
  private fingerprintedCommand(
    dealId: string,
    actionId: DealActionId,
    dto: ExecuteDealCommandDto,
  ): ExecuteDealCommandDto {
    const material = {
      dealId,
      actionId,
      commandId: dto.commandId,
      clientIdempotencyKey: dto.idempotencyKey,
      expectedUpdatedAt: dto.expectedUpdatedAt,
      payload: dto.payload ?? {},
    };
    const fingerprint = digest(material);
    return {
      ...dto,
      idempotencyKey: `fp:${fingerprint}`,
      payload: {
        ...(dto.payload ?? {}),
        requestFingerprint: fingerprint,
        clientIdempotencyKey: dto.idempotencyKey,
      },
    };
  }

  private bankCallbackUser(
    deal: CanonicalDealRecord,
    input: VerifiedBankCallbackInput,
  ): RequestUser {
    return {
      id: `bank-callback:${input.partnerId ?? 'safe-deals'}`,
      email: 'bank-callback@system.invalid',
      fullName: 'Verified bank callback',
      role: Role.BANK_CALLBACK,
      orgId: deal.buyerOrgId,
      tenantId: deal.tenantId,
      sessionId: `bank-event:${input.eventId}`,
      mfaVerified: true,
    };
  }

  /**
   * Resolve authorization exclusively from database membership.
   *
   * `UserOrg` is read first without joining `Organization`, because Organization is
   * protected by PostgreSQL RLS. Every candidate organization is then verified in a
   * transaction-local trusted context assembled from the DB membership, never from
   * the client-supplied org or role. This also prevents Prisma from materializing a
   * required relation as null when RLS correctly filters it.
   */
  private async resolveCanonicalMembership(dealId: string, user: RequestUser) {
    const deal = await this.readCanonicalDeal(dealId);

    if (user.tenantId && user.tenantId !== deal.tenantId) {
      throw new ForbiddenException({
        code: 'STALE_TENANT_SESSION',
        message: 'Session tenant no longer matches the canonical deal tenant.',
      });
    }

    const memberships = (await this.prisma.userOrg.findMany({
      where: { userId: user.id },
      select: {
        organizationId: true,
        role: true,
        isDefault: true,
      },
      orderBy: [{ isDefault: 'desc' }, { joinedAt: 'asc' }],
    })) as CanonicalMembershipCandidate[];

    for (const membership of memberships) {
      if (!KNOWN_ROLES.has(membership.role)) continue;

      const scopedUser: RequestUser = {
        ...user,
        role: membership.role as Role,
        orgId: membership.organizationId,
        tenantId: deal.tenantId,
      };

      const organization = await this.rls.withTrustedContext(scopedUser, (tx) =>
        tx.organization.findFirst({
          where: {
            id: membership.organizationId,
            tenantId: deal.tenantId,
          },
          select: { id: true, tenantId: true },
        }),
      );

      if (organization) {
        return { deal, user: scopedUser };
      }
    }

    throw new ForbiddenException({
      code: 'CANONICAL_MEMBERSHIP_REQUIRED',
      message: `No active database membership for deal tenant:${dealId}`,
    });
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
    if (!input.operationId || input.operationId.length < 8) {
      throw new BadRequestException({ code: 'BANK_OPERATION_ID_REQUIRED' });
    }
    if (!['RESERVE', 'RELEASE'].includes(input.operation)) {
      throw new BadRequestException({ code: 'BANK_OPERATION_INVALID' });
    }
    if (!['SUCCESS', 'FAILED'].includes(input.status)) {
      throw new BadRequestException({ code: 'BANK_STATUS_INVALID' });
    }
  }

  private async recordBankFailure(
    input: VerifiedBankCallbackInput,
    deal: CanonicalDealRecord,
    callbackUser: RequestUser,
  ) {
    const callbackKey = `bank-callback-failure:${input.eventId}`;
    const eventPayload = {
      eventId: input.eventId,
      operation: input.operation,
      bankRef: input.bankRef,
      operationId: input.operationId,
      errorMessage: input.errorMessage ?? 'bank_callback_failed',
      partnerId: input.partnerId ?? 'safe-deals',
    };
    const fingerprint = digest(eventPayload);
    const result = {
      ok: false,
      dealId: deal.id,
      eventId: input.eventId,
      operation: input.operation,
      operationId: input.operationId,
      status: 'FAILED',
      bankRef: input.bankRef,
    };

    return this.rls.withTrustedContext(callbackUser, async (tx) => {
      const existing = await tx.outboxEntry.findUnique({
        where: { idempotencyKey: callbackKey },
      });
      if (existing) {
        const payload = jsonRecord(existing.payload);
        if (payload.fingerprint !== fingerprint) {
          throw new ConflictException({
            code: 'BANK_EVENT_REPLAY_MISMATCH',
            message: 'Bank event ID was already used with a different payload.',
          });
        }
        const stored = payload.result;
        return stored && typeof stored === 'object' && !Array.isArray(stored)
          ? { ...(stored as JsonRecord), duplicate: true }
          : { ...result, duplicate: true };
      }

      const operation = await tx.bankOperation.findUnique({
        where: { id: input.operationId },
      });
      if (!operation || operation.dealId !== deal.id || operation.status !== 'PENDING') {
        throw new ConflictException({
          code: 'BANK_OPERATION_NOT_PENDING',
          message: 'Callback is not bound to the exact pending bank operation.',
        });
      }

      await tx.payment.upsert({
        where: { id: `payment:${deal.id}` },
        update: { status: 'FAILED', callbackState: 'FAILED', bankRef: input.bankRef },
        create: {
          id: `payment:${deal.id}`,
          dealId: deal.id,
          status: 'FAILED',
          amountKopecks: deal.totalKopecks,
          callbackState: 'FAILED',
          bankRef: input.bankRef,
        },
      });
      await tx.bankOperation.update({
        where: { id: input.operationId },
        data: {
          status: 'FAILED',
          bankRef: input.bankRef,
          failureReason: input.errorMessage ?? 'bank_callback_failed',
          responsePayload: eventPayload as Prisma.InputJsonValue,
        },
      });

      const previousEvent = await tx.dealEvent.findFirst({
        where: { dealId: deal.id },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      });
      const eventId = `bank-failure-${randomUUID()}`;
      const eventHash = digest({
        id: eventId,
        dealId: deal.id,
        eventType: 'BANK_CALLBACK_FAILED',
        payload: eventPayload,
        prevHash: previousEvent?.hash ?? null,
      });
      await tx.dealEvent.create({
        data: {
          id: eventId,
          dealId: deal.id,
          eventType: 'BANK_CALLBACK_FAILED',
          actorId: callbackUser.id,
          actorRole: Role.BANK_CALLBACK,
          tenantId: deal.tenantId,
          payload: eventPayload as Prisma.InputJsonValue,
          hash: eventHash,
          prevHash: previousEvent?.hash ?? null,
        },
      });

      const previousAudit = await tx.auditEvent.findFirst({
        where: { dealId: deal.id },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      });
      const auditId = `audit-${randomUUID()}`;
      await tx.auditEvent.create({
        data: {
          id: auditId,
          action: 'deal.bank_callback.failed',
          actorUserId: callbackUser.id,
          actorRole: Role.BANK_CALLBACK,
          tenantId: deal.tenantId,
          orgId: callbackUser.orgId,
          dealId: deal.id,
          objectType: 'bank_operation',
          objectId: input.operationId,
          beforeState: { status: 'PENDING' },
          afterState: { status: 'FAILED', bankRef: input.bankRef },
          outcome: 'FAILURE',
          reason: input.errorMessage ?? 'bank_callback_failed',
          correlationId: input.eventId,
          hash: digest({ auditId, eventPayload, result, prevHash: previousAudit?.hash ?? null }),
          prevHash: previousAudit?.hash ?? null,
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
          payload: { fingerprint, eventPayload, result } as Prisma.InputJsonValue,
        },
      });

      return result;
    });
  }
}
