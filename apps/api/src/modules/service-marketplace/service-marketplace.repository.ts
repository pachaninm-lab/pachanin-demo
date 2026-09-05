import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  transitionServiceMarketplace,
  type ServiceMarketplaceStatus,
} from '../../../../../packages/domain-core/src';
import {
  RlsTransactionService,
  type TrustedRlsContext,
} from '../../common/prisma/rls-transaction.service';
import type { RequestUser } from '../../common/types/request-user';
import {
  normalizeServiceMarketplaceCommand,
  serviceMarketplaceCommandFingerprint,
  serviceMarketplaceDigest,
  stableServiceMarketplaceJson,
  type ServiceMarketplaceCommand,
  type ServiceMarketplaceReceipt,
} from './service-marketplace.contract';

type RequestRow = {
  id: string;
  tenantId: string;
  requesterOrganizationId: string;
  category: string;
  serviceStage: string;
  subjectType: string;
  subjectId: string;
  description: string;
  targetRegion: string | null;
  status: ServiceMarketplaceStatus;
  stateVersion: bigint;
  selectedQuoteId: string | null;
  selectedProviderOrganizationId: string | null;
  payerAssignmentId: string | null;
  payerOrganizationId: string | null;
  payerMembershipId: string | null;
  payerConfirmedByMembershipId: string | null;
  payerConfirmedAt: Date | null;
  executionReference: string | null;
  evidenceReference: string | null;
  evidenceHash: string | null;
  acceptanceNote: string | null;
  settlementReferenceType: string | null;
  settlementReference: string | null;
  createsFinancialObligation: false;
  createdByMembershipId: string;
  updatedByMembershipId: string;
  updatedByOrganizationId: string;
  createdAt: Date;
  updatedAt: Date;
};

type QuoteAuthority = {
  providerId: string;
  capabilityId: string;
};

type ReplayRow = {
  requestId: string;
  action: ServiceMarketplaceCommand['action'];
  toStatus: ServiceMarketplaceStatus;
  aggregateVersion: bigint;
  commandId: string;
  idempotencyKey: string;
  correlationId: string;
  requestFingerprint: string;
  receipt: ServiceMarketplaceReceipt;
  createdAt: Date;
};

function deterministicId(prefix: string, material: string): string {
  return `${prefix}-${serviceMarketplaceDigest(material).slice(0, 32)}`;
}

function databaseCode(error: unknown): string | null {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') return '23505';
    if (error.code === 'P2034') return '40001';
    const meta = error.meta as Record<string, unknown> | undefined;
    if (typeof meta?.code === 'string') return meta.code;
  }
  if (!error || typeof error !== 'object') return null;
  const candidate = error as { code?: unknown; meta?: unknown };
  if (typeof candidate.code === 'string') return candidate.code;
  if (candidate.meta && typeof candidate.meta === 'object') {
    const meta = candidate.meta as Record<string, unknown>;
    if (typeof meta.code === 'string') return meta.code;
  }
  return null;
}

function databaseInvariant(error: unknown): string | null {
  const message = error instanceof Error ? error.message : String(error);
  return /\b(PC_SERVICE_[A-Z0-9_]+)\b/u.exec(message)?.[1] ?? null;
}

function staleVersion(current: bigint | string): ConflictException {
  return new ConflictException({
    code: 'SERVICE_MARKETPLACE_STALE_VERSION',
    currentVersion: current.toString(),
    refreshRequired: true,
  });
}

@Injectable()
export class ServiceMarketplaceRepository {
  constructor(private readonly rls: RlsTransactionService) {}

  async listOwn(user: RequestUser) {
    return this.rls.withTrustedContext(user, async (tx, context) => {
      const requests = await tx.$queryRaw<RequestRow[]>(Prisma.sql`
        SELECT * FROM public."service_marketplace_requests"
         WHERE "tenantId" = ${context.tenantId}
         ORDER BY "updatedAt" DESC, "id" ASC
      `);
      return {
        tenantId: context.tenantId,
        organizationId: context.orgId,
        authority: 'POSTGRESQL' as const,
        createsFinancialObligation: false as const,
        items: requests.map((row) => this.snapshot(row)),
      };
    });
  }

