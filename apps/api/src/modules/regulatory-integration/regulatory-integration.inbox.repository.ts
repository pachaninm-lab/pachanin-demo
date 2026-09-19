import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { RequestUser } from '../../common/types/request-user';
import {
  RlsTransactionService,
  type TrustedRlsContext,
} from '../../common/prisma/rls-transaction.service';
import {
  assertRegulatoryInboxIdentityAuthority,
  type RegulatoryInboxIdentity,
} from './regulatory-integration.inbox-policy';
import type {
  RegulatoryAdapterEnvironment,
  RegulatoryAdapterIdentity,
  RegulatoryInboundEnvelope,
  RegulatoryVerificationResult,
} from './regulatory-integration.types';

const SHA_256_PATTERN = /^[a-f0-9]{64}$/u;
const DEFAULT_LEASE_SECONDS = 60;

interface ExistingInboxRow {
  readonly id: string;
  readonly rawBodySha256: string;
  readonly receivedAt: Date;
}

interface ConflictRow {
  readonly id: string;
}

export interface RegulatoryInboxReceiveCommand {
  readonly adapterIdentity: RegulatoryAdapterIdentity;
  readonly envelope: RegulatoryInboundEnvelope;
  readonly evidenceReference: string;
  readonly verificationResult: RegulatoryVerificationResult | null;
  readonly linkedDomainOperationType?: string | null;
  readonly linkedDomainOperationId?: string | null;
}

export type RegulatoryInboxReceiveResult =
  | Readonly<{
      kind: 'INSERTED' | 'REPLAY';
      entryId: string;
      rawBodySha256: string;
      receivedAt: Date;
      providerAcknowledgementEligible: true;
    }>
  | Readonly<{
      kind: 'CONFLICT';
      entryId: string;
      conflictId: string;
      rawBodySha256: string;
      providerAcknowledgementEligible: false;
    }>;

export interface ClaimedRegulatoryInboxEntry {
  readonly id: string;
  readonly provider: string;
  readonly externalEventId: string;
  readonly schemaVersion: string;
  readonly mappingVersion: string;
  readonly rawBodySha256: string;
  readonly evidenceReference: string;
  readonly attempts: number;
  readonly correlationId: string;
  readonly causationId: string | null;
  readonly leaseOwner: string;
  readonly leaseExpiresAt: Date;
}

export class RegulatoryInboxRepositoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RegulatoryInboxRepositoryError';
  }
}

@Injectable()
export class RegulatoryIntegrationInboxRepository {
  constructor(private readonly transactions: RlsTransactionService) {}

  async receive(
    user: RequestUser | undefined,
    command: RegulatoryInboxReceiveCommand,
  ): Promise<RegulatoryInboxReceiveResult> {
    assertReceiveCommand(command);

    return this.transactions.withTrustedContext(
      user,
      async (tx, context) => {
        const identity = identityFrom(context, command.envelope);
        assertRegulatoryInboxIdentityAuthority(context, identity);

        const existing = await findExistingForUpdate(tx, identity);
        if (existing !== null) {
          return resolveExisting(tx, context, command, existing);
        }

        const inserted = await insertInboxEntry(tx, context, command);
        if (inserted !== null) {
          return {
            kind: 'INSERTED',
            entryId: inserted.id,
            rawBodySha256: inserted.rawBodySha256,
            receivedAt: inserted.receivedAt,
            providerAcknowledgementEligible: true,
          };
        }

        const concurrent = await findExistingForUpdate(tx, identity);
        if (concurrent === null) {
          throw new RegulatoryInboxRepositoryError(
            'durable inbox insert lost without a persisted identity',
          );
        }
        return resolveExisting(tx, context, command, concurrent);
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxConflictRetries: 3,
      },
    );
  }

