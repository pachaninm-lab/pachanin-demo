import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import {
  RlsTransactionService,
  type TrustedRlsContext,
} from '../../common/prisma/rls-transaction.service';
import type { RequestUser } from '../../common/types/request-user';
import {
  assertIdempotentReplay,
  type CommodityProfileCommand,
  type CommodityProfileCommandReceipt,
} from './commodity-profile-command.contract';
import {
  CommodityProfileAction,
  type CommodityProfileClassification,
  type CommodityProfileLifecycle,
} from './commodity-profile.policy';
import type {
  CommodityProfileAtomicWrite,
  CommodityProfileCommandSnapshot,
  CommodityProfileTransactionPort,
} from './commodity-profile-transaction-command.service';

type JsonRecord = Record<string, unknown>;

type LockedProfile = {
  id: string;
  classification: CommodityProfileClassification;
  version: bigint;
  canonicalCode: string;
  archetype: string;
  authoritativeNameRu: string;
  displayNameEn: string | null;
  displayNameZh: string | null;
  updatedAt: Date;
};

type LockedVersion = {
  id: string;
  profileId: string;
  sequence: number;
  status: CommodityProfileLifecycle;
  content: Prisma.JsonValue;
  contentHash: string;
  sourceStatus: string;
  effectiveFrom: Date | null;
  effectiveTo: Date | null;
  approvalReason: string | null;
  approvedByUserId: string | null;
  approvedAt: Date | null;
  version: bigint;
  updatedAt: Date;
};

type TransitionHead = {
  toStatus: CommodityProfileLifecycle;
  hash: string;
};

type ReceiptEnvelope = {
  schema: 'commodity-profile.command.v1';
  requestFingerprint: string;
  receipt: CommodityProfileCommandReceipt;
  event: JsonRecord;
};

const CLASSIFICATIONS = new Set<CommodityProfileClassification>([
  'PUBLIC',
  'INTERNAL',
  'CONFIDENTIAL',
  'PERSONAL',
  'COMMERCIAL_SECRET',
]);
const ARCHETYPES = new Set([
  'DRY_BULK',
  'SEED_PLANTING',
  'ROOT_INDUSTRIAL',
  'FRESH_PACKED',
  'GREENHOUSE_RECURRING',
  'ORGANIC_EXPORT_QUARANTINE',
]);
const SOURCE_STATUSES = new Set(['VERIFIED', 'REVERIFY_REQUIRED', 'BLOCKED_EXTERNAL']);

function stable(value: unknown): unknown {
  if (value === undefined) return null;
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

function payload(command: CommodityProfileCommand): JsonRecord {
  return command.payload ?? {};
}

function requiredText(
  source: JsonRecord,
  field: string,
  maxLength: number,
  pattern?: RegExp,
): string {
  const value = typeof source[field] === 'string' ? source[field].trim() : '';
  if (!value || value.length > maxLength || (pattern && !pattern.test(value))) {
    throw new UnprocessableEntityException({
      code: 'COMMODITY_PROFILE_PAYLOAD_INVALID',
      field,
    });
  }
  return value;
}

function optionalText(source: JsonRecord, field: string, maxLength: number): string | null {
  if (source[field] === undefined || source[field] === null) return null;
  return requiredText(source, field, maxLength);
}

function requiredContent(source: JsonRecord): JsonRecord {
  const value = source.content;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new UnprocessableEntityException({
      code: 'COMMODITY_PROFILE_CONTENT_REQUIRED',
      field: 'content',
    });
  }
  return value as JsonRecord;
}

function classification(source: JsonRecord): CommodityProfileClassification {
  const value = typeof source.classification === 'string'
    ? source.classification.trim()
    : 'INTERNAL';
  if (!CLASSIFICATIONS.has(value as CommodityProfileClassification)) {
    throw new UnprocessableEntityException({
      code: 'COMMODITY_PROFILE_CLASSIFICATION_INVALID',
      field: 'classification',
    });
  }
  return value as CommodityProfileClassification;
}

function archetype(source: JsonRecord): string {
  const value = requiredText(source, 'archetype', 40);
  if (!ARCHETYPES.has(value)) {
    throw new UnprocessableEntityException({
      code: 'COMMODITY_PROFILE_ARCHETYPE_INVALID',
      field: 'archetype',
    });
  }
  return value;
}

