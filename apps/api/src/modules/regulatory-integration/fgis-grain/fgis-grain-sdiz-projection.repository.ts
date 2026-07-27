import { createHash, randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RlsTransactionService } from '../../../common/prisma/rls-transaction.service';
import { Role, type RequestUser } from '../../../common/types/request-user';
import {
  FGIS_GRAIN_SDIZ_CONFLICT_EVENT_TYPE,
  FGIS_GRAIN_SDIZ_MAPPING_VERSION,
  FGIS_GRAIN_SDIZ_PROJECTION_BATCH_SCHEMA,
  FGIS_GRAIN_SDIZ_PROJECTION_EVENT_TYPE,
  normalizeFgisGrainSdizProjectionCommand,
  type CanonicalFgisGrainSdizProjectionCommand,
  type FgisGrainSdizProjectionMutation,
} from './fgis-grain-sdiz-projection.contract';
import { FGIS_GRAIN_1_0_23_SIGNING_POLICY } from './fgis-grain-1.0.23.signing-policy.generated';

const ADAPTER_CODE = 'FGIS_ZERNO';
const PROVIDER = 'FGIS_ZERNO';
const API_VERSION = '1.0.23';
const SIGNATURE_ALGORITHM = 'GOST3410_2012_256';
const DOMAIN_OPERATION_TYPE = 'FGIS_GRAIN_SDIZ_PROJECTION_BATCH';
const OBJECT_TYPE = 'FGIS_GRAIN_SDIZ_PROJECTION_BATCH';
const APPLY_ACTION = 'FGIS_GRAIN_SDIZ_PROJECTION_APPLIED';
const CONFLICT_ACTION = 'FGIS_GRAIN_SDIZ_PROJECTION_QUARANTINED';
const MUTATION_ROLES = new Set<string>([Role.ADMIN, Role.COMPLIANCE_OFFICER]);
const READ_ROLES = new Set<string>([Role.ADMIN, Role.COMPLIANCE_OFFICER, Role.EXECUTIVE]);

interface InboxAuthorityRow {
  readonly id: string;
  readonly provider: string;
  readonly adapterCode: string;
  readonly adapterVersion: string;
  readonly schemaVersion: string;
  readonly mappingVersion: string;
  readonly externalEventId: string;
  readonly causationId: string | null;
  readonly rawBodySha256: string;
  readonly evidenceReference: string;
  readonly occurredAt: Date;
  readonly signatureStatus: string;
  readonly signatureAlgorithm: string | null;
  readonly signatureAlgorithmUri: string | null;
  readonly verificationResult: unknown;
  readonly state: string;
  readonly leaseOwner: string | null;
  readonly leaseExpiresAt: Date | null;
  readonly version: bigint;
  readonly linkedDomainOperationType: string | null;
  readonly linkedDomainOperationId: string | null;
}

interface ExistingProjectionRow {
  readonly id: string;
  readonly sdizId: string;
  readonly sdizNumber: string;
  readonly providerOccurredAt: Date;
  readonly payloadFingerprint: string;
}

interface ReplayOutboxRow {
  readonly id: string;
  readonly payload: unknown;
  readonly correlationId: string | null;
  readonly auditId: string | null;
}

interface BatchRow {
  readonly id: string;
  readonly sourceInboxEntryId: string;
  readonly sourceRawBodySha256: string;
  readonly providerMessageId: string;
  readonly providerReferenceMessageId: string | null;
  readonly batchFingerprint: string;
  readonly recordCount: number;
  readonly auditEventId: string;
  readonly outboxEntryId: string;
}

interface AuditHashRow {
  readonly hash: string;
}

interface IdRow {
  readonly id: string;
}

export type FgisGrainSdizProjectionRepositoryErrorCode =
  | 'INBOX_NOT_FOUND'
  | 'INBOX_AUTHORITY_MISMATCH'
  | 'INBOX_VERSION_MISMATCH'
  | 'INBOX_LEASE_INVALID'
  | 'INBOX_ALREADY_BOUND'
  | 'IDEMPOTENCY_MISMATCH'
  | 'REPLAY_EVIDENCE_INVALID'
  | 'MUTATION_FORBIDDEN'
  | 'READ_FORBIDDEN';

export class FgisGrainSdizProjectionRepositoryError extends Error {
  constructor(
    readonly code: FgisGrainSdizProjectionRepositoryErrorCode,
    message: string,
  ) {
    super(`${code}: ${message}`);
    this.name = 'FgisGrainSdizProjectionRepositoryError';
  }
}