  async claimBatch(
    user: RequestUser | undefined,
    workerId: string,
    limit = 25,
    leaseSeconds = DEFAULT_LEASE_SECONDS,
  ): Promise<ClaimedRegulatoryInboxEntry[]> {
    assertWorkerParameters(workerId, limit, leaseSeconds);

    return this.transactions.withTrustedContext(user, async (tx, context) =>
      tx.$queryRaw<ClaimedRegulatoryInboxEntry[]>(Prisma.sql`
        UPDATE public."regulatory_integration_inbox_entries"
        SET "state" = 'PROCESSING',
            "attempts" = "attempts" + 1,
            "leaseOwner" = ${workerId},
            "leaseExpiresAt" = clock_timestamp() + make_interval(secs => ${leaseSeconds}),
            "nextAttemptAt" = NULL,
            "version" = "version" + 1
        WHERE "id" IN (
          SELECT "id"
          FROM public."regulatory_integration_inbox_entries"
          WHERE "tenantId" = ${context.tenantId}
            AND "organizationId" = ${context.orgId}
            AND (
              "state" = 'VERIFIED'
              OR (
                "state" = 'RETRY'
                AND "nextAttemptAt" IS NOT NULL
                AND "nextAttemptAt" <= clock_timestamp()
              )
              OR (
                "state" = 'PROCESSING'
                AND "leaseExpiresAt" IS NOT NULL
                AND "leaseExpiresAt" <= clock_timestamp()
              )
            )
          ORDER BY "receivedAt", "id"
          LIMIT ${limit}
          FOR UPDATE SKIP LOCKED
        )
        RETURNING "id", "provider", "externalEventId", "schemaVersion",
                  "mappingVersion", "rawBodySha256", "evidenceReference",
                  "attempts", "correlationId", "causationId", "leaseOwner",
                  "leaseExpiresAt"
      `),
    );
  }

  async complete(
    user: RequestUser | undefined,
    workerId: string,
    entryId: string,
    businessAccepted: boolean,
    linkedDomainOperationType: string | null = null,
    linkedDomainOperationId: string | null = null,
  ): Promise<void> {
    assertLeaseMutationInput(workerId, entryId);

    await this.transactions.withTrustedContext(user, async (tx, context) => {
      const count = await tx.$executeRaw(Prisma.sql`
        UPDATE public."regulatory_integration_inbox_entries"
        SET "state" = 'PROCESSED',
            "businessAcceptedAt" = CASE WHEN ${businessAccepted} THEN clock_timestamp() ELSE NULL END,
            "linkedDomainOperationType" = ${linkedDomainOperationType},
            "linkedDomainOperationId" = ${linkedDomainOperationId},
            "leaseOwner" = NULL,
            "leaseExpiresAt" = NULL,
            "nextAttemptAt" = NULL,
            "lastErrorCode" = NULL,
            "lastErrorCategory" = NULL,
            "lastErrorDetailReference" = NULL,
            "version" = "version" + 1
        WHERE "id" = ${entryId}
          AND "tenantId" = ${context.tenantId}
          AND "organizationId" = ${context.orgId}
          AND "state" = 'PROCESSING'
          AND "leaseOwner" = ${workerId}
          AND "leaseExpiresAt" > clock_timestamp()
      `);
      assertSingleLeaseMutation(count, entryId, workerId);
    });
  }

  async retry(
    user: RequestUser | undefined,
    workerId: string,
    entryId: string,
    nextAttemptAt: Date,
    errorCode: string,
    errorCategory: string,
    errorDetailReference: string | null = null,
  ): Promise<void> {
    assertLeaseMutationInput(workerId, entryId);
    assertFutureDate(nextAttemptAt, 'nextAttemptAt');
    assertNonEmpty(errorCode, 'errorCode');
    assertNonEmpty(errorCategory, 'errorCategory');

    await this.transitionFailure(user, workerId, entryId, 'RETRY', {
      nextAttemptAt,
      errorCode,
      errorCategory,
      errorDetailReference,
    });
  }

