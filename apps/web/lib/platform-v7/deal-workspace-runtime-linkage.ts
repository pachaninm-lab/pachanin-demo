import {
  p7RuntimeDbContractNextState,
  type P7DealWorkspaceRuntimeDbContract,
  type P7DealWorkspaceRuntimeDbWriteState,
} from './deal-workspace-runtime-db-contract';
import type {
  P7DealWorkspaceRuntimeRepository,
  P7DealWorkspaceRuntimeRepositoryLinkage,
  P7DealWorkspaceRuntimeRepositoryReceipt,
} from './deal-workspace-runtime-db-repository';

export type P7DealWorkspaceRuntimeLinkageMaturity = 'contract-linkage';
export type P7DealWorkspaceRuntimeLinkageIssueCode =
  | 'OUTBOX_ENTRY_ID_REQUIRED'
  | 'OUTBOX_TYPE_MISMATCH'
  | 'OUTBOX_CORRELATION_MISMATCH'
  | 'OUTBOX_IDEMPOTENCY_MISMATCH'
  | 'AUDIT_EVENT_ID_REQUIRED'
  | 'AUDIT_ACTION_MISMATCH'
  | 'AUDIT_CORRELATION_MISMATCH'
  | 'AUDIT_ACTOR_MISMATCH';

export interface P7DealWorkspaceRuntimeOutboxEvidence {
  readonly entryId: string;
  readonly eventType: P7DealWorkspaceRuntimeDbContract['outboxType'];
  readonly correlationId: string;
  readonly idempotencyKey: string;
  readonly createdAt: string;
}

export interface P7DealWorkspaceRuntimeAuditEvidence {
  readonly eventId: string;
  readonly action: P7DealWorkspaceRuntimeDbContract['auditAction'];
  readonly correlationId: string;
  readonly actorId: string;
  readonly createdAt: string;
}

export interface P7DealWorkspaceRuntimeLinkageInput {
  readonly contract: P7DealWorkspaceRuntimeDbContract;
  readonly outbox?: P7DealWorkspaceRuntimeOutboxEvidence | null;
  readonly audit?: P7DealWorkspaceRuntimeAuditEvidence | null;
}

export interface P7DealWorkspaceRuntimeLinkageIssue {
  readonly code: P7DealWorkspaceRuntimeLinkageIssueCode;
  readonly field: string;
  readonly message: string;
}

export interface P7DealWorkspaceRuntimeLinkageResult {
  readonly linkage: P7DealWorkspaceRuntimeRepositoryLinkage;
  readonly state: P7DealWorkspaceRuntimeDbWriteState;
  readonly acceptedOutboxEvidence: boolean;
  readonly acceptedAuditEvidence: boolean;
  readonly issues: readonly P7DealWorkspaceRuntimeLinkageIssue[];
  readonly maturity: P7DealWorkspaceRuntimeLinkageMaturity;
}

export interface P7DealWorkspaceRuntimeLinkedRepositoryWriteInput extends P7DealWorkspaceRuntimeLinkageInput {
  readonly repository: P7DealWorkspaceRuntimeRepository;
  readonly savedAt?: string;
}

export interface P7DealWorkspaceRuntimeLinkedRepositoryWriteResult {
  readonly linkageResult: P7DealWorkspaceRuntimeLinkageResult;
  readonly repositoryReceipt: P7DealWorkspaceRuntimeRepositoryReceipt;
}

function nonEmpty(value: string): boolean {
  return value.trim().length > 0;
}