export interface FgisGrainSdizProjectionQuery {
  readonly sdizId?: string;
  readonly sdizNumber?: string;
  readonly lotNumber?: string;
  readonly status?: string;
  readonly sourceInboxEntryId?: string;
  readonly limit?: number;
}

export interface FgisGrainSdizProjectionView {
  readonly id: string;
  readonly sdizId: string;
  readonly sdizNumber: string;
  readonly lotNumber: string | null;
  readonly createLotNumber: string | null;
  readonly correctedBySdizNumber: string | null;
  readonly correctedSdizNumber: string | null;
  readonly extinctionId: string | null;
  readonly extinctionRefusalId: string | null;
  readonly status: string;
  readonly providerMessageId: string;
  readonly providerReferenceMessageId: string | null;
  readonly providerOccurredAt: string;
  readonly payloadFingerprint: string;
  readonly sourceInboxEntryId: string;
  readonly projectionBatchId: string;
  readonly version: string;
  readonly evidenceReference: string;
  readonly rawBodySha256: string;
  readonly updatedAt: string;
  readonly operationalStatus: 'NOT_ATTESTED';
}

@Injectable()
export class FgisGrainSdizProjectionRepository {
  constructor(private readonly transactions: RlsTransactionService) {}

  async applyVerifiedInbox(
    user: RequestUser | undefined,
    input: unknown,
  ): Promise<FgisGrainSdizProjectionMutation> {
    assertMutationAuthority(user);
    const command = normalizeFgisGrainSdizProjectionCommand(input);
    return this.transactions.withTrustedContext(
      user,
      async (tx, context) => {
        const actor = user as RequestUser;
        const canonicalKey = canonicalIdempotencyKey(
          context.tenantId,
          context.orgId,
          command,
        );
        await tx.$queryRaw<Array<{ locked: boolean }>>(Prisma.sql`
          WITH acquired AS MATERIALIZED (
            SELECT pg_advisory_xact_lock(hashtextextended(${canonicalKey}, 0))
          )
          SELECT true AS "locked" FROM acquired
        `);
        const identityLockKeys = projectionIdentityLockKeys(
          context.tenantId,
          context.orgId,
          command,
        );
        await tx.$queryRaw<Array<{ locked: boolean }>>(Prisma.sql`
          WITH acquired AS MATERIALIZED (
            SELECT public.lock_fgis_grain_sdiz_projection_keys(
              ARRAY[${Prisma.join(identityLockKeys)}]::text[]
            ) AS ignored
          )
          SELECT true AS "locked" FROM acquired
        `);

        const replay = await tx.$queryRaw<ReplayOutboxRow[]>(Prisma.sql`
          SELECT "id", "payload", "correlationId", "auditId"
          FROM public."outbox_entries"
          WHERE "idempotencyKey" = ${canonicalKey}
        `);
        if (replay[0]) {
          return readReplayMutation(tx, replay[0], command, context.tenantId, context.orgId);
        }

        const inboxRows = await tx.$queryRaw<InboxAuthorityRow[]>(Prisma.sql`
          SELECT "id", "provider", "adapterCode", "adapterVersion", "schemaVersion", "mappingVersion",
                 "externalEventId", "causationId", "rawBodySha256", "evidenceReference",
                 "occurredAt", "signatureStatus", "signatureAlgorithm", "signatureAlgorithmUri",
                 "verificationResult", "state",
                 "leaseOwner", "leaseExpiresAt", "version",
                 "linkedDomainOperationType", "linkedDomainOperationId"
          FROM public."regulatory_integration_inbox_entries"
          WHERE "id" = ${command.inboxEntryId}
            AND "tenantId" = ${context.tenantId}
            AND "organizationId" = ${context.orgId}
          FOR UPDATE
        `);
        const inbox = inboxRows[0];
        if (!inbox) {
          throw new FgisGrainSdizProjectionRepositoryError(
            'INBOX_NOT_FOUND',
            'verified inbox entry is not accessible',
          );
        }

        if (inbox.linkedDomainOperationId) {
          return replayAlreadyBound(tx, inbox, command, context.tenantId, context.orgId);
        }
        assertInboxAuthority(inbox, command);

        const existing = await tx.$queryRaw<ExistingProjectionRow[]>(Prisma.sql`
          SELECT "id", "sdizId", "sdizNumber", "providerOccurredAt", "payloadFingerprint"
          FROM public."fgis_grain_sdiz_projections"
          WHERE "tenantId" = ${context.tenantId}
            AND "organizationId" = ${context.orgId}
            AND (
              "sdizId" IN (${Prisma.join(command.records.map((record) => record.sdizId))})
              OR "sdizNumber" IN (${Prisma.join(command.records.map((record) => record.sdizNumber))})
            )
          -- Identity advisory locks are already held for every id and number.
          -- Avoid FOR UPDATE: the runtime role deliberately has no raw UPDATE grant.
          ORDER BY "sdizId", "sdizNumber"
        `);
        const conflict = findConflict(existing, command);
        if (conflict) {
          return quarantineConflict(
            tx,
            actor,
            context.tenantId,
            context.orgId,
            inbox,
            command,
            canonicalKey,
            conflict.code,
            conflict.sdizId,
          );
        }

        const projectionBatchId = randomUUID();
        const auditEventId = randomUUID();
        const outboxEntryId = randomUUID();
        const prevHash = await lockPreviousAuditHash(tx);
        const auditHash = computeAuditHash({
          id: auditEventId,
          action: APPLY_ACTION,
          actorUserId: actor.id,
          actorRole: actor.role,
          objectId: projectionBatchId,
          correlationId: command.correlationId,
          batchFingerprint: command.batchFingerprint,
          prevHash,
        });
        const outboxPayload = {
          schemaVersion: FGIS_GRAIN_SDIZ_PROJECTION_BATCH_SCHEMA,
          kind: 'APPLIED',
          projectionBatchId,
          inboxEntryId: inbox.id,
          tenantId: context.tenantId,
          organizationId: context.orgId,
          providerMessageId: command.providerMessageId,
          providerReferenceMessageId: command.providerReferenceMessageId,
          rawBodySha256: command.rawBodySha256,
          batchFingerprint: command.batchFingerprint,
          recordCount: command.records.length,
          providerOccurredAt: command.providerOccurredAt,
        };

        await insertAudit(
          tx,
          auditEventId,
          actor,
          context.tenantId,
          context.orgId,
          APPLY_ACTION,
          OBJECT_TYPE,
          projectionBatchId,
          command.reason,
          command.correlationId,
          canonicalKey,
          auditHash,
          prevHash,
          { state: 'PROCESSING', inboxVersion: inbox.version.toString() },
          { state: 'PROCESSED', projectionBatchId, recordCount: command.records.length },
          outboxPayload,
        );
        await insertOutbox(
          tx,
          outboxEntryId,
          FGIS_GRAIN_SDIZ_PROJECTION_EVENT_TYPE,
          outboxPayload,
          actor.id,
          canonicalKey,
          command.correlationId,
          auditEventId,
        );
        try {
          await writeProjectionBatch(
            tx,
            projectionBatchId,
            context.tenantId,
            context.orgId,
            inbox.id,
            command,
            auditEventId,
            outboxEntryId,
          );
        } catch (error) {
          if (isProjectionIdentityUniquenessRace(error)) {
            const retryable = new Error(
              'SDIZ identity ownership changed while applying the serializable batch',
            ) as Error & { code: string };
            retryable.code = '40001';
            throw retryable;
          }
          throw error;
        }
        const applied = await tx.$queryRaw<IdRow[]>(Prisma.sql`
          UPDATE public."regulatory_integration_inbox_entries"
          SET "state" = 'PROCESSED',
              "linkedDomainOperationType" = ${DOMAIN_OPERATION_TYPE},
              "linkedDomainOperationId" = ${projectionBatchId},
              "outboxEntryId" = ${outboxEntryId},
              "leaseOwner" = NULL,
              "leaseExpiresAt" = NULL,
              "nextAttemptAt" = NULL,
              "lastErrorCode" = NULL,
              "lastErrorCategory" = NULL,
              "lastErrorDetailReference" = NULL,
              "version" = "version" + 1,
              "updatedAt" = clock_timestamp()
          WHERE "id" = ${inbox.id}
            AND "tenantId" = ${context.tenantId}
            AND "organizationId" = ${context.orgId}
            AND "state" = 'PROCESSING'
            AND "leaseOwner" = ${command.workerId}
            AND "leaseExpiresAt" >= clock_timestamp()
            AND "version" = CAST(${command.expectedInboxVersion} AS bigint)
          RETURNING "id"
        `);
        if (applied[0]?.id !== inbox.id) {
          throw new FgisGrainSdizProjectionRepositoryError(
            'INBOX_LEASE_INVALID',
            'inbox lease or optimistic version was lost before commit',
          );
        }
        return {
          kind: 'APPLIED',
          inboxEntryId: inbox.id,
          projectionBatchId,
          auditEventId,
          outboxEntryId,
          correlationId: command.correlationId,
          recordCount: command.records.length,
          conflictCode: null,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxConflictRetries: 3,
      },
    );
  }

  async list(
    user: RequestUser | undefined,
    query: FgisGrainSdizProjectionQuery = {},
  ): Promise<readonly FgisGrainSdizProjectionView[]> {
    assertReadAuthority(user);
    const limit = boundedLimit(query.limit);
    return this.transactions.withTrustedContext(user, async (tx, context) => {
      const filters: Prisma.Sql[] = [
        Prisma.sql`p."tenantId" = ${context.tenantId}`,
        Prisma.sql`p."organizationId" = ${context.orgId}`,
      ];
      if (query.sdizId) filters.push(Prisma.sql`p."sdizId" = ${query.sdizId}`);
      if (query.sdizNumber) filters.push(Prisma.sql`p."sdizNumber" = ${query.sdizNumber}`);
      if (query.lotNumber) filters.push(Prisma.sql`p."lotNumber" = ${query.lotNumber}`);
      if (query.status) filters.push(Prisma.sql`p."status" = ${query.status}`);
      if (query.sourceInboxEntryId) {
        filters.push(Prisma.sql`p."sourceInboxEntryId" = ${query.sourceInboxEntryId}`);
      }
      const rows = await tx.$queryRaw<Array<{
        id: string; sdizId: string; sdizNumber: string; lotNumber: string | null;
        createLotNumber: string | null; correctedBySdizNumber: string | null;
        correctedSdizNumber: string | null; extinctionId: string | null;
        extinctionRefusalId: string | null; status: string; providerMessageId: string;
        providerReferenceMessageId: string | null; providerOccurredAt: Date;
        payloadFingerprint: string; sourceInboxEntryId: string; projectionBatchId: string;
        version: bigint; evidenceReference: string; rawBodySha256: string; updatedAt: Date;
      }>>(Prisma.sql`
        SELECT p."id", p."sdizId", p."sdizNumber", p."lotNumber", p."createLotNumber",
               p."correctedBySdizNumber", p."correctedSdizNumber", p."extinctionId",
               p."extinctionRefusalId", p."status", p."providerMessageId",
               p."providerReferenceMessageId", p."providerOccurredAt",
               p."payloadFingerprint", p."sourceInboxEntryId", p."projectionBatchId",
               p."version", b."sourceEvidenceReference" AS "evidenceReference",
               b."sourceRawBodySha256" AS "rawBodySha256", p."updatedAt"
        FROM public."fgis_grain_sdiz_projections" p
        JOIN public."fgis_grain_sdiz_projection_batches" b
          ON b."id" = p."projectionBatchId"
         AND b."tenantId" = p."tenantId"
         AND b."organizationId" = p."organizationId"
        WHERE ${Prisma.join(filters, ' AND ')}
        ORDER BY p."providerOccurredAt" DESC, p."sdizId"
        LIMIT ${limit}
      `);
      return rows.map((row) => ({
        ...row,
        providerOccurredAt: row.providerOccurredAt.toISOString(),
        version: row.version.toString(),
        updatedAt: row.updatedAt.toISOString(),
        operationalStatus: 'NOT_ATTESTED' as const,
      }));
    });
  }
}

function assertInboxAuthority(
  inbox: InboxAuthorityRow,
  command: CanonicalFgisGrainSdizProjectionCommand,
): void {
  if (inbox.version.toString() !== command.expectedInboxVersion) {
    throw new FgisGrainSdizProjectionRepositoryError(
      'INBOX_VERSION_MISMATCH',
      'inbox optimistic version changed',
    );
  }
  if (
    inbox.state !== 'PROCESSING'
    || inbox.leaseOwner !== command.workerId
    || !inbox.leaseExpiresAt
    || inbox.leaseExpiresAt.getTime() < Date.now()
  ) {
    throw new FgisGrainSdizProjectionRepositoryError(
      'INBOX_LEASE_INVALID',
      'a live PROCESSING lease is required',
    );
  }
  const verification = asRecord(inbox.verificationResult);
  if (
    inbox.provider !== PROVIDER
    || inbox.adapterCode !== ADAPTER_CODE
    || inbox.adapterVersion !== API_VERSION
    || inbox.schemaVersion !== API_VERSION
    || inbox.mappingVersion !== FGIS_GRAIN_SDIZ_MAPPING_VERSION
    || inbox.signatureStatus !== 'VERIFIED'
    || inbox.signatureAlgorithm !== SIGNATURE_ALGORITHM
    || inbox.signatureAlgorithmUri
      !== FGIS_GRAIN_1_0_23_SIGNING_POLICY.algorithms.signatureAlgorithmUri
    || verification.verified !== true
    || verification.schemaVersion !== API_VERSION
    || verification.mappingVersion !== FGIS_GRAIN_SDIZ_MAPPING_VERSION
    || inbox.externalEventId !== command.providerMessageId
    || inbox.causationId !== command.providerReferenceMessageId
    || inbox.rawBodySha256 !== command.rawBodySha256
    || inbox.occurredAt.toISOString() !== command.providerOccurredAt
  ) {
    throw new FgisGrainSdizProjectionRepositoryError(
      'INBOX_AUTHORITY_MISMATCH',
      'inbox authority tuple does not match the verified SDIZ batch',
    );
  }
}

function findConflict(
  existing: readonly ExistingProjectionRow[],
  command: CanonicalFgisGrainSdizProjectionCommand,
): { code: string; sdizId: string } | null {
  const recordsById = new Map(command.records.map((record) => [record.sdizId, record]));
  const recordsByNumber = new Map(command.records.map((record) => [record.sdizNumber, record]));
  const occurredAt = new Date(command.providerOccurredAt).getTime();
  for (const row of existing) {
    const numberOwner = recordsByNumber.get(row.sdizNumber);
    if (numberOwner && numberOwner.sdizId !== row.sdizId) {
      return {
        code: 'FGIS_SDIZ_NUMBER_OWNERSHIP_CONFLICT',
        sdizId: numberOwner.sdizId,
      };
    }
    const record = recordsById.get(row.sdizId);
    if (!record) continue;
    const currentTime = row.providerOccurredAt.getTime();
    if (currentTime > occurredAt) {
      return { code: 'FGIS_SDIZ_STALE_PROVIDER_EVENT', sdizId: row.sdizId };
    }
    if (currentTime === occurredAt && row.payloadFingerprint !== record.payloadFingerprint) {
      return { code: 'FGIS_SDIZ_SAME_TIME_FINGERPRINT_CONFLICT', sdizId: row.sdizId };
    }
    if (currentTime === occurredAt && row.sdizNumber !== record.sdizNumber) {
      return { code: 'FGIS_SDIZ_SAME_TIME_NUMBER_CONFLICT', sdizId: row.sdizId };
    }
  }
  return null;
}

async function replayAlreadyBound(
  tx: Prisma.TransactionClient,
  inbox: InboxAuthorityRow,
  command: CanonicalFgisGrainSdizProjectionCommand,
  tenantId: string,
  organizationId: string,
): Promise<FgisGrainSdizProjectionMutation> {
  if (inbox.linkedDomainOperationType !== DOMAIN_OPERATION_TYPE) {
    throw new FgisGrainSdizProjectionRepositoryError(
      'INBOX_ALREADY_BOUND',
      'inbox entry is bound to another domain operation',
    );
  }
  const rows = await tx.$queryRaw<BatchRow[]>(Prisma.sql`
    SELECT "id", "sourceInboxEntryId", "sourceRawBodySha256", "providerMessageId",
           "providerReferenceMessageId", "batchFingerprint", "recordCount",
           "auditEventId", "outboxEntryId"
    FROM public."fgis_grain_sdiz_projection_batches"
    WHERE "id" = ${inbox.linkedDomainOperationId}
      AND "tenantId" = ${tenantId}
      AND "organizationId" = ${organizationId}
      AND "sourceInboxEntryId" = ${inbox.id}
  `);
  const batch = rows[0];
  if (!batch || !sameBatch(batch, command)) {
    throw new FgisGrainSdizProjectionRepositoryError(
      'INBOX_ALREADY_BOUND',
      'existing inbox binding does not match the requested batch',
    );
  }
  return {
    kind: 'REPLAY',
    inboxEntryId: inbox.id,
    projectionBatchId: batch.id,
    auditEventId: batch.auditEventId,
    outboxEntryId: batch.outboxEntryId,
    correlationId: command.correlationId,
    recordCount: batch.recordCount,
    conflictCode: null,
  };
}

async function readReplayMutation(
  tx: Prisma.TransactionClient,
  replay: ReplayOutboxRow,
  command: CanonicalFgisGrainSdizProjectionCommand,
  tenantId: string,
  organizationId: string,
): Promise<FgisGrainSdizProjectionMutation> {
  const payload = asRecord(replay.payload);
  if (
    payload.inboxEntryId !== command.inboxEntryId
    || payload.tenantId !== tenantId
    || payload.organizationId !== organizationId
    || payload.rawBodySha256 !== command.rawBodySha256
    || payload.batchFingerprint !== command.batchFingerprint
    || payload.providerMessageId !== command.providerMessageId
  ) {
    throw new FgisGrainSdizProjectionRepositoryError(
      'IDEMPOTENCY_MISMATCH',
      'idempotency key is bound to another SDIZ authority tuple',
    );
  }
  if (!replay.auditId) {
    throw new FgisGrainSdizProjectionRepositoryError(
      'REPLAY_EVIDENCE_INVALID',
      'replay outbox has no audit evidence',
    );
  }
  const kind = payload.kind === 'QUARANTINED' ? 'QUARANTINED' : 'REPLAY';
  return {
    kind,
    inboxEntryId: command.inboxEntryId,
    projectionBatchId: typeof payload.projectionBatchId === 'string'
      ? payload.projectionBatchId
      : null,
    auditEventId: replay.auditId,
    outboxEntryId: replay.id,
    correlationId: replay.correlationId ?? command.correlationId,
    recordCount: typeof payload.recordCount === 'number' ? payload.recordCount : 0,
    conflictCode: typeof payload.conflictCode === 'string' ? payload.conflictCode : null,
  };
}

async function quarantineConflict(
  tx: Prisma.TransactionClient,
  actor: RequestUser,
  tenantId: string,
  organizationId: string,
  inbox: InboxAuthorityRow,
  command: CanonicalFgisGrainSdizProjectionCommand,
  canonicalKey: string,
  conflictCode: string,
  conflictingSdizId: string,
): Promise<FgisGrainSdizProjectionMutation> {
  const auditEventId = randomUUID();
  const outboxEntryId = randomUUID();
  const prevHash = await lockPreviousAuditHash(tx);
  const auditHash = computeAuditHash({
    id: auditEventId,
    action: CONFLICT_ACTION,
    actorUserId: actor.id,
    actorRole: actor.role,
    objectId: inbox.id,
    correlationId: command.correlationId,
    batchFingerprint: command.batchFingerprint,
    prevHash,
  });
  const payload = {
    schemaVersion: FGIS_GRAIN_SDIZ_PROJECTION_BATCH_SCHEMA,
    kind: 'QUARANTINED',
    projectionBatchId: null,
    inboxEntryId: inbox.id,
    tenantId,
    organizationId,
    providerMessageId: command.providerMessageId,
    rawBodySha256: command.rawBodySha256,
    batchFingerprint: command.batchFingerprint,
    recordCount: 0,
    conflictCode,
    conflictingSdizId,
  };
  await insertAudit(
    tx,
    auditEventId,
    actor,
    tenantId,
    organizationId,
    CONFLICT_ACTION,
    'REGULATORY_INTEGRATION_INBOX_ENTRY',
    inbox.id,
    command.reason,
    command.correlationId,
    canonicalKey,
    auditHash,
    prevHash,
    { state: 'PROCESSING', inboxVersion: inbox.version.toString() },
    { state: 'QUARANTINED', conflictCode, conflictingSdizId },
    payload,
  );
  await insertOutbox(
    tx,
    outboxEntryId,
    FGIS_GRAIN_SDIZ_CONFLICT_EVENT_TYPE,
    payload,
    actor.id,
    canonicalKey,
    command.correlationId,
    auditEventId,
  );
  const updated = await tx.$queryRaw<IdRow[]>(Prisma.sql`
    UPDATE public."regulatory_integration_inbox_entries"
    SET "state" = 'QUARANTINED',
        "lastErrorCode" = ${conflictCode},
        "lastErrorCategory" = 'CONSISTENCY',
        "lastErrorDetailReference" = ${`evidence://fgis-sdiz-conflict/${outboxEntryId}`},
        "outboxEntryId" = ${outboxEntryId},
        "leaseOwner" = NULL,
        "leaseExpiresAt" = NULL,
        "nextAttemptAt" = NULL,
        "version" = "version" + 1,
        "updatedAt" = clock_timestamp()
    WHERE "id" = ${inbox.id}
      AND "tenantId" = ${tenantId}
      AND "organizationId" = ${organizationId}
      AND "state" = 'PROCESSING'
      AND "leaseOwner" = ${command.workerId}
      AND "leaseExpiresAt" >= clock_timestamp()
      AND "version" = CAST(${command.expectedInboxVersion} AS bigint)
    RETURNING "id"
  `);
  if (updated[0]?.id !== inbox.id) {
    throw new FgisGrainSdizProjectionRepositoryError(
      'INBOX_LEASE_INVALID',
      'inbox lease was lost while quarantining a projection conflict',
    );
  }
  return {
    kind: 'QUARANTINED',
    inboxEntryId: inbox.id,
    projectionBatchId: null,
    auditEventId,
    outboxEntryId,
    correlationId: command.correlationId,
    recordCount: 0,
    conflictCode,
  };
}

async function writeProjectionBatch(
  tx: Prisma.TransactionClient,
  id: string,
  tenantId: string,
  organizationId: string,
  inboxEntryId: string,
  command: CanonicalFgisGrainSdizProjectionCommand,
  auditEventId: string,
  outboxEntryId: string,
): Promise<void> {
  const rows = await tx.$queryRaw<Array<{ recordCount: number }>>(Prisma.sql`
    SELECT public.write_fgis_grain_sdiz_projection_batch(
      ${id},
      ${tenantId},
      ${organizationId},
      ${inboxEntryId},
      ${command.workerId},
      CAST(${command.expectedInboxVersion} AS bigint),
      ${command.providerMessageId},
      ${command.providerReferenceMessageId},
      ${new Date(command.providerOccurredAt)},
      ${command.batchFingerprint},
      ${auditEventId},
      ${outboxEntryId},
      CAST(${JSON.stringify(command.records)} AS jsonb)
    ) AS "recordCount"
  `);
  if (rows[0]?.recordCount !== command.records.length) {
    throw new FgisGrainSdizProjectionRepositoryError(
      'REPLAY_EVIDENCE_INVALID',
      'controlled SDIZ projection batch write was incomplete',
    );
  }
}

async function insertAudit(
  tx: Prisma.TransactionClient,
  id: string,
  actor: RequestUser,
  tenantId: string,
  organizationId: string,
  action: string,
  objectType: string,
  objectId: string,
  reason: string,
  correlationId: string,
  idempotencyKey: string,
  hash: string,
  prevHash: string,
  beforeState: unknown,
  afterState: unknown,
  metadata: unknown,
): Promise<void> {
  const rows = await tx.$queryRaw<IdRow[]>(Prisma.sql`
    INSERT INTO public."audit_events" (
      "id", "action", "actorUserId", "actorRole", "tenantId", "orgId",
      "objectType", "objectId", "beforeState", "afterState", "outcome",
      "reason", "metadata", "correlationId", "runtimeIdempotencyKey",
      "hash", "prevHash"
    ) VALUES (
      ${id}, ${action}, ${actor.id}, ${actor.role}, ${tenantId}, ${organizationId},
      ${objectType}, ${objectId}, CAST(${JSON.stringify(beforeState)} AS jsonb),
      CAST(${JSON.stringify(afterState)} AS jsonb), 'SUCCESS', ${reason},
      CAST(${JSON.stringify(metadata)} AS jsonb), ${correlationId}, ${idempotencyKey},
      ${hash}, ${prevHash || null}
    ) RETURNING "id"
  `);
  if (rows[0]?.id !== id) {
    throw new FgisGrainSdizProjectionRepositoryError(
      'REPLAY_EVIDENCE_INVALID',
      'immutable audit was not persisted',
    );
  }
}

async function insertOutbox(
  tx: Prisma.TransactionClient,
  id: string,
  type: string,
  payload: unknown,
  actorUserId: string,
  idempotencyKey: string,
  correlationId: string,
  auditId: string,
): Promise<void> {
  const rows = await tx.$queryRaw<IdRow[]>(Prisma.sql`
    INSERT INTO public."outbox_entries" (
      "id", "type", "payload", "status", "triggeredByUserId",
      "idempotencyKey", "correlationId", "auditId", "nextRetryAt"
    ) VALUES (
      ${id}, ${type}, CAST(${JSON.stringify(payload)} AS jsonb), 'PENDING',
      ${actorUserId}, ${idempotencyKey}, ${correlationId}, ${auditId},
      clock_timestamp()
    ) RETURNING "id"
  `);
  if (rows[0]?.id !== id) {
    throw new FgisGrainSdizProjectionRepositoryError(
      'REPLAY_EVIDENCE_INVALID',
      'canonical outbox event was not persisted',
    );
  }
}

async function lockPreviousAuditHash(tx: Prisma.TransactionClient): Promise<string> {
  const rows = await tx.$queryRaw<AuditHashRow[]>(Prisma.sql`
    SELECT public.lock_fgis_grain_sdiz_audit_head() AS "hash"
  `);
  return rows[0]?.hash ?? '';
}

function sameBatch(
  batch: BatchRow,
  command: CanonicalFgisGrainSdizProjectionCommand,
): boolean {
  return batch.sourceInboxEntryId === command.inboxEntryId
    && batch.sourceRawBodySha256 === command.rawBodySha256
    && batch.providerMessageId === command.providerMessageId
    && batch.providerReferenceMessageId === command.providerReferenceMessageId
    && batch.batchFingerprint === command.batchFingerprint
    && batch.recordCount === command.records.length;
}

function compareCodeUnits(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function projectionIdentityLockKeys(
  tenantId: string,
  organizationId: string,
  command: CanonicalFgisGrainSdizProjectionCommand,
): string[] {
  return [...new Set(command.records.flatMap((record) => [
    `pc-crop-08f:${tenantId}:${organizationId}:sdiz-id:${record.sdizId}`,
    `pc-crop-08f:${tenantId}:${organizationId}:sdiz-number:${record.sdizNumber}`,
  ]))].sort(compareCodeUnits);
}

function canonicalIdempotencyKey(
  tenantId: string,
  organizationId: string,
  command: CanonicalFgisGrainSdizProjectionCommand,
): string {
  const key = `fgis-sdiz-projection:${tenantId}:${organizationId}:${command.inboxEntryId}:${command.idempotencyKey}`;
  if (key.length > 255) {
    throw new FgisGrainSdizProjectionRepositoryError(
      'IDEMPOTENCY_MISMATCH',
      'canonical idempotency key exceeds database authority',
    );
  }
  return key;
}

function isProjectionIdentityUniquenessRace(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: unknown; message?: unknown; meta?: unknown };
  const meta = candidate.meta && typeof candidate.meta === 'object'
    ? Object.values(candidate.meta as Record<string, unknown>).join(' ')
    : String(candidate.meta ?? '');
  const text = `${String(candidate.code ?? '')} ${String(candidate.message ?? '')} ${meta}`;
  const isUniqueViolation = candidate.code === 'P2002'
    || candidate.code === 'P2010'
    || text.includes('23505');
  return isUniqueViolation
    && (
      text.includes('fgis_grain_sdiz_projection_number_key')
      || text.includes('sdizNumber')
    );
}

function computeAuditHash(value: Record<string, unknown>): string {
  return createHash('sha256')
    .update(JSON.stringify(value, Object.keys(value).sort()), 'utf8')
    .digest('hex');
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function assertMutationAuthority(user: RequestUser | undefined): void {
  if (!user || !MUTATION_ROLES.has(user.role)) {
    throw new FgisGrainSdizProjectionRepositoryError(
      'MUTATION_FORBIDDEN',
      'SDIZ projection mutation requires operator or compliance authority',
    );
  }
}

function assertReadAuthority(user: RequestUser | undefined): void {
  if (!user || !READ_ROLES.has(user.role)) {
    throw new FgisGrainSdizProjectionRepositoryError(
      'READ_FORBIDDEN',
      'SDIZ projection read requires operator, compliance or executive authority',
    );
  }
}

function boundedLimit(value: number | undefined): number {
  if (value === undefined) return 50;
  if (!Number.isInteger(value) || value < 1 || value > 200) {
    throw new RangeError('limit must be an integer between 1 and 200');
  }
  return value;
}
