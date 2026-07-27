import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RlsTransactionService } from '../../../common/prisma/rls-transaction.service';
import { Role, type RequestUser } from '../../../common/types/request-user';
import {
  FGIS_GRAIN_EXCHANGE_EVENT_SCHEMA,
  FGIS_GRAIN_OPERATIONAL_STATUS_NOT_ATTESTED,
  FgisGrainExchangeAuthorityError,
  normalizeFgisGrainResponseCorrelationCommand,
  type FgisGrainResponseCorrelationMutation,
} from './fgis-grain-exchange.contract';

const MUTATION_ROLES = new Set<string>([Role.ADMIN, Role.COMPLIANCE_OFFICER]);

type FunctionRow = Readonly<{ result: unknown }>;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function canonicalIdempotencyKey(
  tenantId: string,
  organizationId: string,
  clientKey: string,
): string {
  const digest = createHash('sha256')
    .update(['fgis-grain-response', tenantId, organizationId, clientKey].join('\u001f'))
    .digest('hex');
  return `fgis-exchange-response-${digest}`;
}

function assertMutationAuthority(user: RequestUser | undefined): asserts user is RequestUser {
  if (!user || !MUTATION_ROLES.has(user.role)) {
    throw new FgisGrainExchangeAuthorityError(
      'MUTATION_FORBIDDEN',
      'verified FGIS response correlation requires ADMIN or COMPLIANCE_OFFICER',
      false,
    );
  }
}

function parseMutation(
  value: unknown,
  expectedInboxEntryId: string,
): FgisGrainResponseCorrelationMutation {
  const result = asRecord(value);
  if (
    !result
    || result.schemaVersion !== FGIS_GRAIN_EXCHANGE_EVENT_SCHEMA
    || !['CORRELATED', 'REPLAY', 'RECONCILIATION_REQUIRED'].includes(
      typeof result.kind === 'string' ? result.kind : '',
    )
    || result.inboxEntryId !== expectedInboxEntryId
    || typeof result.correlationId !== 'string'
    || (result.exchangeId !== null && typeof result.exchangeId !== 'string')
    || (result.auditEventId !== null && typeof result.auditEventId !== 'string')
    || (result.outboxEntryId !== null && typeof result.outboxEntryId !== 'string')
    || (result.reasonCode !== null && typeof result.reasonCode !== 'string')
    || result.operationalStatus !== FGIS_GRAIN_OPERATIONAL_STATUS_NOT_ATTESTED
  ) {
    throw new FgisGrainExchangeAuthorityError(
      'DATABASE_RESULT_INVALID',
      'response correlation returned a malformed database result',
      false,
    );
  }
  return result as unknown as FgisGrainResponseCorrelationMutation;
}

function mapDatabaseFailure(error: unknown): FgisGrainExchangeAuthorityError {
  if (error instanceof FgisGrainExchangeAuthorityError) return error;
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('MUTATION_FORBIDDEN')) {
    return new FgisGrainExchangeAuthorityError(
      'MUTATION_FORBIDDEN',
      'database rejected the response-correlation mutation authority',
      false,
    );
  }
  if (message.includes('LEASE') || message.includes('40001')) {
    return new FgisGrainExchangeAuthorityError(
      'OUTBOX_LEASE_INVALID',
      'inbox lease or serializable response authority changed before commit',
      true,
    );
  }
  if (message.includes('NOT_FOUND')) {
    return new FgisGrainExchangeAuthorityError(
      'EXCHANGE_AUTHORITY_MISSING',
      'verified inbox authority is not accessible',
      false,
    );
  }
  if (
    message.includes('FGIS_EXCHANGE_REPLAY_MISMATCH')
    || message.includes('FGIS_EXCHANGE_REPLAY_EVIDENCE_INVALID')
  ) {
    return new FgisGrainExchangeAuthorityError(
      'EXCHANGE_AUTHORITY_MISMATCH',
      'processed response replay does not match immutable audit and outbox evidence',
      false,
    );
  }
  return new FgisGrainExchangeAuthorityError(
    'TRANSPORT_RECEIPT_PERSISTENCE_FAILED',
    'unable to persist verified response correlation',
    true,
  );
}

@Injectable()
export class FgisGrainExchangeCorrelationRepository {
  constructor(private readonly transactions: RlsTransactionService) {}

  async correlateVerifiedResponse(
    user: RequestUser | undefined,
    input: unknown,
  ): Promise<FgisGrainResponseCorrelationMutation> {
    assertMutationAuthority(user);
    const command = normalizeFgisGrainResponseCorrelationCommand(input);
    try {
      return await this.transactions.withTrustedContext(
        user,
        async (tx, context) => {
          const key = canonicalIdempotencyKey(
            context.tenantId,
            context.orgId,
            command.idempotencyKey,
          );
          const rows = await tx.$queryRaw<FunctionRow[]>(Prisma.sql`
            SELECT public.correlate_fgis_grain_exchange_response(
              ${command.inboxEntryId},
              ${command.workerId},
              CAST(${command.expectedInboxVersion} AS bigint),
              ${command.providerMessageId},
              ${command.referenceMessageId},
              ${command.rawBodySha256},
              ${command.responseFingerprint},
              CAST(${command.providerOccurredAt} AS timestamptz),
              ${command.correlationId},
              ${key},
              ${command.reason}
            ) AS "result"
          `);
          return parseMutation(rows[0]?.result, command.inboxEntryId);
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxConflictRetries: 3,
        },
      );
    } catch (error) {
      throw mapDatabaseFailure(error);
    }
  }
}