  async execute(user: RequestUser, input: unknown): Promise<ServiceMarketplaceReceipt> {
    const command = normalizeServiceMarketplaceCommand(input);
    if (!user.membershipId?.trim()) throw new ForbiddenException({ code: 'MEMBERSHIP_REQUIRED' });
    const fingerprint = serviceMarketplaceCommandFingerprint(command);
    try {
      return await this.rls.withTrustedContext(user, async (tx, context) => {
        await tx.$queryRaw(Prisma.sql`
          SELECT pg_advisory_xact_lock(hashtextextended(
            ${`${context.tenantId}:${context.orgId}:service-marketplace:idempotency:${command.idempotencyKey}`}, 0
          )) IS NULL AS "locked"
        `);
        await tx.$queryRaw(Prisma.sql`
          SELECT pg_advisory_xact_lock(hashtextextended(
            ${`${context.tenantId}:service-marketplace:request:${command.requestId}`}, 0
          )) IS NULL AS "locked"
        `);
        await tx.$queryRaw(Prisma.sql`
          SELECT set_config('app.current_command_id', ${command.commandId}, true),
                 set_config('app.current_service_marketplace_action', ${command.action}, true)
        `);

        const replay = await this.findReplay(tx, context, command, fingerprint);
        if (replay) return replay;
        const clock = await tx.$queryRaw<Array<{ now: Date }>>(Prisma.sql`SELECT clock_timestamp() AS now`);
        const committedAt = clock[0]?.now ?? new Date();
        const before = command.action === 'CREATE_REQUEST'
          ? null
          : await this.findRequestForUpdate(tx, context, command.requestId);
        if (command.action !== 'CREATE_REQUEST' && !before) {
          throw new NotFoundException({ code: 'SERVICE_MARKETPLACE_REQUEST_NOT_FOUND' });
        }
        if (before && before.stateVersion !== BigInt(command.expectedStateVersion)) {
          throw staleVersion(before.stateVersion);
        }
        const expectedStatus = transitionServiceMarketplace(before?.status ?? null, command.action);
        const after = command.action === 'CREATE_REQUEST'
          ? await this.createRequest(tx, context, user.membershipId!, command, committedAt)
          : await this.advanceRequest(tx, context, user.membershipId!, command, before!, expectedStatus, committedAt);
        const receipt = await this.appendEvidence(
          tx, context, user, command, fingerprint, before, after, committedAt,
        );
        await tx.$executeRaw(Prisma.sql`SET CONSTRAINTS service_marketplace_request_evidence_guard IMMEDIATE`);
        return receipt;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxConflictRetries: 3 });
    } catch (error) {
      const code = databaseCode(error);
      if (code === '40001' || code === '40P01') throw staleVersion(command.expectedStateVersion);
      if (code === '23505') {
        throw new ConflictException({ code: 'SERVICE_MARKETPLACE_CONFLICT', refreshRequired: true });
      }
      if (code === '42501') throw new ForbiddenException({ code: 'SERVICE_MARKETPLACE_ACTOR_FORBIDDEN' });
      if (code === '23000' || code === '23514' || code === '23503') {
        throw new UnprocessableEntityException({
          code: databaseInvariant(error) ?? 'SERVICE_MARKETPLACE_INVARIANT_REJECTED',
        });
      }
      throw error;
    }
  }

  private async createRequest(
    tx: Prisma.TransactionClient,
    context: TrustedRlsContext,
    membershipId: string,
    command: Extract<ServiceMarketplaceCommand, { action: 'CREATE_REQUEST' }>,
    now: Date,
  ): Promise<RequestRow> {
    const rows = await tx.$queryRaw<RequestRow[]>(Prisma.sql`
      INSERT INTO public."service_marketplace_requests" (
        "id", "tenantId", "requesterOrganizationId", "category", "serviceStage", "subjectType",
        "subjectId", "description", "targetRegion", "status", "stateVersion",
        "createsFinancialObligation", "createdByMembershipId", "updatedByMembershipId",
        "updatedByOrganizationId", "createdAt", "updatedAt"
      ) VALUES (
        ${command.requestId}, ${context.tenantId}, ${context.orgId}, ${command.category}, ${command.serviceStage},
        ${command.subjectType}, ${command.subjectId}, ${command.description}, ${command.targetRegion}, 'REQUESTED', 1,
        false, ${membershipId}, ${membershipId}, ${context.orgId}, ${now}, ${now}
      ) RETURNING *
    `);
    return rows[0]!;
  }