function sourceStatus(source: JsonRecord, fallback = 'REVERIFY_REQUIRED'): string {
  const value = typeof source.sourceStatus === 'string'
    ? source.sourceStatus.trim()
    : fallback;
  if (!SOURCE_STATUSES.has(value)) {
    throw new UnprocessableEntityException({
      code: 'COMMODITY_PROFILE_SOURCE_STATUS_INVALID',
      field: 'sourceStatus',
    });
  }
  return value;
}

function optionalDate(source: JsonRecord, field: string): Date | null {
  const value = source[field];
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') {
    throw new UnprocessableEntityException({ code: 'COMMODITY_PROFILE_DATE_INVALID', field });
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new UnprocessableEntityException({ code: 'COMMODITY_PROFILE_DATE_INVALID', field });
  }
  return parsed;
}

function deterministicId(prefix: string, commandId: string): string {
  return `${prefix}-${digest(commandId).slice(0, 32)}`;
}

function outboxIdempotencyKey(command: CommodityProfileCommand): string {
  return `cp-command:${digest(command.idempotencyKey)}`;
}

function receiptFromPayload(value: Prisma.JsonValue): CommodityProfileCommandReceipt | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const envelope = value as JsonRecord;
  if (envelope.schema !== 'commodity-profile.command.v1') return null;
  const candidate = envelope.receipt;
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return null;
  const receipt = candidate as JsonRecord;
  const required = [
    'commandId',
    'idempotencyKey',
    'correlationId',
    'profileId',
    'action',
    'version',
    'requestFingerprint',
    'committedAt',
  ];
  if (required.some((field) => typeof receipt[field] !== 'string')) return null;
  if (typeof receipt.replayed !== 'boolean') return null;
  return receipt as CommodityProfileCommandReceipt;
}

function staleVersion(currentVersion: bigint | string): ConflictException {
  return new ConflictException({
    code: 'COMMODITY_PROFILE_STALE_VERSION',
    currentVersion: currentVersion.toString(),
    refreshRequired: true,
  });
}

function versionRequired(): never {
  throw new UnprocessableEntityException({
    code: 'COMMODITY_PROFILE_VERSION_ID_REQUIRED',
    field: 'profileVersionId',
  });
}

function databaseCode(error: unknown): string | null {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') return '23505';
    if (error.code === 'P2034') return '40001';
    const meta = error.meta as JsonRecord | undefined;
    if (typeof meta?.code === 'string') return meta.code;
  }
  if (!error || typeof error !== 'object') return null;
  const candidate = error as { code?: unknown; meta?: unknown };
  if (typeof candidate.code === 'string') return candidate.code;
  if (candidate.meta && typeof candidate.meta === 'object') {
    const meta = candidate.meta as JsonRecord;
    if (typeof meta.code === 'string') return meta.code;
  }
  return null;
}

function databaseMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

