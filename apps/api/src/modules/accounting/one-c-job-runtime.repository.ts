import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RlsTransactionService } from '../../common/prisma/rls-transaction.service';
import type { RequestUser } from '../../common/types/request-user';
import { Capability } from '../auth/membership-capability.resolver';
import { DEFAULT_MFA_MAX_AGE_SECONDS } from '../auth/signing-authority.policy';
import {
  integrationPayloadHash,
  validateIntegrationCommandEnvelope,
} from './integration-command.policy';
import {
  type IntegrationJobConnectorResult,
  verifyIntegrationJobLease,
  type IntegrationJobLeaseRecord,
} from './integration-job-lease.policy';
import {
  canonicalOneCJobPayload,
  type OneCJobFailureReport,
  type OneCJobReconciliationCommand,
  type OneCJobResultReport,
  type OneCJobStatus,
  validateOneCJobFailureReport,
  validateOneCJobReconciliationCommand,
  validateOneCJobResultReport,
  validateOneCJobReceiptEnvelope,
} from './one-c-job-runtime.contract';
import { type OneCCommand, type OneCConnectorJob, type OneCSyncState } from './one-c-connector.protocol';
import {
  OneCHumanRefusal,
  type OneCMachineAuthentication,
  type OneCMachineAuthenticationDenial,
  OneCRuntimeRepository,
} from './one-c-runtime.repository';
import { WorkTaskRepository } from './work-task.repository';

export const OneCJobMachineOutcome = {
  LEASED: 'LEASED',
  ACKNOWLEDGED: 'ACKNOWLEDGED',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  UNAUTHORIZED: 'UNAUTHORIZED',
} as const;

export const OneCJobReadOutcome = {
  AVAILABLE: 'AVAILABLE',
  REFUSED: 'REFUSED',
} as const;

export const OneCJobReconciliationOutcome = {
  APPLIED: 'APPLIED',
  REFUSED: 'REFUSED',
} as const;

export class OneCJobRuntimeRepositoryError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'OneCJobRuntimeRepositoryError';
  }
}

export interface LeasedOneCJob extends OneCConnectorJob {
  /** One-time lease bearer. It is never persisted or returned by human reads. */
  readonly leaseBearer: string;
  readonly leaseExpiresAt: Date;
}

interface EnqueueRow {
  jobId: string;
  command: OneCCommand;
  payloadHash: string;
  idempotencyKey: string;
  correlationId: string;
  organizationId: string;
  connectionId: string;
  revision: bigint;
  attempt: number;
  status: OneCJobStatus;
  syncState: OneCSyncState;
  outboxEntryId: string;
  replayed: boolean;
}

interface LeaseRow {
  jobId: string;
  command: OneCCommand;
  payload: Record<string, unknown>;
  payloadHash: string;
  idempotencyKey: string;
  correlationId: string;
  organizationId: string;
  connectionId: string;
  revision: bigint;
  attempt: number;
  leaseBearer: string;
  leaseExpiresAt: Date;
}

interface LeaseVerifierRow {
  leaseId: string;
  jobId: string;
  tenantId: string;
  organizationId: string;
  installationId: string;
  bindingId: string;
  credentialId: string;
  providerPartition: string;
  salt: string;
  bearerHash: string;
  issuedAt: Date;
  expiresAt: Date;
  acknowledgedAt: Date | null;
  terminalAt: Date | null;
  terminalResult: IntegrationJobConnectorResult | null;
  terminalCode: string | null;
  externalEvidenceId: string | null;
  revision: bigint;
  attempt: number;
  idempotencyKey: string;
  correlationId: string;
  payloadHash: string;
}

interface ActionRow {
  jobId: string;
  status: OneCJobStatus;
  syncState: OneCSyncState;
  acknowledgedAt?: Date;
  completedAt?: Date;
  nextAttemptAt?: Date | null;
  revision?: bigint;
  replayed: boolean;
}