  async quarantine(
    user: RequestUser | undefined,
    workerId: string,
    entryId: string,
    errorCode: string,
    errorCategory: string,
    errorDetailReference: string | null = null,
  ): Promise<void> {
    assertLeaseMutationInput(workerId, entryId);
    assertNonEmpty(errorCode, 'errorCode');
    assertNonEmpty(errorCategory, 'errorCategory');

    await this.transitionFailure(user, workerId, entryId, 'QUARANTINED', {
      nextAttemptAt: null,
      errorCode,
      errorCategory,
      errorDetailReference,
    });
  }

  async deadLetter(
    user: RequestUser | undefined,
    workerId: string,
    entryId: string,
    errorCode: string,
    errorCategory: string,
    errorDetailReference: string | null = null,
  ): Promise<void> {
    assertLeaseMutationInput(workerId, entryId);
    assertNonEmpty(errorCode, 'errorCode');
    assertNonEmpty(errorCategory, 'errorCategory');

    await this.transitionFailure(user, workerId, entryId, 'DEAD', {
      nextAttemptAt: null,
      errorCode,
      errorCategory,
      errorDetailReference,
    });
  }

  private async transitionFailure(
    user: RequestUser | undefined,
    workerId: string,
    entryId: string,
    state: 'RETRY' | 'QUARANTINED' | 'DEAD',
    failure: Readonly<{
      nextAttemptAt: Date | null;
      errorCode: string;
      errorCategory: string;
      errorDetailReference: string | null;
    }>,
  ): Promise<void> {
    await this.transactions.withTrustedContext(user, async (tx, context) => {
      const count = await tx.$executeRaw(Prisma.sql`
        UPDATE public."regulatory_integration_inbox_entries"
        SET "state" = ${state},
            "nextAttemptAt" = ${failure.nextAttemptAt},
            "lastErrorCode" = ${failure.errorCode},
            "lastErrorCategory" = ${failure.errorCategory},
            "lastErrorDetailReference" = ${failure.errorDetailReference},
            "leaseOwner" = NULL,
            "leaseExpiresAt" = NULL,
            "version" = "version" + 1
        WHERE "id" = ${entryId}
          AND "tenantId" = ${context.tenantId}
          AND "organizationId" = ${context.orgId}
          AND "state" = 'PROCESSING'
          AND "leaseOwner" = ${workerId}
          AND "leaseExpiresAt" > clock_timestamp()
      `);
      assertSingleLeaseMutation(count, entryId, workerId);
    });
  }
}

async function findExistingForUpdate(
  tx: Prisma.TransactionClient,
  identity: RegulatoryInboxIdentity,
): Promise<ExistingInboxRow | null> {
  const rows = await tx.$queryRaw<ExistingInboxRow[]>(Prisma.sql`
    SELECT "id", "rawBodySha256", "receivedAt"
    FROM public."regulatory_integration_inbox_entries"
    WHERE "tenantId" = ${identity.tenantId}
      AND "organizationId" = ${identity.organizationId}
      AND "provider" = ${identity.provider}
      AND "externalEventId" = ${identity.externalEventId}
    FOR UPDATE
  `);
  return rows[0] ?? null;
}

