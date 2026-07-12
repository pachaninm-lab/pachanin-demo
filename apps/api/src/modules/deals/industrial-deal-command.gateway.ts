import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RlsTransactionService } from '../../common/prisma/rls-transaction.service';
import { RequestUser, Role } from '../../common/types/request-user';
import { DealCommandService } from './deal-command.service';
import { ExecuteDealCommandDto } from './dto/execute-deal-command.dto';
import {
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
  readonly totalKopecks: bigint | number | null;
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
    const scoped = await this.resolveMembership(dealId, user);
    return this.commands.workspace(dealId, scoped.user);
  }

  /**
   * Список сделок, в которых пользователь — активный участник.
   * Скоуп определяет PostgreSQL (DealParticipant + RLS trusted context),
   * никогда — клиент. Выборка ограничена и JSON-safe (bigint → number).
   */
  async listAccessibleDeals(user: RequestUser, take = 50) {
    if (!user.tenantId) {
      throw new ForbiddenException({ code: 'TENANT_CONTEXT_REQUIRED' });
    }
    const bounded = Math.min(Math.max(Math.trunc(take), 1), 100);
    const memberships = (await this.prisma.userOrg.findMany({
      where: { userId: user.id },
      select: { organizationId: true, role: true },
      orderBy: [{ isDefault: 'desc' }, { joinedAt: 'asc' }],
    })) as Array<{ organizationId: string; role: string }>;

    const byId = new Map<string, Record<string, unknown>>();
    for (const membership of memberships) {
      if (!KNOWN_ROLES.has(membership.role) || membership.role === Role.BANK_CALLBACK) continue;
      const scopedUser: RequestUser = {
        ...user,
        role: membership.role as Role,
        orgId: membership.organizationId,
        tenantId: user.tenantId,
      };
      const deals = await this.rls.withTrustedContext(scopedUser, (tx) =>
        tx.deal.findMany({
          where: {
            tenantId: user.tenantId,
            participants: {
              some: {
                userId: user.id,
                organizationId: membership.organizationId,
                role: membership.role,
                status: 'ACTIVE',
              },
            },
          },
          orderBy: { updatedAt: 'desc' },
          take: bounded,
          select: {
            id: true,
            dealNumber: true,
            status: true,
            culture: true,
            cropClass: true,
            region: true,
            volumeTons: true,
            totalKopecks: true,
            currency: true,
            version: true,
            updatedAt: true,
            nextAction: true,
          },
        }),
      );
      for (const deal of deals) {
        byId.set(deal.id, {
          ...deal,
          totalKopecks: deal.totalKopecks === null ? null : Number(deal.totalKopecks),
          version: Number(deal.version),
          updatedAt: deal.updatedAt.toISOString(),
          myRole: membership.role,
        });
      }
    }

    const items = [...byId.values()]
      .sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)))
      .slice(0, bounded);
    return { count: items.length, items };
  }

  /**
   * Единая correlation timeline сделки: доменные события, audit, outbox,
   * банковские операции и строки банковской выписки в одной хронологии.
   * Доступ — только участнику сделки (тот же fail-closed membership путь).
   * Выборки ограничены: берутся последние `perSourceLimit` записей каждого
   * источника (по индексу createdAt), unbounded-чтений нет.
   */
  async correlationTimeline(
    dealId: string,
    user: RequestUser,
    options: { perSourceLimit?: number } = {},
  ) {
    const perSourceLimit = Math.min(Math.max(Math.trunc(options.perSourceLimit ?? 200), 1), 500);
    const scoped = await this.resolveMembership(dealId, user);
    return this.rls.withTrustedContext(scoped.user, async (tx) => {
      const bounded = { orderBy: { createdAt: 'desc' as const }, take: perSourceLimit };
      const [dealEvents, auditEvents, outboxEntries, bankOperations, statementEntries] = await Promise.all([
        tx.dealEvent.findMany({ where: { dealId }, ...bounded }),
        tx.auditEvent.findMany({ where: { dealId }, ...bounded }),
        tx.outboxEntry.findMany({ where: { dealId }, ...bounded }),
        tx.bankOperation.findMany({ where: { dealId }, ...bounded }),
        tx.bankStatementEntry.findMany({ where: { matchedDealId: dealId }, ...bounded }),
      ]);

      const items = [
        ...dealEvents.map((event) => ({
          at: event.createdAt.toISOString(),
          source: 'deal_event' as const,
          id: event.id,
          kind: event.eventType,
          actor: event.actorId,
          correlationId: null as string | null,
          summary: event.eventType,
        })),
        ...auditEvents.map((event) => ({
          at: event.createdAt.toISOString(),
          source: 'audit' as const,
          id: event.id,
          kind: event.action,
          actor: event.actorUserId,
          correlationId: event.correlationId,
          summary: `${event.action} → ${event.outcome}`,
        })),
        ...outboxEntries.map((entry) => ({
          at: entry.createdAt.toISOString(),
          source: 'outbox' as const,
          id: entry.id,
          kind: entry.type,
          actor: null as string | null,
          correlationId: entry.correlationId,
          summary: `${entry.type} [${entry.status}]`,
        })),
        ...bankOperations.map((operation) => ({
          at: operation.createdAt.toISOString(),
          source: 'bank_operation' as const,
          id: operation.id,
          kind: operation.type,
          actor: operation.initiatorUserId,
          correlationId: operation.bankRef,
          summary: `${operation.type} ${operation.amountKopecks} коп. [${operation.status}]`,
        })),
        ...statementEntries.map((entry) => ({
          at: entry.createdAt.toISOString(),
          source: 'bank_statement' as const,
          id: entry.id,
          kind: 'STATEMENT_ROW',
          actor: null as string | null,
          correlationId: entry.reference,
          summary: `Выписка ${entry.amountKopecks} коп. [${entry.matchStatus}]`,
        })),
      ].sort((left, right) => left.at.localeCompare(right.at));

      return { dealId, count: items.length, perSourceLimit, items };
    });
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

    const scoped = await this.resolveMembership(dealId, user);
    return this.commands.execute(
      dealId,
      actionId,
      this.fingerprintedCommand(dealId, actionId, dto),
      scoped.user,
    );
  }

  async executeBankCallback(input: VerifiedBankCallbackInput) {
    this.validateBankCallback(input);

    const callbackUser = await this.bankCallbackUser(input);
    const deal = await this.readDealInTrustedScope(input.dealId, callbackUser);
    const actionId: DealActionId = input.operation === 'RESERVE' ? 'confirm_reserve' : 'confirm_release';
    const definition = getDealActionDefinition(actionId);

    if (definition.source !== 'BANK_CALLBACK') {
      throw new ConflictException({ code: 'INVALID_BANK_ACTION_POLICY' });
    }

    if (input.status === 'FAILED') {
      return this.recordBankFailure(input, deal, callbackUser);
    }

    const partnerId = input.partnerId ?? 'safe-deals';
    const callbackKey = `bank-callback:${partnerId}:${input.eventId}`;
    const eventPayload = {
      dealId: input.dealId,
      eventId: input.eventId,
      operation: input.operation,
      status: input.status,
      operationId: input.operationId ?? null,
      bankRef: input.bankRef,
      partnerId,
    };
    const eventFingerprint = digest(eventPayload);
    const commandId = `${callbackKey}:${eventFingerprint}`;
    const dto: ExecuteDealCommandDto = {
      commandId,
      idempotencyKey: callbackKey,
      expectedUpdatedAt: deal.updatedAt.toISOString(),
      payload: {
        ...eventPayload,
        requestFingerprint: eventFingerprint,
        clientIdempotencyKey: callbackKey,
      },
    };

    const result = await this.commands.execute(
      input.dealId,
      actionId,
      dto,
      callbackUser,
    );
    const storedCommandId = result && typeof result === 'object' && !Array.isArray(result)
      ? (result as { commandId?: unknown }).commandId
      : undefined;
    if (storedCommandId !== commandId) {
      throw new ConflictException({
        code: 'BANK_EVENT_REPLAY_MISMATCH',
        message: 'Bank event ID was already used with a different material payload.',
      });
    }
    return result;
  }

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

  /**
   * The bank is a cryptographically verified system actor, not a tenant user.
   * Its trusted RLS scope is resolved through the SECURITY DEFINER binding
   * (dealId, operationId) → (tenant, buyer org): the callback can only ever
   * act on a deal for which the platform itself issued that bank operation.
   * No binding → no scope → no money effect (fail closed).
   */
  private async bankCallbackUser(input: VerifiedBankCallbackInput): Promise<RequestUser> {
    const scopes = await this.prisma.$queryRaw<Array<{ tenantId: string; buyerOrgId: string }>>`
      SELECT "tenantId", "buyerOrgId"
      FROM public.app_bank_callback_scope(${input.dealId}, ${input.operationId ?? ''})
    `;
    const scope = scopes[0];
    if (!scope?.tenantId) {
      throw new ConflictException({
        code: 'BANK_OPERATION_NOT_PENDING',
        message: 'Callback is not bound to a platform-issued bank operation for this deal.',
      });
    }
    return {
      id: `bank-callback:${input.partnerId ?? 'safe-deals'}`,
      email: 'bank-callback@system.invalid',
      fullName: 'Verified bank callback',
      role: Role.BANK_CALLBACK,
      orgId: scope.buyerOrgId,
      tenantId: scope.tenantId,
      sessionId: `bank-event:${input.eventId}`,
      mfaVerified: true,
    };
  }

  /**
   * Authorization order is deliberately fail-closed:
   * UserOrg identity membership -> exact ACTIVE DealParticipant -> Organization -> Deal.
   * Client-supplied role and orgId never select scope.
   */
  private async resolveMembership(dealId: string, user: RequestUser) {
    if (!user.tenantId) {
      throw new ForbiddenException({
        code: 'TENANT_CONTEXT_REQUIRED',
        message: 'Verified session tenant is required.',
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
      if (!KNOWN_ROLES.has(membership.role) || membership.role === Role.BANK_CALLBACK) continue;

      const scopedUser: RequestUser = {
        ...user,
        role: membership.role as Role,
        orgId: membership.organizationId,
        tenantId: user.tenantId,
      };

      const scoped = await this.rls.withTrustedContext(scopedUser, async (tx) => {
        const participant = await tx.dealParticipant.findFirst({
          where: {
            dealId,
            tenantId: user.tenantId,
            organizationId: membership.organizationId,
            userId: user.id,
            role: membership.role,
            status: 'ACTIVE',
          },
          select: {
            id: true,
            accessLevel: true,
            status: true,
          },
        });
        if (!participant) return null;

        const organization = await tx.organization.findFirst({
          where: {
            id: membership.organizationId,
            tenantId: user.tenantId,
          },
          select: { id: true, tenantId: true, status: true },
        });
        if (!organization || organization.status !== 'VERIFIED') return null;

        const deal = await tx.deal.findUnique({
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
        if (!deal || !deal.tenantId || deal.tenantId !== user.tenantId) return null;

        return {
          deal: deal as CanonicalDealRecord,
          participant,
        };
      });

      if (scoped) {
        return { ...scoped, user: scopedUser };
      }
    }

    throw new ForbiddenException({
      code: 'ACTIVE_DEAL_PARTICIPANT_REQUIRED',
      message: 'No active database-backed participant assignment for this deal.',
    });
  }

  private async readDealInTrustedScope(
    dealId: string,
    trustedUser: RequestUser,
  ): Promise<CanonicalDealRecord> {
    const deal = await this.rls.withTrustedContext(trustedUser, (tx) =>
      tx.deal.findUnique({
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
      }),
    );

    if (!deal || !deal.tenantId) {
      throw new ForbiddenException({
        code: 'DEAL_SCOPE_DENIED',
        message: 'Deal is not visible in the trusted tenant and object scope.',
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
      // Тот же per-deal advisory lock, что и в командном pipeline: провальный
      // callback дописывает те же hash-цепочки и не должен гоняться с командами.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${deal.id}, 42)) IS NULL AS locked`;

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