interface JobViewRow {
  jobId: string;
  command: OneCCommand;
  payloadHash: string;
  idempotencyKey: string;
  correlationId: string;
  externalId: string | null;
  status: OneCJobStatus;
  syncState: OneCSyncState;
  revision: bigint;
  attempt: number;
  maxAttempts: number;
  terminalCode: string | null;
  externalEvidenceId: string | null;
  acknowledgedAt: Date | null;
  completedAt: Date | null;
  reconciliationRequiredAt: Date | null;
  deadLetterAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class OneCJobRuntimeRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transactions: RlsTransactionService,
    private readonly tasks: WorkTaskRepository,
    private readonly runtime: OneCRuntimeRepository,
  ) {}

  /** Internal producer boundary. There is intentionally no arbitrary enqueue HTTP route. */
  async enqueue(
    user: RequestUser | undefined,
    input: {
      command: OneCCommand;
      payload: Readonly<Record<string, unknown>>;
      idempotencyKey: string;
      correlationId: string;
      externalId?: string | null;
      revision: number;
      maxAttempts?: number;
    },
  ) {
    const canonical = canonicalOneCJobPayload(input.command, input.payload);
    const payloadHash = integrationPayloadHash(Buffer.from(canonical, 'utf8'));
    validateIntegrationCommandEnvelope({
      idempotencyKey: input.idempotencyKey,
      correlationId: input.correlationId,
      organizationId: user?.orgId ?? 'server-derived',
      connectionId: 'server-derived',
      externalId: input.externalId ?? null,
      payloadHash,
      revision: input.revision,
      attempt: 0,
    });
    const maxAttempts = input.maxAttempts ?? 3;
    if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 5) {
      throw new OneCJobRuntimeRepositoryError('ONE_C_JOB_MAX_ATTEMPTS_INVALID');
    }
    return this.transactions.withOrganizationMemberContext(user, async (tx) => {
      const capabilities = await this.tasks.capabilitiesWithin(tx);
      if (!capabilities.includes(Capability.INTEGRATIONS_CONFIGURE)) {
        return { outcome: OneCJobReconciliationOutcome.REFUSED, refusal: OneCHumanRefusal.CAPABILITY_REQUIRED } as const;
      }
      try {
        const rows = await tx.$queryRaw<EnqueueRow[]>(Prisma.sql`
          SELECT job_id AS "jobId", command, payload_hash AS "payloadHash",
                 idempotency_key AS "idempotencyKey", correlation_id AS "correlationId",
                 organization_id AS "organizationId", connection_id AS "connectionId",
                 revision, attempt, status, sync_state AS "syncState",
                 outbox_entry_id AS "outboxEntryId", replayed
            FROM connector.enqueue_one_c_job(
              ${input.command}, ${canonical}::jsonb, ${payloadHash},
              ${input.idempotencyKey}, ${input.correlationId},
              ${input.externalId ?? null}, ${input.revision}::bigint, ${maxAttempts}::integer
            )
        `);
        const row = required(rows[0], 'ONE_C_JOB_ENQUEUE_RESULT_NOT_RETURNED');
        return { outcome: OneCJobReconciliationOutcome.APPLIED, job: serializeAction(row), outboxEntryId: row.outboxEntryId } as const;
      } catch (error) {
        throw translate(error);
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxConflictRetries: 3 });
  }

  async leaseJobs(
    machineBearer: string,
    limit: number,
    correlationId: string,
    now: Date = new Date(),
  ) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 25) {
      throw new OneCJobRuntimeRepositoryError('ONE_C_JOB_LEASE_LIMIT_INVALID');
    }
    const authentication = await this.runtime.authenticateMachineBearer(machineBearer, undefined, now);
    if (!authentication.authorized) return unauthorized(authentication.reason);
    try {
      const rows = await this.prisma.$queryRaw<LeaseRow[]>(Prisma.sql`
        SELECT job_id AS "jobId", command, payload, payload_hash AS "payloadHash",
               idempotency_key AS "idempotencyKey", correlation_id AS "correlationId",
               organization_id AS "organizationId", connection_id AS "connectionId",
               revision, attempt, lease_bearer AS "leaseBearer",
               lease_expires_at AS "leaseExpiresAt"
          FROM connector.lease_one_c_jobs(
            ${authentication.credentialId}, ${limit}::integer, 120::integer, ${correlationId}
          )
      `);
      return {
        outcome: OneCJobMachineOutcome.LEASED,
        jobs: rows.map((row): LeasedOneCJob => ({
          id: row.jobId,
          command: row.command,
          payload: row.payload,
          idempotencyKey: row.idempotencyKey,
          correlationId: row.correlationId,
          organizationId: row.organizationId,
          connectionId: row.connectionId,
          revision: safeNumber(row.revision, 'ONE_C_JOB_REVISION_INVALID'),
          attempt: row.attempt,
          leaseBearer: row.leaseBearer,
          leaseExpiresAt: row.leaseExpiresAt,
        })),
      } as const;
    } catch (error) {
      throw translate(error);
    }
  }

  async acknowledge(
    machineBearer: string,
    leaseBearer: string,
    jobId: string,
    envelope: { idempotencyKey: string; payloadHash: string; revision: number; attempt: number },
    correlationId: string,
    now: Date = new Date(),
  ) {
    validateOneCJobReceiptEnvelope(envelope);
    const authority = await this.authorizeLease(machineBearer, leaseBearer, now, false);
    if (!authority.authorized) return authority.response;
    if (authority.lease.jobId !== jobId) return unauthorized('SCOPE_MISMATCH');
    try {
      const rows = await this.prisma.$queryRaw<ActionRow[]>(Prisma.sql`
        SELECT job_id AS "jobId", status, sync_state AS "syncState",
               acknowledged_at AS "acknowledgedAt", replayed
          FROM connector.ack_one_c_job(
            ${authority.authentication.credentialId}, ${authority.lease.leaseId},
            ${envelope.idempotencyKey}, ${envelope.payloadHash},
            ${envelope.revision}::bigint, ${envelope.attempt}::integer, ${correlationId}
          )
      `);
      return { outcome: OneCJobMachineOutcome.ACKNOWLEDGED, ...serializeAction(required(rows[0], 'ONE_C_JOB_ACK_RESULT_NOT_RETURNED')) } as const;
    } catch (error) { throw translate(error); }
  }

  async complete(
    machineBearer: string,
    leaseBearer: string,
    jobId: string,
    report: OneCJobResultReport,
    correlationId: string,
    now: Date = new Date(),
  ) {
    validateOneCJobResultReport(report);
    const authority = await this.authorizeLease(machineBearer, leaseBearer, now, true);
    if (!authority.authorized) return authority.response;
    if (authority.lease.jobId !== jobId) return unauthorized('SCOPE_MISMATCH');
    try {
      const rows = await this.prisma.$queryRaw<ActionRow[]>(Prisma.sql`
        SELECT job_id AS "jobId", status, sync_state AS "syncState",
               completed_at AS "completedAt", replayed
          FROM connector.complete_one_c_job(
            ${authority.authentication.credentialId}, ${authority.lease.leaseId},
            ${report.idempotencyKey}, ${report.payloadHash}, ${report.revision}::bigint,
            ${report.attempt}::integer, ${report.resultState}, ${report.resultCode},
            ${report.externalEvidenceId}, ${correlationId}
          )
      `);
      return { outcome: OneCJobMachineOutcome.COMPLETED, ...serializeAction(required(rows[0], 'ONE_C_JOB_RESULT_NOT_RETURNED')) } as const;
    } catch (error) { throw translate(error); }
  }

  async fail(
    machineBearer: string,
    leaseBearer: string,
    jobId: string,
    report: OneCJobFailureReport,
    correlationId: string,
    now: Date = new Date(),
  ) {
    validateOneCJobFailureReport(report);
    const authority = await this.authorizeLease(machineBearer, leaseBearer, now, true);
    if (!authority.authorized) return authority.response;
    if (authority.lease.jobId !== jobId) return unauthorized('SCOPE_MISMATCH');
    try {
      const rows = await this.prisma.$queryRaw<ActionRow[]>(Prisma.sql`
        SELECT job_id AS "jobId", status, sync_state AS "syncState",
               next_attempt_at AS "nextAttemptAt", replayed
          FROM connector.fail_one_c_job(
            ${authority.authentication.credentialId}, ${authority.lease.leaseId},
            ${report.idempotencyKey}, ${report.payloadHash}, ${report.revision}::bigint,
            ${report.attempt}::integer, ${report.failureClass}, ${report.effectState},
            ${report.resultCode}, ${correlationId}
          )
      `);
      return { outcome: OneCJobMachineOutcome.FAILED, ...serializeAction(required(rows[0], 'ONE_C_JOB_FAILURE_RESULT_NOT_RETURNED')) } as const;
    } catch (error) { throw translate(error); }
  }

  async describeJobs(
    user: RequestUser | undefined,
    input: { status?: OneCJobStatus; limit?: number; correlationId: string },
  ) {
    const limit = input.limit ?? 50;
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new OneCJobRuntimeRepositoryError('ONE_C_JOB_READ_LIMIT_INVALID');
    }
    return this.transactions.withOrganizationMemberContext(user, async (tx) => {
      const capabilities = await this.tasks.capabilitiesWithin(tx);
      if (!capabilities.includes(Capability.INTEGRATIONS_READ)) {
        return { outcome: OneCJobReadOutcome.REFUSED, jobs: [], refusal: OneCHumanRefusal.CAPABILITY_REQUIRED } as const;
      }
      try {
        const rows = await tx.$queryRaw<JobViewRow[]>(Prisma.sql`
          SELECT job_id AS "jobId", command, payload_hash AS "payloadHash",
                 idempotency_key AS "idempotencyKey", correlation_id AS "correlationId",
                 external_id AS "externalId", status, sync_state AS "syncState",
                 revision, attempt, max_attempts AS "maxAttempts", terminal_code AS "terminalCode",
                 external_evidence_id AS "externalEvidenceId", acknowledged_at AS "acknowledgedAt",
                 completed_at AS "completedAt", reconciliation_required_at AS "reconciliationRequiredAt",
                 dead_letter_at AS "deadLetterAt", created_at AS "createdAt", updated_at AS "updatedAt"
            FROM connector.read_one_c_jobs(${input.status ?? null}, ${limit}::integer, ${input.correlationId})
        `);
        return { outcome: OneCJobReadOutcome.AVAILABLE, jobs: rows.map(serializeJobView) } as const;
      } catch (error) { throw translate(error); }
    });
  }

  async reconcile(
    user: RequestUser | undefined,
    jobId: string,
    command: OneCJobReconciliationCommand,
    correlationId: string,
    now: Date = new Date(),
  ) {
    validateOneCJobReconciliationCommand(command);
    return this.transactions.withOrganizationMemberContext(user, async (tx) => {
      const capabilities = await this.tasks.capabilitiesWithin(tx, now);
      if (!capabilities.includes(Capability.INTEGRATIONS_CONFIGURE)) {
        return { outcome: OneCJobReconciliationOutcome.REFUSED, refusal: OneCHumanRefusal.CAPABILITY_REQUIRED } as const;
      }
      const mfa = freshMfa(user, now);
      if (mfa) return { outcome: OneCJobReconciliationOutcome.REFUSED, refusal: mfa } as const;
      try {
        const rows = await tx.$queryRaw<ActionRow[]>(Prisma.sql`
          SELECT job_id AS "jobId", status, sync_state AS "syncState", revision, replayed
            FROM connector.reconcile_one_c_job(
              ${jobId}, ${command.idempotencyKey}, ${command.action}, ${command.reasonCode},
              ${command.externalEvidenceId}, ${correlationId}
            )
        `);
        return { outcome: OneCJobReconciliationOutcome.APPLIED, ...serializeAction(required(rows[0], 'ONE_C_JOB_RECONCILIATION_RESULT_NOT_RETURNED')) } as const;
      } catch (error) { throw translate(error); }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxConflictRetries: 3 });
  }

  private async authorizeLease(
    machineBearer: string,
    leaseBearer: string,
    now: Date,
    allowTerminalReplay: boolean,
  ): Promise<
    | { authorized: true; authentication: Extract<OneCMachineAuthentication, { authorized: true }>; lease: LeaseVerifierRow }
    | { authorized: false; response: ReturnType<typeof unauthorized> }
  > {
    const authentication = await this.runtime.authenticateMachineBearer(machineBearer, undefined, now);
    if (!authentication.authorized) return { authorized: false, response: unauthorized(authentication.reason) };
    const leaseId = leaseIdFromBearer(leaseBearer);
    if (!leaseId) return { authorized: false, response: unauthorized('MALFORMED_BEARER') };
    const rows = await this.prisma.$queryRaw<LeaseVerifierRow[]>(Prisma.sql`
      SELECT lease_id AS "leaseId", job_id AS "jobId", tenant_id AS "tenantId",
             organization_id AS "organizationId", installation_id AS "installationId",
             binding_id AS "bindingId", credential_id AS "credentialId",
             provider_partition AS "providerPartition", salt, bearer_hash AS "bearerHash",
             issued_at AS "issuedAt", expires_at AS "expiresAt",
             acknowledged_at AS "acknowledgedAt", terminal_at AS "terminalAt",
             terminal_result AS "terminalResult", terminal_code AS "terminalCode",
             external_evidence_id AS "externalEvidenceId", revision, attempt,
             idempotency_key AS "idempotencyKey", correlation_id AS "correlationId",
             payload_hash AS "payloadHash"
        FROM connector.read_one_c_job_lease_verifier(${authentication.credentialId}, ${leaseId})
    `);
    const lease = rows[0];
    if (!lease) return { authorized: false, response: unauthorized('NOT_FOUND') };
    const record: IntegrationJobLeaseRecord = {
      ...lease,
      revision: safeNumber(lease.revision, 'ONE_C_JOB_REVISION_INVALID'),
      scope: {
        tenantPartition: lease.tenantId,
        providerPartition: lease.providerPartition,
        organizationId: lease.organizationId,
        connectionId: lease.bindingId,
        credentialId: lease.credentialId,
      },
    };
    const verification = verifyIntegrationJobLease(record, leaseBearer, {
      tenantPartition: lease.tenantId,
      providerPartition: 'ONE_C',
      organizationId: authentication.organizationId,
      connectionId: authentication.connectionId,
      credentialId: authentication.credentialId,
    }, now, allowTerminalReplay);
    if (!verification.authorized) return { authorized: false, response: unauthorized(verification.reason) };
    return { authorized: true, authentication, lease };
  }
}