@Injectable()
export class PostgresqlCommodityProfileTransactionPort
implements CommodityProfileTransactionPort {
  constructor(private readonly rls: RlsTransactionService) {}

  async findReplay(
    actor: RequestUser,
    command: CommodityProfileCommand,
  ): Promise<CommodityProfileCommandReceipt | null> {
    return this.rls.withTrustedContext(actor, async (tx) =>
      this.findReplayInTransaction(tx, command));
  }

  async loadSnapshot(
    actor: RequestUser,
    command: CommodityProfileCommand,
  ): Promise<CommodityProfileCommandSnapshot> {
    return this.rls.withTrustedContext(actor, async (tx) => {
      if (command.action === CommodityProfileAction.CREATE_PROFILE) {
        const existing = await tx.commodityProfile.findUnique({
          where: { id: command.profileId },
          select: { id: true, version: true },
        });
        if (existing) {
          throw new ConflictException({
            code: 'COMMODITY_PROFILE_ALREADY_EXISTS',
            currentVersion: existing.version.toString(),
          });
        }
        return {
          profileId: command.profileId,
          classification: classification(payload(command)),
          version: '0',
        };
      }

      const profile = await tx.commodityProfile.findUnique({
        where: { id: command.profileId },
        select: { id: true, classification: true, version: true },
      });
      if (!profile) {
        throw new NotFoundException({ code: 'COMMODITY_PROFILE_NOT_FOUND' });
      }

      if (command.action === CommodityProfileAction.CREATE_DRAFT) {
        return {
          profileId: profile.id,
          classification: profile.classification as CommodityProfileClassification,
          version: profile.version.toString(),
        };
      }

      const profileVersionId = command.profileVersionId ?? versionRequired();
      const selected = await tx.commodityProfileVersion.findFirst({
        where: { id: profileVersionId, profileId: profile.id },
        select: { id: true, status: true },
      });
      if (!selected) {
        throw new NotFoundException({ code: 'COMMODITY_PROFILE_VERSION_NOT_FOUND' });
      }

      return {
        profileId: profile.id,
        profileVersionId: selected.id,
        lifecycle: selected.status as CommodityProfileLifecycle,
        classification: profile.classification as CommodityProfileClassification,
        version: profile.version.toString(),
      };
    });
  }

  async commitAtomic(write: CommodityProfileAtomicWrite): Promise<CommodityProfileCommandReceipt> {
    try {
      return await this.rls.withTrustedContext(
        write.actor,
        async (tx, context) => this.commitInTransaction(tx, context, write),
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxConflictRetries: 3,
          timeout: 20_000,
        },
      );
    } catch (error) {
      if (databaseCode(error) === '23505') {
        const replay = await this.findReplay(write.actor, write.command);
        if (replay) {
          assertIdempotentReplay(replay.requestFingerprint, write.command);
          return { ...replay, replayed: true };
        }
      }
      throw this.mapDatabaseError(error);
    }
  }

  private async commitInTransaction(
    tx: Prisma.TransactionClient,
    context: TrustedRlsContext,
    write: CommodityProfileAtomicWrite,
  ): Promise<CommodityProfileCommandReceipt> {
    const { command } = write;
    await tx.$queryRaw(Prisma.sql`
      SELECT pg_advisory_xact_lock(hashtextextended(${command.profileId}, 0))
    `);
    await tx.$queryRaw(Prisma.sql`
      SELECT set_config('app.current_command_id', ${command.commandId}, true)
    `);

    const replay = await this.findReplayInTransaction(tx, command);
    if (replay) {
      assertIdempotentReplay(replay.requestFingerprint, command);
      return { ...replay, replayed: true };
    }

    const clock = await tx.$queryRaw<Array<{ now: Date }>>(Prisma.sql`
      SELECT clock_timestamp() AS now
    `);
    const committedAt = clock[0]?.now ?? new Date();

    if (command.action === CommodityProfileAction.CREATE_PROFILE) {
      return this.createProfileIdentity(tx, context, write, committedAt);
    }

    const profile = await this.lockProfile(tx, command.profileId);
    if (!profile) throw new NotFoundException({ code: 'COMMODITY_PROFILE_NOT_FOUND' });
    if (profile.version.toString() !== command.expectedVersion) {
      throw staleVersion(profile.version);
    }

    if (command.action === CommodityProfileAction.CREATE_DRAFT) {
      return this.createDraft(tx, context, profile, write, committedAt);
    }

    const profileVersionId = command.profileVersionId ?? versionRequired();
    const current = await this.lockVersion(tx, command.profileId, profileVersionId);
    if (!current) {
      throw new NotFoundException({ code: 'COMMODITY_PROFILE_VERSION_NOT_FOUND' });
    }
    if (current.status !== write.fromLifecycle) {
      throw new ConflictException({
        code: 'COMMODITY_PROFILE_LIFECYCLE_CONFLICT',
        currentLifecycle: current.status,
        refreshRequired: true,
      });
    }

    const updated = await this.applyVersionCommand(tx, current, write, committedAt);
    const aggregateVersion = await this.bumpProfileVersion(
      tx,
      command.profileId,
      command.expectedVersion,
      context.userId,
    );
    await this.appendTransition(tx, context, write, updated, current.status);

    const beforeState = this.state(profile, current);
    const afterState = this.state(
      { ...profile, version: aggregateVersion, updatedAt: committedAt },
      updated,
    );
    return this.writeAuditOutboxReceipt(
      tx,
      context,
      write,
      aggregateVersion,
      updated,
      beforeState,
      afterState,
      committedAt,
    );
  }

  private async createProfileIdentity(
    tx: Prisma.TransactionClient,
    context: TrustedRlsContext,
    write: CommodityProfileAtomicWrite,
    committedAt: Date,
  ): Promise<CommodityProfileCommandReceipt> {
    const { command } = write;
    if (command.expectedVersion !== '0') throw staleVersion('0');
    const existing = await this.lockProfile(tx, command.profileId);
    if (existing) {
      throw new ConflictException({
        code: 'COMMODITY_PROFILE_ALREADY_EXISTS',
        currentVersion: existing.version.toString(),
      });
    }
    const source = payload(command);
    const created = await tx.commodityProfile.create({
      data: {
        id: command.profileId,
        canonicalCode: requiredText(source, 'canonicalCode', 64, /^[A-Z0-9][A-Z0-9._-]{2,63}$/),
        archetype: archetype(source),
        authoritativeNameRu: requiredText(source, 'authoritativeNameRu', 500),
        displayNameEn: optionalText(source, 'displayNameEn', 500),
        displayNameZh: optionalText(source, 'displayNameZh', 500),
        classification: classification(source),
        version: 0n,
        createdByUserId: context.userId,
        updatedByUserId: context.userId,
        createdAt: committedAt,
        updatedAt: committedAt,
      },
    });
    const afterState = {
      profile: {
        id: created.id,
        canonicalCode: created.canonicalCode,
        archetype: created.archetype,
        authoritativeNameRu: created.authoritativeNameRu,
        displayNameEn: created.displayNameEn,
        displayNameZh: created.displayNameZh,
        classification: created.classification,
        version: created.version.toString(),
      },
      version: null,
    };
    return this.writeAuditOutboxReceipt(
      tx,
      context,
      write,
      created.version,
      null,
      null,
      afterState,
      committedAt,
    );
  }

  private async createDraft(
    tx: Prisma.TransactionClient,
    context: TrustedRlsContext,
    profile: LockedProfile,
    write: CommodityProfileAtomicWrite,
    committedAt: Date,
  ): Promise<CommodityProfileCommandReceipt> {
    const source = payload(write.command);
    const content = requiredContent(source);
    const sequenceRows = await tx.$queryRaw<Array<{ sequence: number }>>(Prisma.sql`
      SELECT COALESCE(MAX("sequence"), 0)::integer + 1 AS "sequence"
      FROM public."commodity_profile_versions"
      WHERE "profileId" = ${profile.id}
    `);
    const sequence = sequenceRows[0]?.sequence ?? 1;
    const profileVersionId = deterministicId('cpv', write.command.commandId);
    const contentHash = digest(content);
    const created = await tx.commodityProfileVersion.create({
      data: {
        id: profileVersionId,
        profileId: profile.id,
        sequence,
        status: 'DRAFT',
        content: content as Prisma.InputJsonValue,
        contentHashAlgorithm: 'SHA-256',
        contentHash,
        sourceStatus: sourceStatus(source),
        version: 0n,
        createdByUserId: context.userId,
        updatedByUserId: context.userId,
        createdAt: committedAt,
        updatedAt: committedAt,
      },
    });
    const aggregateVersion = await this.bumpProfileVersion(
      tx,
      profile.id,
      write.command.expectedVersion,
      context.userId,
    );
    const version = this.lockedVersion(created);
    await this.appendTransition(tx, context, { ...write, toLifecycle: 'DRAFT' }, version, undefined);
    return this.writeAuditOutboxReceipt(
      tx,
      context,
      { ...write, toLifecycle: 'DRAFT' },
      aggregateVersion,
      version,
      this.state(profile, null),
      this.state({ ...profile, version: aggregateVersion }, version),
      committedAt,
    );
  }

  private async applyVersionCommand(
    tx: Prisma.TransactionClient,
    current: LockedVersion,
    write: CommodityProfileAtomicWrite,
    committedAt: Date,
  ): Promise<LockedVersion> {
    const source = payload(write.command);
    const common = {
      version: { increment: 1 },
      updatedByUserId: write.actor.id,
      updatedAt: committedAt,
    };
    let data: Prisma.CommodityProfileVersionUpdateInput;

    switch (write.command.action) {
      case CommodityProfileAction.UPDATE_DRAFT: {
        const content = requiredContent(source);
        data = {
          ...common,
          status: 'DRAFT',
          content: content as Prisma.InputJsonValue,
          contentHash: digest(content),
          sourceStatus: sourceStatus(source, current.sourceStatus),
        };
        break;
      }
      case CommodityProfileAction.SUBMIT_REVIEW:
        data = { ...common, status: 'REVIEW' };
        break;
      case CommodityProfileAction.APPROVE:
        data = {
          ...common,
          status: 'APPROVED',
          approvalReason: write.command.reason.trim(),
          approvedByUserId: write.actor.id,
          approvedAt: committedAt,
        };
        break;
      case CommodityProfileAction.ACTIVATE:
        data = {
          ...common,
          status: 'EFFECTIVE',
          effectiveFrom: optionalDate(source, 'effectiveFrom') ?? committedAt,
          effectiveTo: null,
        };
        break;
      case CommodityProfileAction.DEPRECATE: {
        const minimum = current.effectiveFrom
          ? new Date(current.effectiveFrom.getTime() + 1)
          : committedAt;
        data = {
          ...common,
          status: 'DEPRECATED',
          effectiveTo: committedAt > minimum ? committedAt : minimum,
        };
        break;
      }
      case CommodityProfileAction.REVOKE: {
        const shouldCloseRange = current.effectiveFrom !== null && current.effectiveTo === null;
        const minimum = current.effectiveFrom
          ? new Date(current.effectiveFrom.getTime() + 1)
          : committedAt;
        data = {
          ...common,
          status: 'REVOKED',
          ...(shouldCloseRange
            ? { effectiveTo: committedAt > minimum ? committedAt : minimum }
            : {}),
        };
        break;
      }
      default:
        throw new UnprocessableEntityException({ code: 'COMMODITY_PROFILE_ACTION_UNSUPPORTED' });
    }

    const updated = await tx.commodityProfileVersion.update({
      where: { id: current.id },
      data,
    });
    return this.lockedVersion(updated);
  }

  private async appendTransition(
    tx: Prisma.TransactionClient,
    context: TrustedRlsContext,
    write: CommodityProfileAtomicWrite,
    version: LockedVersion,
    fromLifecycle: CommodityProfileLifecycle | undefined,
  ): Promise<void> {
    const previous = await tx.commodityProfileTransition.findFirst({
      where: { profileVersionId: version.id },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { toStatus: true, hash: true },
    }) as TransitionHead | null;
    const transitionId = deterministicId('cpt', write.command.commandId);
    const prevHash = previous?.hash ?? null;
    const material = {
      id: transitionId,
      profileId: write.command.profileId,
      profileVersionId: version.id,
      fromStatus: fromLifecycle ?? null,
      toStatus: version.status,
      actorUserId: context.userId,
      actorRole: context.role,
      tenantId: context.tenantId,
      purpose: `COMMODITY_PROFILE_${write.command.action}`,
      reason: write.command.reason.trim(),
      commandId: write.command.commandId,
      idempotencyKey: write.command.idempotencyKey,
      correlationId: write.command.correlationId,
      contentHash: version.contentHash,
      prevHash,
    };
    await tx.commodityProfileTransition.create({
      data: {
        ...material,
        id: transitionId,
        hash: digest(material),
      },
    });
  }

  private async writeAuditOutboxReceipt(
    tx: Prisma.TransactionClient,
    context: TrustedRlsContext,
    write: CommodityProfileAtomicWrite,
    aggregateVersion: bigint,
    version: LockedVersion | null,
    beforeState: unknown,
    afterState: unknown,
    committedAt: Date,
  ): Promise<CommodityProfileCommandReceipt> {
    const receipt: CommodityProfileCommandReceipt = {
      commandId: write.command.commandId,
      idempotencyKey: write.command.idempotencyKey,
      correlationId: write.command.correlationId,
      profileId: write.command.profileId,
      ...(version ? { profileVersionId: version.id } : {}),
      action: write.command.action,
      ...(version ? { lifecycle: version.status } : {}),
      version: aggregateVersion.toString(),
      replayed: false,
      requestFingerprint: write.requestFingerprint,
      committedAt: committedAt.toISOString(),
    };
    const objectType = version ? 'COMMODITY_PROFILE_VERSION' : 'COMMODITY_PROFILE';
    const objectId = version?.id ?? write.command.profileId;
    const previousAudit = await tx.auditEvent.findFirst({
      where: { objectType, objectId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { hash: true },
    });
    const auditId = deterministicId('audit-cp', write.command.commandId);
    const auditMaterial = {
      id: auditId,
      action: `COMMODITY_PROFILE_${write.command.action}`,
      actorUserId: context.userId,
      actorRole: context.role,
      tenantId: context.tenantId,
      orgId: context.orgId,
      objectType,
      objectId,
      beforeState: stable(beforeState),
      afterState: stable(afterState),
      outcome: 'SUCCESS',
      reason: write.command.reason.trim(),
      correlationId: write.command.correlationId,
      requestFingerprint: write.requestFingerprint,
      prevHash: previousAudit?.hash ?? null,
    };
    await tx.auditEvent.create({
      data: {
        id: auditId,
        action: auditMaterial.action,
        actorUserId: context.userId,
        actorRole: context.role,
        tenantId: context.tenantId,
        orgId: context.orgId,
        objectType,
        objectId,
        beforeState: stable(beforeState) as Prisma.InputJsonValue,
        afterState: stable(afterState) as Prisma.InputJsonValue,
        outcome: 'SUCCESS',
        reason: write.command.reason.trim(),
        metadata: {
          schema: 'commodity-profile.audit.v1',
          commandId: write.command.commandId,
          idempotencyKey: write.command.idempotencyKey,
          membershipId: write.actor.membershipId ?? null,
          sessionId: context.sessionId,
          mfaVerified: Boolean(write.actor.mfaVerified),
          staffRoles: write.actor.staffRoles ?? [],
          requestFingerprint: write.requestFingerprint,
        } as Prisma.InputJsonValue,
        correlationId: write.command.correlationId,
        runtimeIdempotencyKey: outboxIdempotencyKey(write.command),
        hash: digest(auditMaterial),
        prevHash: previousAudit?.hash ?? null,
        createdAt: committedAt,
      },
    });

    const event = {
      type: version
        ? 'commodity.profile.lifecycle.changed.v1'
        : 'commodity.profile.identity.created.v1',
      aggregateType: 'CommodityProfile',
      aggregateId: write.command.profileId,
      aggregateVersion: aggregateVersion.toString(),
      profileVersionId: version?.id ?? null,
      action: write.command.action,
      lifecycle: version?.status ?? null,
      correlationId: write.command.correlationId,
      auditId,
      occurredAt: committedAt.toISOString(),
    };
    const envelope: ReceiptEnvelope = {
      schema: 'commodity-profile.command.v1',
      requestFingerprint: write.requestFingerprint,
      receipt,
      event,
    };
    await tx.outboxEntry.create({
      data: {
        type: event.type,
        payload: envelope as unknown as Prisma.InputJsonValue,
        status: 'PENDING',
        triggeredByUserId: context.userId,
        idempotencyKey: outboxIdempotencyKey(write.command),
        correlationId: write.command.correlationId,
        auditId,
        runtimeIdempotencyKey: outboxIdempotencyKey(write.command),
        maxRetries: 5,
        nextRetryAt: committedAt,
        createdAt: committedAt,
      },
    });
    return receipt;
  }

  private async findReplayInTransaction(
    tx: Prisma.TransactionClient,
    command: CommodityProfileCommand,
  ): Promise<CommodityProfileCommandReceipt | null> {
    const existing = await tx.outboxEntry.findUnique({
      where: { idempotencyKey: outboxIdempotencyKey(command) },
      select: { payload: true },
    });
    if (!existing) return null;
    const receipt = receiptFromPayload(existing.payload);
    if (!receipt) {
      throw new ConflictException({ code: 'COMMODITY_PROFILE_RECEIPT_CORRUPT' });
    }
    return receipt;
  }

  private async lockProfile(
    tx: Prisma.TransactionClient,
    profileId: string,
  ): Promise<LockedProfile | null> {
    const rows = await tx.$queryRaw<LockedProfile[]>(Prisma.sql`
      SELECT
        "id", "classification", "version", "canonicalCode", "archetype",
        "authoritativeNameRu", "displayNameEn", "displayNameZh", "updatedAt"
      FROM public."commodity_profiles"
      WHERE "id" = ${profileId}
      FOR UPDATE
    `);
    return rows[0] ?? null;
  }

  private async lockVersion(
    tx: Prisma.TransactionClient,
    profileId: string,
    profileVersionId: string,
  ): Promise<LockedVersion | null> {
    const rows = await tx.$queryRaw<LockedVersion[]>(Prisma.sql`
      SELECT
        "id", "profileId", "sequence", "status", "content", "contentHash",
        "sourceStatus", "effectiveFrom", "effectiveTo", "approvalReason",
        "approvedByUserId", "approvedAt", "version", "updatedAt"
      FROM public."commodity_profile_versions"
      WHERE "id" = ${profileVersionId} AND "profileId" = ${profileId}
      FOR UPDATE
    `);
    return rows[0] ?? null;
  }

  private async bumpProfileVersion(
    tx: Prisma.TransactionClient,
    profileId: string,
    expectedVersion: string,
    actorUserId: string,
  ): Promise<bigint> {
    const expected = BigInt(expectedVersion);
    const rows = await tx.$queryRaw<Array<{ version: bigint }>>(Prisma.sql`
      UPDATE public."commodity_profiles"
      SET
        "version" = "version" + 1,
        "updatedByUserId" = ${actorUserId},
        "updatedAt" = GREATEST(clock_timestamp(), "updatedAt" + interval '1 millisecond')
      WHERE "id" = ${profileId} AND "version" = ${expected}
      RETURNING "version"
    `);
    if (rows.length !== 1) {
      const current = await tx.commodityProfile.findUnique({
        where: { id: profileId },
        select: { version: true },
      });
      throw staleVersion(current?.version ?? expectedVersion);
    }
    return rows[0]!.version;
  }

  private lockedVersion(value: {
    id: string;
    profileId: string;
    sequence: number;
    status: string;
    content: Prisma.JsonValue;
    contentHash: string;
    sourceStatus: string;
    effectiveFrom: Date | null;
    effectiveTo: Date | null;
    approvalReason: string | null;
    approvedByUserId: string | null;
    approvedAt: Date | null;
    version: bigint;
    updatedAt: Date;
  }): LockedVersion {
    return {
      ...value,
      status: value.status as CommodityProfileLifecycle,
    };
  }

  private state(profile: LockedProfile, version: LockedVersion | null): JsonRecord {
    return {
      profile: {
        id: profile.id,
        canonicalCode: profile.canonicalCode,
        archetype: profile.archetype,
        authoritativeNameRu: profile.authoritativeNameRu,
        displayNameEn: profile.displayNameEn,
        displayNameZh: profile.displayNameZh,
        classification: profile.classification,
        version: profile.version.toString(),
        updatedAt: profile.updatedAt.toISOString(),
      },
      version: version
        ? {
            id: version.id,
            sequence: version.sequence,
            lifecycle: version.status,
            sourceStatus: version.sourceStatus,
            contentHash: version.contentHash,
            content: version.content,
            effectiveFrom: version.effectiveFrom?.toISOString() ?? null,
            effectiveTo: version.effectiveTo?.toISOString() ?? null,
            approvalReason: version.approvalReason,
            approvedByUserId: version.approvedByUserId,
            approvedAt: version.approvedAt?.toISOString() ?? null,
            version: version.version.toString(),
            updatedAt: version.updatedAt.toISOString(),
          }
        : null,
    };
  }

  private mapDatabaseError(error: unknown): unknown {
    const code = databaseCode(error);
    const message = databaseMessage(error);
    if (code === '40001' || code === '40P01') {
      return new ConflictException({
        code: 'COMMODITY_PROFILE_CONCURRENT_COMMAND',
        refreshRequired: true,
      });
    }
    if (code === '23P01' || message.includes('PC_PROFILE_EFFECTIVE_OVERLAP')) {
      return new ConflictException({
        code: 'COMMODITY_PROFILE_EFFECTIVE_RANGE_CONFLICT',
        refreshRequired: true,
      });
    }
    if (message.includes('PC_PROFILE_TRANSITION_')) {
      return new ConflictException({
        code: 'COMMODITY_PROFILE_LIFECYCLE_CONFLICT',
        refreshRequired: true,
      });
    }
    if (code === '23505') {
      return new ConflictException({ code: 'COMMODITY_PROFILE_UNIQUE_CONFLICT' });
    }
    return error;
  }
}