function validateOutboxEvidence(
  contract: P7DealWorkspaceRuntimeDbContract,
  evidence: P7DealWorkspaceRuntimeOutboxEvidence,
): readonly P7DealWorkspaceRuntimeLinkageIssue[] {
  const issues: P7DealWorkspaceRuntimeLinkageIssue[] = [];

  if (!nonEmpty(evidence.entryId)) {
    issues.push({ code: 'OUTBOX_ENTRY_ID_REQUIRED', field: 'outbox.entryId', message: 'Outbox entry id is required.' });
  }
  if (evidence.eventType !== contract.outboxType) {
    issues.push({ code: 'OUTBOX_TYPE_MISMATCH', field: 'outbox.eventType', message: 'Outbox event type does not match the runtime DB contract.' });
  }
  if (evidence.correlationId !== contract.correlationId) {
    issues.push({ code: 'OUTBOX_CORRELATION_MISMATCH', field: 'outbox.correlationId', message: 'Outbox correlation id does not match the runtime DB contract.' });
  }
  if (evidence.idempotencyKey !== contract.idempotencyKey) {
    issues.push({ code: 'OUTBOX_IDEMPOTENCY_MISMATCH', field: 'outbox.idempotencyKey', message: 'Outbox idempotency key does not match the runtime DB contract.' });
  }

  return issues;
}

function validateAuditEvidence(
  contract: P7DealWorkspaceRuntimeDbContract,
  evidence: P7DealWorkspaceRuntimeAuditEvidence,
): readonly P7DealWorkspaceRuntimeLinkageIssue[] {
  const issues: P7DealWorkspaceRuntimeLinkageIssue[] = [];

  if (!nonEmpty(evidence.eventId)) {
    issues.push({ code: 'AUDIT_EVENT_ID_REQUIRED', field: 'audit.eventId', message: 'Audit event id is required.' });
  }
  if (evidence.action !== contract.auditAction) {
    issues.push({ code: 'AUDIT_ACTION_MISMATCH', field: 'audit.action', message: 'Audit action does not match the runtime DB contract.' });
  }
  if (evidence.correlationId !== contract.correlationId) {
    issues.push({ code: 'AUDIT_CORRELATION_MISMATCH', field: 'audit.correlationId', message: 'Audit correlation id does not match the runtime DB contract.' });
  }
  if (evidence.actorId !== contract.actorId) {
    issues.push({ code: 'AUDIT_ACTOR_MISMATCH', field: 'audit.actorId', message: 'Audit actor id does not match the runtime DB contract.' });
  }

  return issues;
}

export function buildP7DealWorkspaceRuntimeLinkage(
  input: P7DealWorkspaceRuntimeLinkageInput,
): P7DealWorkspaceRuntimeLinkageResult {
  const outboxIssues = input.outbox ? validateOutboxEvidence(input.contract, input.outbox) : [];
  const auditIssues = input.audit ? validateAuditEvidence(input.contract, input.audit) : [];
  const acceptedOutboxEvidence = Boolean(input.outbox) && outboxIssues.length === 0;
  const acceptedAuditEvidence = Boolean(input.audit) && auditIssues.length === 0;

  const linkage: P7DealWorkspaceRuntimeRepositoryLinkage = {
    outboxEntryId: acceptedOutboxEvidence ? input.outbox?.entryId ?? null : null,
    auditEventId: acceptedAuditEvidence ? input.audit?.eventId ?? null : null,
  };

  return {
    linkage,
    state: p7RuntimeDbContractNextState(input.contract, linkage),
    acceptedOutboxEvidence,
    acceptedAuditEvidence,
    issues: [...outboxIssues, ...auditIssues],
    maturity: 'contract-linkage',
  };
}

export function writeP7DealWorkspaceRuntimeWithLinkage(
  input: P7DealWorkspaceRuntimeLinkedRepositoryWriteInput,
): P7DealWorkspaceRuntimeLinkedRepositoryWriteResult {
  const linkageResult = buildP7DealWorkspaceRuntimeLinkage({
    contract: input.contract,
    outbox: input.outbox,
    audit: input.audit,
  });
  const repositoryReceipt = input.repository.write({
    contract: input.contract,
    linkage: linkageResult.linkage,
    savedAt: input.savedAt,
  });

  return { linkageResult, repositoryReceipt };
}