function unauthorized(reason: OneCMachineAuthenticationDenial | string) {
  return { outcome: OneCJobMachineOutcome.UNAUTHORIZED, reason } as const;
}

function leaseIdFromBearer(value: string): string | null {
  const match = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.[A-Za-z0-9_-]{43}$/i.exec(value);
  return match?.[1] ?? null;
}

function serializeAction<T extends ActionRow | EnqueueRow>(row: T) {
  return {
    ...row,
    revision: row.revision === undefined ? undefined : safeNumber(row.revision, 'ONE_C_JOB_REVISION_INVALID'),
  };
}

function serializeJobView(row: JobViewRow) {
  return { ...row, revision: safeNumber(row.revision, 'ONE_C_JOB_REVISION_INVALID') };
}

function safeNumber(value: bigint, code: string): number {
  if (value < 0n || value > BigInt(Number.MAX_SAFE_INTEGER)) throw new OneCJobRuntimeRepositoryError(code);
  return Number(value);
}

function required<T>(value: T | undefined, code: string): T {
  if (!value) throw new OneCJobRuntimeRepositoryError(code);
  return value;
}

function freshMfa(user: RequestUser | undefined, now: Date): OneCHumanRefusal | null {
  if (user?.mfaVerified !== true || !user.mfaVerifiedAt) return OneCHumanRefusal.MFA_REQUIRED;
  const verifiedAt = new Date(user.mfaVerifiedAt);
  const age = now.getTime() - verifiedAt.getTime();
  return !Number.isFinite(verifiedAt.getTime()) || age < 0 || age > DEFAULT_MFA_MAX_AGE_SECONDS * 1000
    ? OneCHumanRefusal.MFA_STALE
    : null;
}