  private async advanceRequest(
    tx: Prisma.TransactionClient,
    context: TrustedRlsContext,
    membershipId: string,
    command: Exclude<ServiceMarketplaceCommand, { action: 'CREATE_REQUEST' }>,
    before: RequestRow,
    nextStatus: ServiceMarketplaceStatus,
    now: Date,
  ): Promise<RequestRow> {
    if (command.action === 'SUBMIT_QUOTE') {
      const authority = await this.quoteAuthority(tx, context, command.serviceOfferingId);
      if (!authority) throw new NotFoundException({ code: 'SERVICE_OFFERING_NOT_ELIGIBLE' });
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO public."service_marketplace_quotes" (
          "id", "tenantId", "requestId", "providerOrganizationId", "providerId", "capabilityId",
          "serviceOfferingId", "serviceOfferingVersion", "commercialDecisionId", "quoteType",
          "amountKopecks", "currency", "payerMode", "termsHash", "expiresAt", "createdByMembershipId", "createdAt"
        ) VALUES (
          ${command.quoteId}, ${context.tenantId}, ${command.requestId}, ${context.orgId}, ${authority.providerId},
          ${authority.capabilityId}, ${command.serviceOfferingId}, ${BigInt(command.serviceOfferingVersion)},
          ${command.commercialDecisionId}, ${command.quoteType}, ${BigInt(command.amountKopecks)}, ${command.currency},
          ${command.payerMode}, ${command.termsHash}, ${new Date(command.expiresAt)}, ${membershipId}, ${now}
        )
      `);
    }

    let rows: RequestRow[];
    const common = Prisma.sql`
      "status" = ${nextStatus}, "stateVersion" = "stateVersion" + 1,
      "updatedByMembershipId" = ${membershipId}, "updatedByOrganizationId" = ${context.orgId}, "updatedAt" = ${now}
    `;
    switch (command.action) {
      case 'SUBMIT_QUOTE':
        rows = await tx.$queryRaw<RequestRow[]>(Prisma.sql`
          UPDATE public."service_marketplace_requests" SET ${common}
           WHERE "id" = ${before.id} AND "tenantId" = ${context.tenantId} AND "stateVersion" = ${before.stateVersion}
           RETURNING *
        `);
        break;
      case 'SELECT_PROVIDER': {
        const quotes = await tx.$queryRaw<Array<{ providerOrganizationId: string }>>(Prisma.sql`
          SELECT "providerOrganizationId" FROM public."service_marketplace_quotes"
           WHERE "id" = ${command.quoteId} AND "requestId" = ${before.id} AND "tenantId" = ${context.tenantId}
             AND "expiresAt" > ${now} LIMIT 1
        `);
        if (!quotes[0]) throw new NotFoundException({ code: 'SERVICE_QUOTE_NOT_SELECTABLE' });
        rows = await tx.$queryRaw<RequestRow[]>(Prisma.sql`
          UPDATE public."service_marketplace_requests" SET ${common},
            "selectedQuoteId" = ${command.quoteId},
            "selectedProviderOrganizationId" = ${quotes[0].providerOrganizationId}
           WHERE "id" = ${before.id} AND "tenantId" = ${context.tenantId} AND "stateVersion" = ${before.stateVersion}
           RETURNING *
        `);
        break;
      }
      case 'ASSIGN_PAYER':
        rows = await tx.$queryRaw<RequestRow[]>(Prisma.sql`
          UPDATE public."service_marketplace_requests" SET ${common},
            "payerAssignmentId" = ${command.payerAssignmentId}, "payerOrganizationId" = ${command.payerOrganizationId},
            "payerMembershipId" = ${command.payerMembershipId}, "payerConfirmedByMembershipId" = NULL,
            "payerConfirmedAt" = NULL
           WHERE "id" = ${before.id} AND "tenantId" = ${context.tenantId} AND "stateVersion" = ${before.stateVersion}
           RETURNING *
        `);
        break;
      case 'CONFIRM_PAYER':
        if (command.payerAssignmentId !== before.payerAssignmentId) {
          throw new ConflictException({ code: 'SERVICE_PAYER_ASSIGNMENT_CHANGED', refreshRequired: true });
        }
        rows = await tx.$queryRaw<RequestRow[]>(Prisma.sql`
          UPDATE public."service_marketplace_requests" SET ${common},
            "payerConfirmedByMembershipId" = ${membershipId}, "payerConfirmedAt" = ${now}
           WHERE "id" = ${before.id} AND "tenantId" = ${context.tenantId} AND "stateVersion" = ${before.stateVersion}
           RETURNING *
        `);
        break;
      case 'START_EXECUTION':
        rows = await tx.$queryRaw<RequestRow[]>(Prisma.sql`
          UPDATE public."service_marketplace_requests" SET ${common}, "executionReference" = ${command.executionReference}
           WHERE "id" = ${before.id} AND "tenantId" = ${context.tenantId} AND "stateVersion" = ${before.stateVersion}
           RETURNING *
        `);
        break;
      case 'SUBMIT_EVIDENCE':
        rows = await tx.$queryRaw<RequestRow[]>(Prisma.sql`
          UPDATE public."service_marketplace_requests" SET ${common},
            "evidenceReference" = ${command.evidenceReference}, "evidenceHash" = ${command.evidenceHash}
           WHERE "id" = ${before.id} AND "tenantId" = ${context.tenantId} AND "stateVersion" = ${before.stateVersion}
           RETURNING *
        `);
        break;
      case 'ACCEPT_SERVICE':
        rows = await tx.$queryRaw<RequestRow[]>(Prisma.sql`
          UPDATE public."service_marketplace_requests" SET ${common}, "acceptanceNote" = ${command.acceptanceNote}
           WHERE "id" = ${before.id} AND "tenantId" = ${context.tenantId} AND "stateVersion" = ${before.stateVersion}
           RETURNING *
        `);
        break;
      case 'RECORD_SETTLEMENT':
        rows = await tx.$queryRaw<RequestRow[]>(Prisma.sql`
          UPDATE public."service_marketplace_requests" SET ${common},
            "settlementReferenceType" = ${command.settlementReferenceType},
            "settlementReference" = ${command.settlementReference}, "createsFinancialObligation" = false
           WHERE "id" = ${before.id} AND "tenantId" = ${context.tenantId} AND "stateVersion" = ${before.stateVersion}
           RETURNING *
        `);
        break;
    }
    if (!rows[0]) throw staleVersion(before.stateVersion);
    return rows[0];
  }

  private async findRequestForUpdate(
    tx: Prisma.TransactionClient,
    context: TrustedRlsContext,
    requestId: string,
  ): Promise<RequestRow | null> {
    const rows = await tx.$queryRaw<RequestRow[]>(Prisma.sql`
      SELECT * FROM public."service_marketplace_requests"
       WHERE "id" = ${requestId} AND "tenantId" = ${context.tenantId} FOR UPDATE
    `);
    return rows[0] ?? null;
  }

  private async quoteAuthority(
    tx: Prisma.TransactionClient,
    context: TrustedRlsContext,
    serviceOfferingId: string,
  ): Promise<QuoteAuthority | null> {
    const rows = await tx.$queryRaw<QuoteAuthority[]>(Prisma.sql`
      SELECT offering."providerId", offering."capabilityId"
        FROM public."service_offerings" offering
        JOIN public."provider_capabilities" capability
          ON capability."id" = offering."capabilityId" AND capability."providerId" = offering."providerId"
         AND capability."tenantId" = offering."tenantId" AND capability."organizationId" = offering."organizationId"
        JOIN public."providers" provider
          ON provider."id" = offering."providerId" AND provider."tenantId" = offering."tenantId"
         AND provider."organizationId" = offering."organizationId"
       WHERE offering."id" = ${serviceOfferingId} AND offering."tenantId" = ${context.tenantId}
         AND offering."organizationId" = ${context.orgId} AND offering."status" = 'ACTIVE'
         AND capability."status" = 'ACTIVE' AND provider."status" = 'ACTIVE' LIMIT 1
    `);
    return rows[0] ?? null;
  }

  private async appendEvidence(
    tx: Prisma.TransactionClient,
    context: TrustedRlsContext,
    user: RequestUser,
    command: ServiceMarketplaceCommand,
    requestFingerprint: string,
    before: RequestRow | null,
    after: RequestRow,
    committedAt: Date,
  ): Promise<ServiceMarketplaceReceipt> {
    const identity = `${context.tenantId}:${context.orgId}:${command.commandId}`;
    const auditId = deterministicId('audit-service-marketplace', identity);
    const eventId = deterministicId('service-marketplace-event', identity);
    const outboxEntryId = deterministicId('outbox-service-marketplace', identity);
    const outboxKey = `service-marketplace:${serviceMarketplaceDigest({
      tenantId: context.tenantId,
      organizationId: context.orgId,
      idempotencyKey: command.idempotencyKey,
    })}`;
    const beforeState = before ? this.snapshot(before) : null;
    const afterState = this.snapshot(after);
    const receipt: ServiceMarketplaceReceipt = {
      requestId: after.id,
      action: command.action,
      status: after.status,
      stateVersion: after.stateVersion.toString(),
      commandId: command.commandId,
      idempotencyKey: command.idempotencyKey,
      correlationId: command.correlationId,
      quoteId: command.action === 'SUBMIT_QUOTE' ? command.quoteId : after.selectedQuoteId,
      payerAssignmentId: after.payerAssignmentId,
      createsFinancialObligation: false,
      replayed: false,
      committedAt: committedAt.toISOString(),
    };
    const previousAudit = await tx.auditEvent.findFirst({
      where: { objectType: 'SERVICE_MARKETPLACE_REQUEST', objectId: after.id },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { hash: true },
    });
    const auditMaterial = {
      id: auditId,
      action: `SERVICE_MARKETPLACE_${command.action}`,
      actorUserId: context.userId,
      actorRole: context.role,
      tenantId: context.tenantId,
      orgId: context.orgId,
      objectType: 'SERVICE_MARKETPLACE_REQUEST',
      objectId: after.id,
      beforeState,
      afterState,
      outcome: 'SUCCESS',
      reason: command.reason,
      correlationId: command.correlationId,
      requestFingerprint,
      prevHash: previousAudit?.hash ?? null,
    };
    await tx.auditEvent.create({ data: {
      id: auditId,
      action: auditMaterial.action,
      actorUserId: context.userId,
      actorRole: context.role,
      tenantId: context.tenantId,
      orgId: context.orgId,
      objectType: 'SERVICE_MARKETPLACE_REQUEST',
      objectId: after.id,
      beforeState: stableServiceMarketplaceJson(beforeState) as Prisma.InputJsonValue,
      afterState: stableServiceMarketplaceJson(afterState) as Prisma.InputJsonValue,
      outcome: 'SUCCESS',
      reason: command.reason,
      metadata: stableServiceMarketplaceJson({
        schema: 'service-marketplace.audit.v1', commandId: command.commandId,
        idempotencyKey: command.idempotencyKey, membershipId: user.membershipId,
        sessionId: context.sessionId, requestFingerprint, createsFinancialObligation: false,
      }) as Prisma.InputJsonValue,
      correlationId: command.correlationId,
      runtimeIdempotencyKey: outboxKey,
      hash: serviceMarketplaceDigest(auditMaterial),
      prevHash: previousAudit?.hash ?? null,
      createdAt: committedAt,
    }});

    const previousEvents = await tx.$queryRaw<Array<{ hash: string }>>(Prisma.sql`
      SELECT "hash" FROM public."service_marketplace_events"
       WHERE "tenantId" = ${context.tenantId} AND "requestId" = ${after.id}
       ORDER BY "createdAt" DESC, "id" DESC LIMIT 1
    `);
    const payload = stableServiceMarketplaceJson(command);
    const eventMaterial = {
      id: eventId,
      tenantId: context.tenantId,
      requestId: after.id,
      actorOrganizationId: context.orgId,
      commandId: command.commandId,
      idempotencyKey: command.idempotencyKey,
      requestFingerprint,
      action: command.action,
      fromStatus: before?.status ?? null,
      toStatus: after.status,
      actorUserId: context.userId,
      actorRole: context.role,
      actorMembershipId: user.membershipId!,
      correlationId: command.correlationId,
      reason: command.reason,
      payload,
      receipt,
      prevHash: previousEvents[0]?.hash ?? null,
      auditEventId: auditId,
      outboxEntryId,
      aggregateVersion: after.stateVersion.toString(),
    };
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO public."service_marketplace_events" (
        "id", "tenantId", "requestId", "actorOrganizationId", "commandId", "idempotencyKey",
        "requestFingerprint", "action", "fromStatus", "toStatus", "actorUserId", "actorRole",
        "actorMembershipId", "correlationId", "reason", "payload", "receipt", "prevHash", "hash",
        "auditEventId", "outboxEntryId", "aggregateVersion", "createdAt"
      ) VALUES (
        ${eventId}, ${context.tenantId}, ${after.id}, ${context.orgId}, ${command.commandId}, ${command.idempotencyKey},
        ${requestFingerprint}, ${command.action}, ${before?.status ?? null}, ${after.status}, ${context.userId}, ${context.role},
        ${user.membershipId!}, ${command.correlationId}, ${command.reason}, ${JSON.stringify(payload)}::jsonb,
        ${JSON.stringify(receipt)}::jsonb, ${previousEvents[0]?.hash ?? null}, ${serviceMarketplaceDigest(eventMaterial)},
        ${auditId}, ${outboxEntryId}, ${after.stateVersion}, ${committedAt}
      )
    `);
    const event = {
      type: 'service.marketplace.changed.v1',
      requestId: after.id,
      tenantId: context.tenantId,
      actorOrganizationId: context.orgId,
      commandId: command.commandId,
      action: command.action,
      status: after.status,
      aggregateVersion: after.stateVersion.toString(),
      correlationId: command.correlationId,
      auditId,
      occurredAt: committedAt.toISOString(),
      createsFinancialObligation: false,
    };
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO public."outbox_entries" (
        "id", "type", "payload", "status", "triggeredByUserId", "idempotencyKey",
        "correlationId", "auditId", "runtimeIdempotencyKey", "maxRetries", "nextRetryAt", "createdAt"
      ) VALUES (
        ${outboxEntryId}, ${event.type},
        ${JSON.stringify({ schema: 'service-marketplace.command.v1', requestFingerprint, receipt, event })}::jsonb,
        'PENDING', ${context.userId}, ${outboxKey}, ${command.correlationId}, ${auditId}, ${outboxKey}, 5,
        ${committedAt}, ${committedAt}
      )
    `);
    return receipt;
  }

  private async findReplay(
    tx: Prisma.TransactionClient,
    context: TrustedRlsContext,
    command: ServiceMarketplaceCommand,
    fingerprint: string,
  ): Promise<ServiceMarketplaceReceipt | null> {
    const rows = await tx.$queryRaw<ReplayRow[]>(Prisma.sql`
      SELECT "requestId", "action", "toStatus", "aggregateVersion", "commandId", "idempotencyKey",
             "correlationId", "requestFingerprint", "receipt", "createdAt"
        FROM public."service_marketplace_events"
       WHERE "tenantId" = ${context.tenantId} AND "actorOrganizationId" = ${context.orgId}
         AND "idempotencyKey" = ${command.idempotencyKey} LIMIT 1
    `);
    const row = rows[0];
    if (!row) return null;
    if (row.requestFingerprint !== fingerprint) {
      throw new ConflictException({ code: 'SERVICE_MARKETPLACE_IDEMPOTENCY_PAYLOAD_MISMATCH' });
    }
    return { ...row.receipt, replayed: true, committedAt: row.createdAt.toISOString() };
  }

  private snapshot(row: RequestRow): Record<string, unknown> {
    return {
      id: row.id,
      tenantId: row.tenantId,
      requesterOrganizationId: row.requesterOrganizationId,
      category: row.category,
      serviceStage: row.serviceStage,
      subjectType: row.subjectType,
      subjectId: row.subjectId,
      description: row.description,
      targetRegion: row.targetRegion,
      status: row.status,
      stateVersion: row.stateVersion.toString(),
      selectedQuoteId: row.selectedQuoteId,
      selectedProviderOrganizationId: row.selectedProviderOrganizationId,
      payerAssignmentId: row.payerAssignmentId,
      payerOrganizationId: row.payerOrganizationId,
      payerMembershipId: row.payerMembershipId,
      payerConfirmedByMembershipId: row.payerConfirmedByMembershipId,
      payerConfirmedAt: row.payerConfirmedAt?.toISOString() ?? null,
      executionReference: row.executionReference,
      evidenceReference: row.evidenceReference,
      evidenceHash: row.evidenceHash,
      acceptanceNote: row.acceptanceNote,
      settlementReferenceType: row.settlementReferenceType,
      settlementReference: row.settlementReference,
      createsFinancialObligation: false,
      createdByMembershipId: row.createdByMembershipId,
      updatedByMembershipId: row.updatedByMembershipId,
      updatedByOrganizationId: row.updatedByOrganizationId,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
