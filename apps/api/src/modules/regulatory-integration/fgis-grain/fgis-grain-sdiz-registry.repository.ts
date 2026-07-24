import { createHash, randomUUID } from 'node:crypto';
import {
  ConflictException,
  Injectable,
  NotFoundException,
  PreconditionFailedException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { RequestUser } from '../../../common/types/request-user';
import {
  RlsTransactionService,
  type TrustedRlsContext,
} from '../../../common/prisma/rls-transaction.service';
import {
  FGIS_GRAIN_SDIZ_OPERATIONAL_STATUS,
  assertFgisGrainSdizApplicationCommand,
  type FgisGrainSdizApplicationCommand,
  type ValidatedFgisGrainSdizApplicationCommand,
  type ValidatedFgisGrainSdizRecord,
} from './fgis-grain-sdiz-registry.contract';

const AUDIT_ACTION = 'FGIS_GRAIN_SDIZ_PROJECTION_APPLIED';
const OUTBOX_TYPE = 'FGIS_GRAIN_SDIZ_PROJECTION_APPLIED';
const LINKED_OPERATION_TYPE = 'FGIS_SDIZ_PROJECTION_BATCH';
const AUDIT_CHAIN_LOCK = 'platform-v7:audit-events:global-chain';

type InboxRow = Readonly<{
  id: string;
  tenantId: string;
  organizationId: string;
  adapterCode: string;
  provider: string;
  externalEventId: string;
  schemaVersion: string;
  mappingVersion: string;
  occurredAt: Date;
  rawBodySha256: string;
  evidenceReference: string;
  signatureStatus: string;
  verificationResult: unknown;
  state: string;
  leaseOwner: string | null;
  leaseExpiresAt: Date | null;
  correlationId: string;
  linkedDomainOperationType: string | null;
  linkedDomainOperationId: string | null;
}>;

type BatchRow = Readonly<{
  id: string;
  sourceInboxEntryId: string;
  messageId: string;
  referenceMessageId: string;
  rawBodySha256: string;
  batchFingerprint: string;
  recordCount: number;
  auditId: string;
  outboxEntryId: string;
}>;

type ProjectionRow = Readonly<{
  id: string;
  providerSdizId: string;
  sdizNumber: string;
  providerOccurredAt: Date;
  recordFingerprint: string;
  version: bigint;
}>;
type HashRow = Readonly<{ hash: string }>;
type IdRow = Readonly<{ id: string }>;

export interface FgisGrainSdizApplicationReceipt {
  readonly batchId: string;
  readonly sourceInboxEntryId: string;
  readonly recordCount: number;
  readonly auditId: string;
  readonly outboxEntryId: string;
  readonly replayed: boolean;
  readonly inboxState: 'PROCESSED';
  readonly businessAccepted: false;
  readonly operationalStatus: typeof FGIS_GRAIN_SDIZ_OPERATIONAL_STATUS;
}

export interface FgisGrainSdizProjectionView {
  readonly id: string;
  readonly providerSdizId: string;
  readonly sdizNumber: string;
  readonly status: string;
  readonly lotNumber: string | null;
  readonly createLotNumber: string | null;
  readonly correctedBySdizNumber: string | null;
  readonly correctedSdizNumber: string | null;
  readonly extinctionId: string | null;
  readonly extinctionRefusalId: string | null;
  readonly providerMessageId: string;
  readonly providerReferenceMessageId: string;
  readonly providerOccurredAt: string;
  readonly sourceInboxEntryId: string;
  readonly sourceBatchId: string;
  readonly sourceRawBodySha256: string;
  readonly sourceEvidenceReference: string;
  readonly recordFingerprint: string;
  readonly version: string;
  readonly operationalStatus: typeof FGIS_GRAIN_SDIZ_OPERATIONAL_STATUS;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(',')}}`;
}

function sha256(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

function verificationAccepted(value: unknown): boolean {
  const result = asRecord(value);
  return result.verified === true
    && result.schemaVersion === '1.0.23'
    && result.mappingVersion === 'fgis-zerno-1.0.23-catalog.v1'
    && typeof result.verifiedAt === 'string'
    && !Number.isNaN(Date.parse(result.verifiedAt));
}

function assertInboxAuthority(
  inbox: InboxRow,
  command: ValidatedFgisGrainSdizApplicationCommand,
): void {
  if (
    inbox.adapterCode !== 'FGIS_ZERNO'
    || inbox.provider !== 'FGIS_ZERNO'
    || inbox.schemaVersion !== '1.0.23'
    || inbox.mappingVersion !== 'fgis-zerno-1.0.23-catalog.v1'
    || inbox.signatureStatus !== 'VERIFIED'
    || !verificationAccepted(inbox.verificationResult)
  ) {
    throw new PreconditionFailedException(
      'Inbox entry is not verified against the accepted FGIS authority',
    );
  }
  if (
    inbox.state !== 'PROCESSING'
    || inbox.leaseOwner !== command.workerId
    || inbox.leaseExpiresAt === null
    || inbox.leaseExpiresAt.getTime() <= Date.now()
  ) {
    throw new PreconditionFailedException('Inbox processing lease is not live');
  }
  if (
    inbox.externalEventId.toLowerCase() !== command.messageId
    || inbox.correlationId.toLowerCase() !== command.referenceMessageId
    || inbox.rawBodySha256 !== command.rawBodySha256
  ) {
    throw new ConflictException(
      'Inbox identity/hash does not match the decoded SDIZ batch',
    );
  }
}

function batchMatches(
  batch: BatchRow,
  command: ValidatedFgisGrainSdizApplicationCommand,
): boolean {
  return batch.sourceInboxEntryId === command.sourceInboxEntryId
    && batch.messageId === command.messageId
    && batch.referenceMessageId === command.referenceMessageId
    && batch.rawBodySha256 === command.rawBodySha256
    && batch.batchFingerprint === command.batchFingerprint
    && batch.recordCount === command.records.length;
}

@Injectable()
export class FgisGrainSdizRegistryRepository {
  constructor(private readonly transactions: RlsTransactionService) {}

  async applyVerifiedInbox(
    user: RequestUser | undefined,
    rawCommand: FgisGrainSdizApplicationCommand,
  ): Promise<FgisGrainSdizApplicationReceipt> {
    const command = assertFgisGrainSdizApplicationCommand(rawCommand);
    return this.transactions.withTrustedContext(
      user,
      async (tx, context) => {
        const batchRows = await tx.$queryRaw<BatchRow[]>(Prisma.sql`
          SELECT "id", "sourceInboxEntryId", "messageId", "referenceMessageId",
                 "rawBodySha256", "batchFingerprint", "recordCount",
                 "auditId", "outboxEntryId"
          FROM public."fgis_grain_sdiz_projection_batches"
          WHERE "tenantId" = ${context.tenantId}
            AND "organizationId" = ${context.orgId}
            AND "sourceInboxEntryId" = ${command.sourceInboxEntryId}
        `);
        const existingBatch = batchRows[0];
        if (existingBatch) {
          if (!batchMatches(existingBatch, command)) {
            throw new ConflictException(
              'Source inbox entry is already bound to another SDIZ batch',
            );
          }
          const inboxReplay = await this.lockInbox(
            tx,
            context,
            command.sourceInboxEntryId,
          );
          if (
            inboxReplay.state !== 'PROCESSED'
            || inboxReplay.linkedDomainOperationType !== LINKED_OPERATION_TYPE
            || inboxReplay.linkedDomainOperationId !== existingBatch.id
          ) {
            throw new ConflictException(
              'SDIZ batch replay is missing matching processed inbox evidence',
            );
          }
          return this.receipt(existingBatch, true);
        }

        const inbox = await this.lockInbox(
          tx,
          context,
          command.sourceInboxEntryId,
        );
        assertInboxAuthority(inbox, command);
        const providerIds = command.records.map((record) => record.providerSdizId);
        const existingRows = await tx.$queryRaw<ProjectionRow[]>(Prisma.sql`
          SELECT "id", "providerSdizId", "sdizNumber", "providerOccurredAt",
                 "recordFingerprint", "version"
          FROM public."fgis_grain_sdiz_records"
          WHERE "tenantId" = ${context.tenantId}
            AND "organizationId" = ${context.orgId}
            AND "providerSdizId" IN (${Prisma.join(providerIds)})
          ORDER BY "providerSdizId"
          FOR UPDATE
        `);
        const existingById = new Map(
          existingRows.map((row) => [row.providerSdizId, row]),
        );
        for (const record of command.records) {
          const existing = existingById.get(record.providerSdizId);
          if (!existing) continue;
          const incomingTime = Date.parse(record.providerOccurredAt);
          const currentTime = existing.providerOccurredAt.getTime();
          if (incomingTime < currentTime) {
            throw new ConflictException(
              `Stale provider occurrence time for SDIZ ${record.providerSdizId}`,
            );
          }
          if (
            incomingTime === currentTime
            && existing.recordFingerprint !== record.recordFingerprint
          ) {
            throw new ConflictException(
              `Conflicting SDIZ fingerprint at the same provider time for ${record.providerSdizId}`,
            );
          }
          if (existing.sdizNumber !== record.sdizNumber) {
            throw new ConflictException(
              `Provider SDIZ ID ${record.providerSdizId} changed its SDIZ number`,
            );
          }
        }

        const batchId = randomUUID();
        const auditId = randomUUID();
        const outboxEntryId = randomUUID();
        const eventPayload = {
          schemaVersion: 'pc-crop.fgis-grain-sdiz-projection-applied.v1',
          batchId,
          sourceInboxEntryId: command.sourceInboxEntryId,
          tenantId: context.tenantId,
          organizationId: context.orgId,
          messageId: command.messageId,
          referenceMessageId: command.referenceMessageId,
          rawBodySha256: command.rawBodySha256,
          batchFingerprint: command.batchFingerprint,
          recordCount: command.records.length,
          businessAccepted: false,
          operationalStatus: FGIS_GRAIN_SDIZ_OPERATIONAL_STATUS,
        };
        await this.lockAuditChain(tx);
        const previous = await tx.$queryRaw<HashRow[]>(Prisma.sql`
          SELECT "hash" FROM public."audit_events"
          ORDER BY "createdAt" DESC, "id" DESC LIMIT 1 FOR UPDATE
        `);
        const prevHash = previous[0]?.hash ?? '';
        const auditHash = sha256({
          auditId,
          action: AUDIT_ACTION,
          actorUserId: context.userId,
          actorRole: context.role,
          eventPayload,
          prevHash,
        });
        await tx.$executeRaw(Prisma.sql`
          INSERT INTO public."audit_events" (
            "id", "action", "actorUserId", "actorRole", "tenantId", "orgId",
            "objectType", "objectId", "afterState", "outcome", "reason",
            "metadata", "correlationId", "runtimeIdempotencyKey", "hash",
            "prevHash"
          ) VALUES (
            ${auditId}, ${AUDIT_ACTION}, ${context.userId}, ${context.role},
            ${context.tenantId}, ${context.orgId}, 'FGIS_SDIZ_PROJECTION_BATCH',
            ${batchId}, CAST(${JSON.stringify({ recordCount: command.records.length })} AS jsonb),
            'SUCCESS', 'Verified FGIS Grain SDIZ batch applied to regulatory projection.',
            CAST(${JSON.stringify(eventPayload)} AS jsonb), ${command.referenceMessageId},
            ${`fgis-sdiz-batch:${context.tenantId}:${context.orgId}:${command.sourceInboxEntryId}`},
            ${auditHash}, ${prevHash || null}
          )
        `);
        await tx.$executeRaw(Prisma.sql`
          INSERT INTO public."outbox_entries" (
            "id", "type", "payload", "status", "triggeredByUserId",
            "idempotencyKey", "correlationId", "auditId", "nextRetryAt"
          ) VALUES (
            ${outboxEntryId}, ${OUTBOX_TYPE}, CAST(${JSON.stringify(eventPayload)} AS jsonb),
            'PENDING', ${context.userId},
            ${`fgis-sdiz-batch:${context.tenantId}:${context.orgId}:${command.sourceInboxEntryId}`},
            ${command.referenceMessageId}, ${auditId}, clock_timestamp()
          )
        `);
        const times = command.records.map((record) => new Date(record.providerOccurredAt));
        const minTime = new Date(Math.min(...times.map((time) => time.getTime())));
        const maxTime = new Date(Math.max(...times.map((time) => time.getTime())));
        await tx.$executeRaw(Prisma.sql`
          INSERT INTO public."fgis_grain_sdiz_projection_batches" (
            "id", "tenantId", "organizationId", "sourceInboxEntryId",
            "messageId", "referenceMessageId", "rawBodySha256",
            "evidenceReference", "batchFingerprint", "recordCount",
            "providerOccurredMin", "providerOccurredMax", "auditId",
            "outboxEntryId", "appliedByWorkerId"
          ) VALUES (
            ${batchId}, ${context.tenantId}, ${context.orgId}, ${inbox.id},
            ${command.messageId}, ${command.referenceMessageId},
            ${command.rawBodySha256}, ${inbox.evidenceReference},
            ${command.batchFingerprint}, ${command.records.length}, ${minTime},
            ${maxTime}, ${auditId}, ${outboxEntryId}, ${command.workerId}
          )
        `);
        for (const record of command.records) {
          await this.upsertRecord(
            tx,
            context,
            inbox,
            batchId,
            command,
            record,
          );
        }
        const completed = await tx.$executeRaw(Prisma.sql`
          UPDATE public."regulatory_integration_inbox_entries"
          SET "state" = 'PROCESSED',
              "businessAcceptedAt" = NULL,
              "linkedDomainOperationType" = ${LINKED_OPERATION_TYPE},
              "linkedDomainOperationId" = ${batchId},
              "outboxEntryId" = ${outboxEntryId},
              "leaseOwner" = NULL,
              "leaseExpiresAt" = NULL,
              "nextAttemptAt" = NULL,
              "lastErrorCode" = NULL,
              "lastErrorCategory" = NULL,
              "lastErrorDetailReference" = NULL,
              "version" = "version" + 1
          WHERE "id" = ${inbox.id}
            AND "tenantId" = ${context.tenantId}
            AND "organizationId" = ${context.orgId}
            AND "state" = 'PROCESSING'
            AND "leaseOwner" = ${command.workerId}
            AND "leaseExpiresAt" > clock_timestamp()
        `);
        if (completed !== 1) {
          throw new PreconditionFailedException(
            'Inbox lease was lost before SDIZ application commit',
          );
        }
        return {
          batchId,
          sourceInboxEntryId: inbox.id,
          recordCount: command.records.length,
          auditId,
          outboxEntryId,
          replayed: false,
          inboxState: 'PROCESSED',
          businessAccepted: false,
          operationalStatus: FGIS_GRAIN_SDIZ_OPERATIONAL_STATUS,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxConflictRetries: 3,
      },
    );
  }

  async getByProviderSdizId(
    user: RequestUser | undefined,
    providerSdizId: string,
  ): Promise<FgisGrainSdizProjectionView> {
    return this.transactions.withTrustedContext(user, async (tx, context) => {
      const rows = await tx.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
        SELECT * FROM public."fgis_grain_sdiz_records"
        WHERE "tenantId" = ${context.tenantId}
          AND "organizationId" = ${context.orgId}
          AND "providerSdizId" = ${providerSdizId}
      `);
      const row = rows[0];
      if (!row) throw new NotFoundException('SDIZ projection not found');
      return this.toView(row);
    });
  }

  private async lockInbox(
    tx: Prisma.TransactionClient,
    context: TrustedRlsContext,
    entryId: string,
  ): Promise<InboxRow> {
    const rows = await tx.$queryRaw<InboxRow[]>(Prisma.sql`
      SELECT "id", "tenantId", "organizationId", "adapterCode", "provider",
             "externalEventId", "schemaVersion", "mappingVersion", "occurredAt",
             "rawBodySha256", "evidenceReference", "signatureStatus",
             "verificationResult", "state", "leaseOwner", "leaseExpiresAt",
             "correlationId", "linkedDomainOperationType",
             "linkedDomainOperationId"
      FROM public."regulatory_integration_inbox_entries"
      WHERE "id" = ${entryId}
        AND "tenantId" = ${context.tenantId}
        AND "organizationId" = ${context.orgId}
      FOR UPDATE
    `);
    const inbox = rows[0];
    if (!inbox) throw new NotFoundException('Regulatory inbox entry not found');
    return inbox;
  }

  private async lockAuditChain(tx: Prisma.TransactionClient): Promise<void> {
    await tx.$queryRaw<Array<{ locked: boolean }>>(Prisma.sql`
      WITH acquired AS MATERIALIZED (
        SELECT pg_advisory_xact_lock(
          hashtextextended('platform-v7:audit-events:global-chain', 0)
        )
      ) SELECT true AS "locked" FROM acquired
    `);
  }

  private async upsertRecord(
    tx: Prisma.TransactionClient,
    context: TrustedRlsContext,
    inbox: InboxRow,
    batchId: string,
    command: ValidatedFgisGrainSdizApplicationCommand,
    record: ValidatedFgisGrainSdizRecord,
  ): Promise<void> {
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO public."fgis_grain_sdiz_records" (
        "id", "tenantId", "organizationId", "providerSdizId", "sdizNumber",
        "status", "lotNumber", "createLotNumber", "correctedBySdizNumber",
        "correctedSdizNumber", "extinctionId", "extinctionRefusalId",
        "providerMessageId", "providerReferenceMessageId", "providerOccurredAt",
        "sourceInboxEntryId", "sourceBatchId", "sourceRawBodySha256",
        "sourceEvidenceReference", "recordFingerprint", "version"
      ) VALUES (
        ${randomUUID()}, ${context.tenantId}, ${context.orgId},
        ${record.providerSdizId}, ${record.sdizNumber}, ${record.status},
        ${record.lotNumber}, ${record.createLotNumber},
        ${record.correctedBySdizNumber}, ${record.correctedSdizNumber},
        ${record.extinctionId}, ${record.extinctionRefusalId},
        ${command.messageId}, ${command.referenceMessageId},
        ${new Date(record.providerOccurredAt)}, ${inbox.id}, ${batchId},
        ${command.rawBodySha256}, ${inbox.evidenceReference},
        ${record.recordFingerprint}, 0
      )
      ON CONFLICT ("tenantId", "organizationId", "providerSdizId")
      DO UPDATE SET
        "status" = EXCLUDED."status",
        "lotNumber" = EXCLUDED."lotNumber",
        "createLotNumber" = EXCLUDED."createLotNumber",
        "correctedBySdizNumber" = EXCLUDED."correctedBySdizNumber",
        "correctedSdizNumber" = EXCLUDED."correctedSdizNumber",
        "extinctionId" = EXCLUDED."extinctionId",
        "extinctionRefusalId" = EXCLUDED."extinctionRefusalId",
        "providerMessageId" = EXCLUDED."providerMessageId",
        "providerReferenceMessageId" = EXCLUDED."providerReferenceMessageId",
        "providerOccurredAt" = EXCLUDED."providerOccurredAt",
        "sourceInboxEntryId" = EXCLUDED."sourceInboxEntryId",
        "sourceBatchId" = EXCLUDED."sourceBatchId",
        "sourceRawBodySha256" = EXCLUDED."sourceRawBodySha256",
        "sourceEvidenceReference" = EXCLUDED."sourceEvidenceReference",
        "recordFingerprint" = EXCLUDED."recordFingerprint",
        "version" = public."fgis_grain_sdiz_records"."version" + 1
      WHERE EXCLUDED."providerOccurredAt"
              > public."fgis_grain_sdiz_records"."providerOccurredAt"
         OR (
              EXCLUDED."providerOccurredAt"
                = public."fgis_grain_sdiz_records"."providerOccurredAt"
              AND EXCLUDED."recordFingerprint"
                = public."fgis_grain_sdiz_records"."recordFingerprint"
            )
    `);
  }

  private receipt(batch: BatchRow, replayed: boolean): FgisGrainSdizApplicationReceipt {
    return {
      batchId: batch.id,
      sourceInboxEntryId: batch.sourceInboxEntryId,
      recordCount: batch.recordCount,
      auditId: batch.auditId,
      outboxEntryId: batch.outboxEntryId,
      replayed,
      inboxState: 'PROCESSED',
      businessAccepted: false,
      operationalStatus: FGIS_GRAIN_SDIZ_OPERATIONAL_STATUS,
    };
  }

  private toView(row: Record<string, unknown>): FgisGrainSdizProjectionView {
    return {
      id: String(row.id),
      providerSdizId: String(row.providerSdizId),
      sdizNumber: String(row.sdizNumber),
      status: String(row.status),
      lotNumber: row.lotNumber === null ? null : String(row.lotNumber),
      createLotNumber:
        row.createLotNumber === null ? null : String(row.createLotNumber),
      correctedBySdizNumber:
        row.correctedBySdizNumber === null
          ? null
          : String(row.correctedBySdizNumber),
      correctedSdizNumber:
        row.correctedSdizNumber === null
          ? null
          : String(row.correctedSdizNumber),
      extinctionId:
        row.extinctionId === null ? null : String(row.extinctionId),
      extinctionRefusalId:
        row.extinctionRefusalId === null
          ? null
          : String(row.extinctionRefusalId),
      providerMessageId: String(row.providerMessageId),
      providerReferenceMessageId: String(row.providerReferenceMessageId),
      providerOccurredAt: new Date(row.providerOccurredAt as Date).toISOString(),
      sourceInboxEntryId: String(row.sourceInboxEntryId),
      sourceBatchId: String(row.sourceBatchId),
      sourceRawBodySha256: String(row.sourceRawBodySha256),
      sourceEvidenceReference: String(row.sourceEvidenceReference),
      recordFingerprint: String(row.recordFingerprint),
      version: String(row.version),
      operationalStatus: FGIS_GRAIN_SDIZ_OPERATIONAL_STATUS,
    };
  }
}