async function insertInboxEntry(
  tx: Prisma.TransactionClient,
  context: TrustedRlsContext,
  command: RegulatoryInboxReceiveCommand,
): Promise<ExistingInboxRow | null> {
  const signature = command.envelope.signature;
  const verificationJson = command.verificationResult === null
    ? null
    : JSON.stringify(command.verificationResult);
  const rows = await tx.$queryRaw<ExistingInboxRow[]>(Prisma.sql`
    INSERT INTO public."regulatory_integration_inbox_entries" (
      "id", "tenantId", "organizationId", "adapterCode", "adapterVersion",
      "provider", "externalEventId", "schemaVersion", "mappingVersion",
      "environment", "capabilities", "occurredAt", "rawBodySha256",
      "evidenceReference", "signatureStatus", "signatureAlgorithm",
      "signatureKeyReference", "signatureKeyVersion", "verificationResult",
      "state", "correlationId", "causationId", "linkedDomainOperationType",
      "linkedDomainOperationId"
    ) VALUES (
      ${randomUUID()}, ${context.tenantId}, ${context.orgId},
      ${command.adapterIdentity.adapterCode}, ${command.adapterIdentity.adapterVersion},
      ${command.envelope.provider}, ${command.envelope.externalEventId},
      ${command.envelope.schemaVersion}, ${command.envelope.mappingVersion},
      ${toDatabaseEnvironment(command.adapterIdentity.environment)},
      CAST(${JSON.stringify(command.adapterIdentity.capabilities)} AS jsonb),
      ${new Date(command.envelope.occurredAt)}, ${command.envelope.rawBodySha256},
      ${command.evidenceReference}, ${signatureStatus(command.verificationResult, signature !== null)},
      ${signature?.algorithm ?? null}, ${signature?.keyReference ?? null},
      ${signature?.keyVersion ?? null}, CAST(${verificationJson} AS jsonb),
      'RECEIVED', ${command.envelope.correlationId}, ${command.envelope.causationId},
      ${command.linkedDomainOperationType ?? null}, ${command.linkedDomainOperationId ?? null}
    )
    ON CONFLICT (
      "tenantId", "organizationId", "provider", "externalEventId"
    ) DO NOTHING
    RETURNING "id", "rawBodySha256", "receivedAt"
  `);
  return rows[0] ?? null;
}

async function resolveExisting(
  tx: Prisma.TransactionClient,
  context: TrustedRlsContext,
  command: RegulatoryInboxReceiveCommand,
  existing: ExistingInboxRow,
): Promise<RegulatoryInboxReceiveResult> {
  if (existing.rawBodySha256 === command.envelope.rawBodySha256) {
    return {
      kind: 'REPLAY',
      entryId: existing.id,
      rawBodySha256: existing.rawBodySha256,
      receivedAt: existing.receivedAt,
      providerAcknowledgementEligible: true,
    };
  }

  const conflictId = randomUUID();
  const inserted = await tx.$queryRaw<ConflictRow[]>(Prisma.sql`
    INSERT INTO public."regulatory_integration_inbox_conflicts" (
      "id", "inboxEntryId", "tenantId", "organizationId", "provider",
      "externalEventId", "existingRawBodySha256", "incomingRawBodySha256",
      "incomingEvidenceReference", "correlationId"
    ) VALUES (
      ${conflictId}, ${existing.id}, ${context.tenantId}, ${context.orgId},
      ${command.envelope.provider}, ${command.envelope.externalEventId},
      ${existing.rawBodySha256}, ${command.envelope.rawBodySha256},
      ${command.evidenceReference}, ${command.envelope.correlationId}
    )
    ON CONFLICT (
      "tenantId", "organizationId", "provider", "externalEventId",
      "incomingRawBodySha256"
    ) DO NOTHING
    RETURNING "id"
  `);

  let durableConflictId = inserted[0]?.id;
  if (durableConflictId === undefined) {
    const rows = await tx.$queryRaw<ConflictRow[]>(Prisma.sql`
      SELECT "id"
      FROM public."regulatory_integration_inbox_conflicts"
      WHERE "tenantId" = ${context.tenantId}
        AND "organizationId" = ${context.orgId}
        AND "provider" = ${command.envelope.provider}
        AND "externalEventId" = ${command.envelope.externalEventId}
        AND "incomingRawBodySha256" = ${command.envelope.rawBodySha256}
    `);
    durableConflictId = rows[0]?.id;
  }

  if (durableConflictId === undefined) {
    throw new RegulatoryInboxRepositoryError(
      'security conflict was not durably persisted',
    );
  }

  return {
    kind: 'CONFLICT',
    entryId: existing.id,
    conflictId: durableConflictId,
    rawBodySha256: command.envelope.rawBodySha256,
    providerAcknowledgementEligible: false,
  };
}

