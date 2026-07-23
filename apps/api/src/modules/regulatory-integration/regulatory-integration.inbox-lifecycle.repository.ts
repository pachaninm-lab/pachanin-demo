import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { RequestUser } from '../../common/types/request-user';
import { RlsTransactionService } from '../../common/prisma/rls-transaction.service';
import type {
  RegulatoryIntegrationState,
  RegulatoryVerificationResult,
} from './regulatory-integration.types';

interface VerificationRow {
  readonly id: string;
  readonly state: RegulatoryIntegrationState;
  readonly verificationResult: unknown;
}

interface AcknowledgementRow {
  readonly id: string;
  readonly providerAcknowledgedAt: Date | null;
}

export type RegulatoryInboxLifecycleMutation = Readonly<{
  kind: 'APPLIED' | 'REPLAY';
  entryId: string;
}>;

export class RegulatoryInboxLifecycleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RegulatoryInboxLifecycleError';
  }
}

@Injectable()
export class RegulatoryIntegrationInboxLifecycleRepository {
  constructor(private readonly transactions: RlsTransactionService) {}

  async recordVerification(
    user: RequestUser | undefined,
    entryId: string,
    result: RegulatoryVerificationResult,
  ): Promise<RegulatoryInboxLifecycleMutation> {
    assertNonEmpty(entryId, 'entryId');
    if (Number.isNaN(Date.parse(result.verifiedAt))) {
      throw new RegulatoryInboxLifecycleError(
        'verification result must contain a valid verifiedAt timestamp',
      );
    }

    const targetState: RegulatoryIntegrationState = result.verified
      ? 'VERIFIED'
      : 'QUARANTINED';
    const serializedResult = JSON.stringify(result);

    return this.transactions.withTrustedContext(
      user,
      async (tx, context) => {
        const applied = await tx.$queryRaw<VerificationRow[]>(Prisma.sql`
          UPDATE public."regulatory_integration_inbox_entries"
          SET "verificationResult" = CAST(${serializedResult} AS jsonb),
              "signatureStatus" = ${signatureStatus(result)},
              "state" = ${targetState},
              "version" = "version" + 1
          WHERE "id" = ${entryId}
            AND "tenantId" = ${context.tenantId}
            AND "organizationId" = ${context.orgId}
            AND "state" = 'RECEIVED'
          RETURNING "id", "state", "verificationResult"
        `);

        if (applied[0] !== undefined) {
          return { kind: 'APPLIED', entryId };
        }

        const current = await tx.$queryRaw<VerificationRow[]>(Prisma.sql`
          SELECT "id", "state", "verificationResult"
          FROM public."regulatory_integration_inbox_entries"
          WHERE "id" = ${entryId}
            AND "tenantId" = ${context.tenantId}
            AND "organizationId" = ${context.orgId}
          FOR UPDATE
        `);
        const row = current[0];
        if (row === undefined) {
          throw new RegulatoryInboxLifecycleError(
            'inbox entry is not accessible in the trusted tenant scope',
          );
        }
        if (
          row.state === targetState
          && stableJson(row.verificationResult) === stableJson(result)
        ) {
          return { kind: 'REPLAY', entryId };
        }

        throw new RegulatoryInboxLifecycleError(
          `verification transition rejected from state ${row.state}`,
        );
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxConflictRetries: 3,
      },
    );
  }

  async markProviderAcknowledged(
    user: RequestUser | undefined,
    entryId: string,
  ): Promise<RegulatoryInboxLifecycleMutation> {
    assertNonEmpty(entryId, 'entryId');

    return this.transactions.withTrustedContext(
      user,
      async (tx, context) => {
        const current = await tx.$queryRaw<AcknowledgementRow[]>(Prisma.sql`
          SELECT "id", "providerAcknowledgedAt"
          FROM public."regulatory_integration_inbox_entries"
          WHERE "id" = ${entryId}
            AND "tenantId" = ${context.tenantId}
            AND "organizationId" = ${context.orgId}
          FOR UPDATE
        `);
        const row = current[0];
        if (row === undefined) {
          throw new RegulatoryInboxLifecycleError(
            'inbox entry is not accessible in the trusted tenant scope',
          );
        }
        if (row.providerAcknowledgedAt !== null) {
          return { kind: 'REPLAY', entryId };
        }

        const updated = await tx.$queryRaw<AcknowledgementRow[]>(Prisma.sql`
          UPDATE public."regulatory_integration_inbox_entries"
          SET "providerAcknowledgedAt" = clock_timestamp(),
              "version" = "version" + 1
          WHERE "id" = ${entryId}
            AND "tenantId" = ${context.tenantId}
            AND "organizationId" = ${context.orgId}
            AND "providerAcknowledgedAt" IS NULL
          RETURNING "id", "providerAcknowledgedAt"
        `);
        if (updated[0] === undefined) {
          throw new RegulatoryInboxLifecycleError(
            'provider acknowledgement lost a concurrent update',
          );
        }

        return { kind: 'APPLIED', entryId };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxConflictRetries: 3,
      },
    );
  }
}

function signatureStatus(
  result: RegulatoryVerificationResult,
): 'VERIFIED' | 'INVALID' | 'UNKNOWN_KEY' | 'PENDING' {
  if (result.verified) return 'VERIFIED';
  if (result.errorCode === 'SIGNATURE_INVALID') return 'INVALID';
  if (result.errorCode === 'KEY_REFERENCE_UNKNOWN') return 'UNKNOWN_KEY';
  return 'PENDING';
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(',')}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
    .join(',')}}`;
}

function assertNonEmpty(value: string, field: string): void {
  if (!value.trim()) {
    throw new RegulatoryInboxLifecycleError(`${field} is required`);
  }
}