const DATABASE_CODES = new Set([
  'ONE_C_JOB_PAYLOAD_INVALID', 'ONE_C_JOB_PAYLOAD_HASH_MISMATCH',
  'ONE_C_JOB_ENVELOPE_INVALID', 'ONE_C_JOB_IDEMPOTENCY_CONFLICT',
  'ONE_C_ACTIVE_BINDING_REQUIRED', 'ONE_C_JOB_COMMAND_NOT_ALLOWED',
  'ONE_C_JOB_INSTALLATION_NOT_ACTIVE', 'ONE_C_JOB_CREDENTIAL_NOT_ACTIVE',
  'ONE_C_JOB_BINDING_NOT_ACTIVE', 'ONE_C_JOB_LEASE_REQUEST_INVALID',
  'ONE_C_JOB_LEASE_NOT_FOUND', 'ONE_C_JOB_NOT_FOUND',
  'ONE_C_JOB_RECEIPT_IDEMPOTENCY_CONFLICT', 'ONE_C_JOB_LEASE_NOT_ACTIVE',
  'ONE_C_JOB_RECEIPT_ENVELOPE_MISMATCH', 'ONE_C_JOB_LEASE_NOT_ACKNOWLEDGED',
  'ONE_C_JOB_ACK_INVALID', 'ONE_C_JOB_RESULT_INVALID', 'ONE_C_JOB_FAILURE_INVALID',
  'ONE_C_JOB_READ_REQUEST_INVALID', 'ONE_C_JOB_RECONCILIATION_INVALID',
  'ONE_C_JOB_RECONCILIATION_NOT_REQUIRED', 'ONE_C_JOB_ACTIVE_LEASE_PRESENT',
  'ONE_C_JOB_MAX_ATTEMPTS_EXHAUSTED',
]);

function translate(error: unknown): OneCJobRuntimeRepositoryError {
  if (error instanceof OneCJobRuntimeRepositoryError) return error;
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const sqlState = typeof error.meta?.code === 'string' ? error.meta.code : null;
    const mapped = sqlState === null ? undefined : new Map([
      ['P1C02', 'ONE_C_JOB_NOT_FOUND'],
      ['P1C03', 'ONE_C_JOB_IDEMPOTENCY_CONFLICT'],
      ['P1C04', 'ONE_C_JOB_RECEIPT_IDEMPOTENCY_CONFLICT'],
    ]).get(sqlState);
    if (mapped) return new OneCJobRuntimeRepositoryError(mapped);
  }
  const text = error instanceof Prisma.PrismaClientKnownRequestError
    ? `${error.message} ${String(error.meta?.message ?? '')}`
    : error instanceof Error ? error.message : '';
  for (const code of DATABASE_CODES) if (text.includes(code)) return new OneCJobRuntimeRepositoryError(code);
  return new OneCJobRuntimeRepositoryError('ONE_C_JOB_RUNTIME_REFUSED');
}
