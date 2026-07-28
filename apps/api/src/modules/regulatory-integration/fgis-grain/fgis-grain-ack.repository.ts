import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RlsTransactionService } from '../../../common/prisma/rls-transaction.service';
import { Role, type RequestUser } from '../../../common/types/request-user';
import {
  FGIS_GRAIN_ACK_POLICY,
  FGIS_GRAIN_ACK_POLICY_VERSION,
  FGIS_GRAIN_ACK_RESULT_SCHEMA,
  FGIS_GRAIN_ACK_OPERATIONAL_STATUS,
  FGIS_GRAIN_ACK_REASON_CODES,
  FGIS_GRAIN_ACK_STATES,
  FgisGrainAckAuthorityError,
  normalizeGenerateFgisGrainAckCommand,
  type FgisGrainAckMutation,
} from './fgis-grain-ack.contract';

const MUTATION_ROLES = new Set<string>([Role.ADMIN, Role.COMPLIANCE_OFFICER]);
type FunctionRow = Readonly<{ result: unknown }>;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function assertMutationAuthority(user: RequestUser | undefined): asserts user is RequestUser {
  if (!user || !MUTATION_ROLES.has(user.role)) {
    throw new FgisGrainAckAuthorityError(
      'ACK_MUTATION_FORBIDDEN',
      'FGIS ACK generation requires ADMIN or COMPLIANCE_OFFICER',
      false,
    );
  }
}

function parseMutation(value: unknown, expectedInboxEntryId: string): FgisGrainAckMutation {
  const result = asRecord(value);
  if (
    !result
    || result.schemaVersion !== FGIS_GRAIN_ACK_RESULT_SCHEMA
    || !['CREATED', 'REPLAY', 'NOT_REQUIRED', 'RECONCILIATION_REQUIRED'].includes(
      typeof result.kind === 'string' ? result.kind : '',
    )
    || result.inboxEntryId !== expectedInboxEntryId
    || typeof result.acknowledgementId !== 'string'
    || !FGIS_GRAIN_ACK_STATES.includes(result.state as never)
    || !['REQUIRED', 'NOT_REQUIRED'].includes(typeof result.decision === 'string' ? result.decision : '')
    || !FGIS_GRAIN_ACK_REASON_CODES.includes(result.reasonCode as never)
    || (result.commandId !== null && typeof result.commandId !== 'string')
    || (result.messageId !== null && typeof result.messageId !== 'string')
    || (result.referenceMessageId !== null && typeof result.referenceMessageId !== 'string')
    || (result.outboxEntryId !== null && typeof result.outboxEntryId !== 'string')
    || (result.exchangeId !== null && typeof result.exchangeId !== 'string')
    || (result.auditEventId !== null && typeof result.auditEventId !== 'string')
    || (result.eventOutboxEntryId !== null && typeof result.eventOutboxEntryId !== 'string')
    || typeof result.correlationId !== 'string'
    || result.policyVersion !== FGIS_GRAIN_ACK_POLICY_VERSION
    || result.policyHash !== FGIS_GRAIN_ACK_POLICY.policyHash
    || result.operationalStatus !== FGIS_GRAIN_ACK_OPERATIONAL_STATUS
  ) {
    throw new FgisGrainAckAuthorityError(
      'ACK_DATABASE_RESULT_INVALID',
      'ACK generation returned a malformed database authority result',
      false,
    );
  }
  return result as unknown as FgisGrainAckMutation;
}

function mapDatabaseFailure(error: unknown): FgisGrainAckAuthorityError {
  if (error instanceof FgisGrainAckAuthorityError) return error;
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('ACK_MUTATION_FORBIDDEN')) {
    return new FgisGrainAckAuthorityError(
      'ACK_MUTATION_FORBIDDEN',
      'database rejected ACK mutation authority',
      false,
    );
  }
  if (message.includes('ACK_INBOX_AUTHORITY_MISSING')) {
    return new FgisGrainAckAuthorityError(
      'ACK_INBOX_AUTHORITY_MISSING',
      'verified inbox entry is not accessible in the trusted tenant context',
      false,
    );
  }
  if (
    message.includes('ACK_INBOX_AUTHORITY_INVALID')
    || message.includes('ACK_PROVIDER_CONFIGURATION_INVALID')
    || message.includes('ACK_PROVIDER_ATTESTATION_INVALID')
  ) {
    return new FgisGrainAckAuthorityError(
      'ACK_INBOX_AUTHORITY_INVALID',
      'inbox verification or provider activation authority is insufficient for ACK',
      false,
    );
  }
  if (message.includes('ACK_RECONCILIATION') || message.includes('IDEMPOTENCY_MISMATCH')) {
    return new FgisGrainAckAuthorityError(
      'ACK_RECONCILIATION_REQUIRED',
      'ACK replay conflicts with immutable acknowledgement evidence',
      false,
    );
  }
  if (message.includes('40001') || message.includes('serialization')) {
    return new FgisGrainAckAuthorityError(
      'ACK_PERSISTENCE_FAILED',
      'serializable ACK authority changed before commit',
      true,
    );
  }
  return new FgisGrainAckAuthorityError(
    'ACK_PERSISTENCE_FAILED',
    'unable to persist durable FGIS ACK authority',
    true,
  );
}

@Injectable()
export class FgisGrainAckRepository {
  constructor(private readonly transactions: RlsTransactionService) {}

  async generate(
    user: RequestUser | undefined,
    input: unknown,
  ): Promise<FgisGrainAckMutation> {
    assertMutationAuthority(user);
    const command = normalizeGenerateFgisGrainAckCommand(input);
    try {
      return await this.transactions.withTrustedContext(
        user,
        async (tx) => {
          const rows = await tx.$queryRaw<FunctionRow[]>(Prisma.sql`
            SELECT public.create_fgis_grain_acknowledgement(
              CAST(${command.inboxEntryId} AS text),
              CAST(${command.expectedInboxVersion} AS bigint),
              CAST(${command.inboundTransportOperation} AS text),
              CAST(${command.inboundMessageId} AS text),
              CAST(${command.inboundReferenceMessageId} AS text),
              CAST(${command.inboundResponseCode} AS text),
              CAST(${command.verifiedPayloadFingerprint} AS text),
              CAST(${command.ackEnvelopeReference} AS text),
              CAST(${command.ackEnvelopeSha256} AS text),
              CAST(${command.ackEnvelopeSizeBytes} AS integer),
              CAST(${command.ackMessageDataId} AS text),
              CAST(${command.providerConfigurationReference} AS text),
              CAST(${command.correlationId} AS text),
              CAST(${command.causationId} AS text),
              CAST(${command.idempotencyKey} AS text),
              CAST(${command.reason} AS text)
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