function identityFrom(
  context: TrustedRlsContext,
  envelope: RegulatoryInboundEnvelope,
): RegulatoryInboxIdentity {
  return {
    tenantId: context.tenantId,
    organizationId: context.orgId,
    provider: envelope.provider,
    externalEventId: envelope.externalEventId,
    rawBodySha256: envelope.rawBodySha256,
  };
}

function toDatabaseEnvironment(environment: RegulatoryAdapterEnvironment): string {
  if (environment === 'PRE_PRODUCTION') return 'PREPROD';
  return environment;
}

function signatureStatus(
  verification: RegulatoryVerificationResult | null,
  signaturePresent: boolean,
): 'NOT_REQUIRED' | 'PENDING' | 'VERIFIED' | 'INVALID' | 'UNKNOWN_KEY' {
  if (!signaturePresent) return 'NOT_REQUIRED';
  if (verification === null) return 'PENDING';
  if (verification.verified) return 'VERIFIED';
  if (verification.errorCode === 'SIGNATURE_INVALID') return 'INVALID';
  if (verification.errorCode === 'KEY_REFERENCE_UNKNOWN') return 'UNKNOWN_KEY';
  return 'PENDING';
}

function assertReceiveCommand(command: RegulatoryInboxReceiveCommand): void {
  assertNonEmpty(command.adapterIdentity.adapterCode, 'adapterCode');
  assertNonEmpty(command.adapterIdentity.adapterVersion, 'adapterVersion');
  assertNonEmpty(command.envelope.provider, 'provider');
  assertNonEmpty(command.envelope.externalEventId, 'externalEventId');
  assertNonEmpty(command.envelope.schemaVersion, 'schemaVersion');
  assertNonEmpty(command.envelope.mappingVersion, 'mappingVersion');
  assertNonEmpty(command.envelope.correlationId, 'correlationId');
  assertNonEmpty(command.evidenceReference, 'evidenceReference');
  if (!SHA_256_PATTERN.test(command.envelope.rawBodySha256)) {
    throw new RegulatoryInboxRepositoryError('rawBodySha256 must be lowercase SHA-256');
  }
  if (Number.isNaN(Date.parse(command.envelope.occurredAt))) {
    throw new RegulatoryInboxRepositoryError('occurredAt must be an ISO timestamp');
  }
}

function assertWorkerParameters(
  workerId: string,
  limit: number,
  leaseSeconds: number,
): void {
  assertNonEmpty(workerId, 'workerId');
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
    throw new RegulatoryInboxRepositoryError('limit must be an integer between 1 and 500');
  }
  if (!Number.isInteger(leaseSeconds) || leaseSeconds < 1 || leaseSeconds > 3600) {
    throw new RegulatoryInboxRepositoryError(
      'leaseSeconds must be an integer between 1 and 3600',
    );
  }
}

function assertLeaseMutationInput(workerId: string, entryId: string): void {
  assertNonEmpty(workerId, 'workerId');
  assertNonEmpty(entryId, 'entryId');
}

function assertSingleLeaseMutation(
  count: number,
  entryId: string,
  workerId: string,
): void {
  if (count !== 1) {
    throw new RegulatoryInboxRepositoryError(
      `inbox lease lost: entry=${entryId} worker=${workerId}`,
    );
  }
}

function assertFutureDate(value: Date, field: string): void {
  if (Number.isNaN(value.getTime()) || value.getTime() <= Date.now()) {
    throw new RegulatoryInboxRepositoryError(`${field} must be a future date`);
  }
}

function assertNonEmpty(value: string, field: string): void {
  if (!value.trim()) {
    throw new RegulatoryInboxRepositoryError(`${field} is required`);
  }
}
