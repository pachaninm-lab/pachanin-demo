import type { PlatformV7DocumentRequirement } from './document-matrix';
import {
  platformV7ApplyMoneyOperation,
  type PlatformV7MoneyOperation,
  type PlatformV7MoneyOperationApplyResult,
  type PlatformV7MoneyOperationType,
  type PlatformV7MoneyTree,
  type PlatformV7ReleaseGateDecision,
} from './money-tree';
import type { PlatformV7CanonicalRole } from './role-canonical';

export type P7BankBasisStatus = 'draft' | 'blocked' | 'ready_for_bank_review' | 'sent_to_bank' | 'bank_confirmed' | 'bank_rejected' | 'manual_review';
export type P7BankConfirmationPath = 'release' | 'refund' | 'hold' | 'reject' | 'manual_review';
export type P7BankConfirmationOperationType<Path extends P7BankConfirmationPath = P7BankConfirmationPath> =
  Path extends 'release' ? 'release_confirmed'
    : Path extends 'refund' ? 'refund_confirmed'
      : Path extends 'hold' ? 'hold_created'
        : Path extends 'reject' ? 'release_failed'
          : 'manual_review_started';
export type P7BankAuditAction =
  | 'bank_basis_sent'
  | 'bank_release_confirmed'
  | 'bank_release_rejected'
  | 'bank_refund_confirmed'
  | 'bank_hold_confirmed'
  | 'bank_manual_review_started'
  | 'bank_manual_review_resolved'
  | 'arbitration_decision_used_as_basis';
export type P7BankAuditOutcome = 'allowed' | 'blocked' | 'denied';
export type P7BankConfirmationCode =
  | 'OK'
  | 'CANNOT_SEND_BANK_BASIS'
  | 'CANNOT_CONFIRM_UNSENT_BASIS'
  | 'BANK_OFFICER_REQUIRED'
  | 'DUPLICATE_BANK_EVENT'
  | 'DUPLICATE_IDEMPOTENCY_KEY'
  | 'MONEY_OPERATION_BLOCKED';

export interface P7BankBasisInput {
  readonly dealId: string;
  readonly releaseGate: PlatformV7ReleaseGateDecision;
  readonly documents: readonly PlatformV7DocumentRequirement[];
  readonly disputeResolved: boolean;
  readonly amount: number;
  readonly currency: 'RUB';
  readonly correlationId: string;
  readonly auditId: string;
}

export interface P7BankBasisDecision {
  readonly dealId: string;
  readonly status: P7BankBasisStatus;
  readonly canSendToBank: boolean;
  readonly blockerCodes: readonly string[];
  readonly basisDocumentIds: readonly string[];
  readonly amount: number;
  readonly currency: 'RUB';
  readonly correlationId: string;
  readonly auditId: string;
  readonly note: string;
  readonly bankEventId?: string;
  readonly idempotencyKey?: string;
  readonly bankReference?: string;
  readonly confirmedAt?: string;
  readonly confirmationPath?: P7BankConfirmationPath;
  readonly confirmedByRole?: PlatformV7CanonicalRole;
}

export interface P7BankConfirmationEvent<Path extends P7BankConfirmationPath = P7BankConfirmationPath> {
  readonly bankEventId: string;
  readonly idempotencyKey: string;
  readonly path: Path;
  readonly operationType: P7BankConfirmationOperationType<Path>;
  readonly amount: number;
  readonly actorId: string;
  readonly actorRole: PlatformV7CanonicalRole;
  readonly organizationId: string;
  readonly bankReference: string;
  readonly confirmedAt: string;
  readonly auditId: string;
  readonly correlationId: string;
}

export interface P7BankAuditPayload {
  readonly auditId: string;
  readonly correlationId: string;
  readonly actorId: string;
  readonly actorRole: PlatformV7CanonicalRole;
  readonly organizationId: string;
  readonly dealId: string;
  readonly moneyOperationId: string | null;
  readonly beforeMoneyTree: PlatformV7MoneyTree;
  readonly afterMoneyTree: PlatformV7MoneyTree;
  readonly basisDocumentIds: readonly string[];
  readonly bankEventId: string | null;
  readonly action: P7BankAuditAction;
  readonly createdAt: string;
  readonly outcome: P7BankAuditOutcome;
  readonly code: P7BankConfirmationCode;
  readonly reason: string;
}

export interface P7BankBasisPayloadInput {
  readonly decision: P7BankBasisDecision;
  readonly moneyTree: PlatformV7MoneyTree;
  readonly actorId: string;
  readonly actorRole: PlatformV7CanonicalRole;
  readonly organizationId: string;
  readonly createdAt: string;
}

export interface P7BankBasisPayload {
  readonly dealId: string;
  readonly status: P7BankBasisStatus;
  readonly basisDocumentIds: readonly string[];
  readonly amount: number;
  readonly currency: 'RUB';
  readonly actorId: string;
  readonly actorRole: PlatformV7CanonicalRole;
  readonly organizationId: string;
  readonly createdAt: string;
  readonly auditId: string;
  readonly correlationId: string;
}

export interface P7BankBasisSendResult {
  readonly valid: boolean;
  readonly code: P7BankConfirmationCode;
  readonly reason: string;
  readonly decision: P7BankBasisDecision;
  readonly payload: P7BankBasisPayload;
  readonly auditPayload: P7BankAuditPayload;
  readonly auditPayloads: readonly P7BankAuditPayload[];
}

export interface P7BankConfirmationInput<Path extends P7BankConfirmationPath = P7BankConfirmationPath> {
  readonly decision: P7BankBasisDecision;
  readonly moneyTree: PlatformV7MoneyTree;
  readonly confirmation: P7BankConfirmationEvent<Path>;
  readonly existingBankEventIds?: readonly string[];
  readonly usedIdempotencyKeys?: readonly string[];
  readonly existingOperationIds?: readonly string[];
}

export type P7ConfirmBankReleaseInput = P7BankConfirmationInput<'release'>;
export type P7RejectBankReleaseInput = P7BankConfirmationInput<'reject'>;
export type P7ConfirmBankRefundInput = P7BankConfirmationInput<'refund'>;
export type P7ConfirmBankHoldInput = P7BankConfirmationInput<'hold'>;
export type P7StartBankManualReviewInput = P7BankConfirmationInput<'manual_review'>;

export interface P7ApplyBankConfirmationToMoneyTreeInput<Path extends P7BankConfirmationPath = P7BankConfirmationPath> {
  readonly decision: P7BankBasisDecision;
  readonly moneyTree: PlatformV7MoneyTree;
  readonly confirmation: P7BankConfirmationEvent<Path>;
  readonly existingOperationIds?: readonly string[];
  readonly usedIdempotencyKeys?: readonly string[];
}

export interface P7ApplyBankConfirmationToMoneyTreeResult {
  readonly moneyOperation: PlatformV7MoneyOperation;
  readonly moneyResult: PlatformV7MoneyOperationApplyResult;
}

export interface P7BankConfirmationResult {
  readonly valid: boolean;
  readonly code: P7BankConfirmationCode;
  readonly reason: string;
  readonly decision: P7BankBasisDecision;
  readonly moneyTree: PlatformV7MoneyTree;
  readonly auditPayload: P7BankAuditPayload;
  readonly auditPayloads: readonly P7BankAuditPayload[];
  readonly moneyOperation?: PlatformV7MoneyOperation;
  readonly moneyResult?: PlatformV7MoneyOperationApplyResult;
}

export type P7ConfirmBankReleaseResult = P7BankConfirmationResult;

export interface P7BankManualReviewResolvedAuditInput {
  readonly decision: P7BankBasisDecision;
  readonly actorId: string;
  readonly actorRole: PlatformV7CanonicalRole;
  readonly organizationId: string;
  readonly auditId: string;
  readonly correlationId: string;
  readonly moneyOperationId: string | null;
  readonly bankEventId: string | null;
  readonly beforeMoneyTree: PlatformV7MoneyTree;
  readonly afterMoneyTree: PlatformV7MoneyTree;
  readonly createdAt: string;
  readonly reason: string;
}

const BANK_BASIS_REQUIRED_DOCUMENT_IDS = [
  'contract',
  'sdiz',
  'acceptance_act',
  'lab_protocol',
] as const;

function isConfirmedOrSigned(document: PlatformV7DocumentRequirement): boolean {
  return document.status === 'confirmed' || document.status === 'signed';
}

function p7BankConfirmationStatus(path: P7BankConfirmationPath): P7BankBasisStatus {
  if (path === 'reject') return 'bank_rejected';
  if (path === 'manual_review') return 'manual_review';
  return 'bank_confirmed';
}

function p7BankMoneyOperationType<Path extends P7BankConfirmationPath>(path: Path): P7BankConfirmationOperationType<Path> {
  const operationTypeByPath: Record<P7BankConfirmationPath, P7BankConfirmationOperationType> = {
    release: 'release_confirmed',
    refund: 'refund_confirmed',
    hold: 'hold_created',
    reject: 'release_failed',
    manual_review: 'manual_review_started',
  };

  return operationTypeByPath[path] as P7BankConfirmationOperationType<Path>;
}

function p7BankAuditAction(path: P7BankConfirmationPath): P7BankAuditAction {
  const actionByPath: Record<P7BankConfirmationPath, P7BankAuditAction> = {
    release: 'bank_release_confirmed',
    refund: 'bank_refund_confirmed',
    hold: 'bank_hold_confirmed',
    reject: 'bank_release_rejected',
    manual_review: 'bank_manual_review_started',
  };

  return actionByPath[path];
}

function p7CreateAuditPayload(input: {
  readonly action: P7BankAuditAction;
  readonly auditId: string;
  readonly correlationId: string;
  readonly actorId: string;
  readonly actorRole: PlatformV7CanonicalRole;
  readonly organizationId: string;
  readonly dealId: string;
  readonly moneyOperationId: string | null;
  readonly beforeMoneyTree: PlatformV7MoneyTree;
  readonly afterMoneyTree: PlatformV7MoneyTree;
  readonly basisDocumentIds: readonly string[];
  readonly bankEventId: string | null;
  readonly createdAt: string;
  readonly outcome: P7BankAuditOutcome;
  readonly code: P7BankConfirmationCode;
  readonly reason: string;
}): P7BankAuditPayload {
  return input;
}

export function p7BuildBankBasis(input: P7BankBasisInput): P7BankBasisDecision {
  const blockers: string[] = [];
  const basisDocumentIds = input.documents
    .filter((document) => document.affectsMoney && (document.status === 'confirmed' || document.status === 'signed' || document.status === 'conditional'))
    .map((document) => document.documentId);

  const missingMoneyDocuments = input.documents.filter((document) =>
    document.affectsMoney
    && document.blockStages.includes('release')
    && document.status !== 'confirmed'
    && document.status !== 'signed'
    && document.status !== 'conditional'
  );

  const missingRequiredBasisDocuments = BANK_BASIS_REQUIRED_DOCUMENT_IDS.filter((documentId) => {
    const document = input.documents.find((candidate) => candidate.documentId === documentId);
    return !document || !document.affectsMoney || !isConfirmedOrSigned(document);
  });

  if (!input.releaseGate.allowed) blockers.push('RELEASE_GATE_BLOCKED');
  if (missingMoneyDocuments.length > 0) blockers.push('MONEY_DOCUMENTS_INCOMPLETE');
  if (missingRequiredBasisDocuments.length > 0) blockers.push('BANK_BASIS_REQUIRED_DOCUMENTS_INCOMPLETE');
  if (!input.disputeResolved) blockers.push('DISPUTE_NOT_RESOLVED');
  if (input.amount <= 0) blockers.push('INVALID_AMOUNT');
  if (!input.correlationId || !input.auditId) blockers.push('TRACE_REQUIRED');

  const canSendToBank = blockers.length === 0;

  return {
    dealId: input.dealId,
    status: canSendToBank ? 'ready_for_bank_review' : 'blocked',
    canSendToBank,
    blockerCodes: blockers,
    basisDocumentIds,
    amount: input.amount,
    currency: input.currency,
    correlationId: input.correlationId,
    auditId: input.auditId,
    note: canSendToBank
      ? 'Bank basis is ready to be sent for review. This does not confirm payment release.'
      : 'Bank basis is blocked until release, documents, dispute and trace conditions are satisfied.',
  };
}

export function p7BuildBankBasisPayload(input: P7BankBasisPayloadInput): P7BankBasisPayload {
  return {
    dealId: input.decision.dealId,
    status: input.decision.status,
    basisDocumentIds: input.decision.basisDocumentIds,
    amount: input.decision.amount,
    currency: input.decision.currency,
    actorId: input.actorId,
    actorRole: input.actorRole,
    organizationId: input.organizationId,
    createdAt: input.createdAt,
    auditId: input.decision.auditId,
    correlationId: input.decision.correlationId,
  };
}

export function p7ValidateBankBasisBeforeSend(input: P7BankBasisPayloadInput): P7BankBasisSendResult {
  const payload = p7BuildBankBasisPayload(input);
  const valid = input.decision.canSendToBank && input.decision.status === 'ready_for_bank_review';
  const code: P7BankConfirmationCode = valid ? 'OK' : 'CANNOT_SEND_BANK_BASIS';
  const reason = valid
    ? 'Bank basis can be sent to bank review. This does not move MoneyTree buckets.'
    : 'Bank basis cannot be sent until blockers are cleared.';
  const decision = valid
    ? { ...input.decision, status: 'sent_to_bank' as const, canSendToBank: false }
    : { ...input.decision, status: 'blocked' as const };
  const primaryAuditPayload = p7CreateAuditPayload({
    action: 'bank_basis_sent',
    auditId: input.decision.auditId,
    correlationId: input.decision.correlationId,
    actorId: input.actorId,
    actorRole: input.actorRole,
    organizationId: input.organizationId,
    dealId: input.decision.dealId,
    moneyOperationId: `bank_basis:${input.decision.dealId}:${input.decision.auditId}`,
    beforeMoneyTree: input.moneyTree,
    afterMoneyTree: input.moneyTree,
    basisDocumentIds: input.decision.basisDocumentIds,
    bankEventId: null,
    createdAt: input.createdAt,
    outcome: valid ? 'allowed' : 'blocked',
    code,
    reason,
  });
  const auditPayloads = input.decision.basisDocumentIds.includes('arbitration_decision')
    ? [
        primaryAuditPayload,
        p7CreateAuditPayload({
          ...primaryAuditPayload,
          action: 'arbitration_decision_used_as_basis',
          moneyOperationId: `arbitration_basis:${input.decision.dealId}:${input.decision.auditId}`,
        }),
      ]
    : [primaryAuditPayload];

  return {
    valid,
    code,
    reason,
    decision,
    payload,
    auditPayload: primaryAuditPayload,
    auditPayloads,
  };
}

export function p7MarkBankBasisSent(input: P7BankBasisPayloadInput): P7BankBasisSendResult {
  return p7ValidateBankBasisBeforeSend(input);
}

export function p7ApplyBankConfirmationToMoneyTree<Path extends P7BankConfirmationPath>(
  input: P7ApplyBankConfirmationToMoneyTreeInput<Path>,
): P7ApplyBankConfirmationToMoneyTreeResult {
  const operation: PlatformV7MoneyOperation = {
    operationId: `bank:${input.confirmation.bankEventId}`,
    dealId: input.decision.dealId,
    type: input.confirmation.operationType as PlatformV7MoneyOperationType,
    amount: input.confirmation.amount,
    currency: input.decision.currency,
    basisDocumentIds: input.decision.basisDocumentIds,
    actorId: input.confirmation.actorId,
    actorRole: input.confirmation.actorRole,
    occurredAt: input.confirmation.confirmedAt,
    idempotencyKey: input.confirmation.idempotencyKey,
    correlationId: input.confirmation.correlationId,
    auditId: input.confirmation.auditId,
  };

  return {
    moneyOperation: operation,
    moneyResult: platformV7ApplyMoneyOperation({
      tree: input.moneyTree,
      operation,
      bankConfirmationExists: true,
      existingOperationIds: input.existingOperationIds,
      usedIdempotencyKeys: input.usedIdempotencyKeys,
    }),
  };
}

export function p7BuildBankManualReviewResolvedAuditPayload(input: P7BankManualReviewResolvedAuditInput): P7BankAuditPayload {
  return p7CreateAuditPayload({
    action: 'bank_manual_review_resolved',
    auditId: input.auditId,
    correlationId: input.correlationId,
    actorId: input.actorId,
    actorRole: input.actorRole,
    organizationId: input.organizationId,
    dealId: input.decision.dealId,
    moneyOperationId: input.moneyOperationId,
    beforeMoneyTree: input.beforeMoneyTree,
    afterMoneyTree: input.afterMoneyTree,
    basisDocumentIds: input.decision.basisDocumentIds,
    bankEventId: input.bankEventId,
    createdAt: input.createdAt,
    outcome: 'allowed',
    code: 'OK',
    reason: input.reason,
  });
}

function p7BlockedBankConfirmationResult<Path extends P7BankConfirmationPath>(
  input: P7BankConfirmationInput<Path>,
  action: P7BankAuditAction,
  code: P7BankConfirmationCode,
  reason: string,
  outcome: P7BankAuditOutcome,
  decision: P7BankBasisDecision = input.decision,
): P7BankConfirmationResult {
  const auditPayload = p7CreateAuditPayload({
    action,
    auditId: input.confirmation.auditId,
    correlationId: input.confirmation.correlationId,
    actorId: input.confirmation.actorId,
    actorRole: input.confirmation.actorRole,
    organizationId: input.confirmation.organizationId,
    dealId: input.decision.dealId,
    moneyOperationId: `bank:${input.confirmation.bankEventId}`,
    beforeMoneyTree: input.moneyTree,
    afterMoneyTree: input.moneyTree,
    basisDocumentIds: input.decision.basisDocumentIds,
    bankEventId: input.confirmation.bankEventId,
    createdAt: input.confirmation.confirmedAt,
    outcome,
    code,
    reason,
  });

  return {
    valid: false,
    code,
    reason,
    decision,
    moneyTree: input.moneyTree,
    auditPayload,
    auditPayloads: [auditPayload],
  };
}

function p7ConfirmBankMovement<Path extends P7BankConfirmationPath>(
  input: P7BankConfirmationInput<Path>,
  expectedPath: Path,
): P7BankConfirmationResult {
  const action = p7BankAuditAction(expectedPath);
  const expectedOperationType = p7BankMoneyOperationType(expectedPath);

  if (input.confirmation.path !== expectedPath || input.confirmation.operationType !== expectedOperationType) {
    return p7BlockedBankConfirmationResult(
      input,
      action,
      'MONEY_OPERATION_BLOCKED',
      'Bank confirmation path and MoneyTree operation type must match the explicit bank action.',
      'blocked',
      { ...input.decision, status: 'manual_review', canSendToBank: false },
    );
  }

  if (input.decision.status !== 'sent_to_bank') {
    return p7BlockedBankConfirmationResult(
      input,
      action,
      'CANNOT_CONFIRM_UNSENT_BASIS',
      'Bank basis must be sent to bank before a confirmation can be applied.',
      'blocked',
      { ...input.decision, status: 'manual_review', canSendToBank: false, blockerCodes: [...input.decision.blockerCodes, 'CANNOT_CONFIRM_UNSENT_BASIS'] },
    );
  }

  if (input.confirmation.actorRole !== 'bank_officer') {
    return p7BlockedBankConfirmationResult(
      input,
      action,
      'BANK_OFFICER_REQUIRED',
      'Only BankOfficer can confirm a bank money event.',
      'denied',
      { ...input.decision, status: 'manual_review', canSendToBank: false, blockerCodes: [...input.decision.blockerCodes, 'BANK_OFFICER_REQUIRED'] },
    );
  }

  if (input.existingBankEventIds?.includes(input.confirmation.bankEventId)) {
    return p7BlockedBankConfirmationResult(input, action, 'DUPLICATE_BANK_EVENT', 'Bank event was already processed.', 'blocked');
  }

  if (input.usedIdempotencyKeys?.includes(input.confirmation.idempotencyKey)) {
    return p7BlockedBankConfirmationResult(input, action, 'DUPLICATE_IDEMPOTENCY_KEY', 'Bank confirmation idempotency key was already used.', 'blocked');
  }

  const { moneyOperation, moneyResult } = p7ApplyBankConfirmationToMoneyTree(input);

  if (!moneyResult.valid) {
    return {
      ...p7BlockedBankConfirmationResult(
        input,
        action,
        'MONEY_OPERATION_BLOCKED',
        moneyResult.reason,
        'blocked',
        { ...input.decision, status: 'manual_review', canSendToBank: false, blockerCodes: [...input.decision.blockerCodes, moneyResult.code], note: moneyResult.reason },
      ),
      moneyOperation,
      moneyResult,
    };
  }

  const reason = expectedPath === 'release'
    ? 'Bank confirmed the release event. MoneyTree mutation is recorded through release_confirmed.'
    : 'Bank event was recorded. MoneyTree mutation is recorded through the matching money operation.';
  const auditPayload = p7CreateAuditPayload({
    action,
    auditId: input.confirmation.auditId,
    correlationId: input.confirmation.correlationId,
    actorId: input.confirmation.actorId,
    actorRole: input.confirmation.actorRole,
    organizationId: input.confirmation.organizationId,
    dealId: input.decision.dealId,
    moneyOperationId: moneyOperation.operationId,
    beforeMoneyTree: input.moneyTree,
    afterMoneyTree: moneyResult.tree,
    basisDocumentIds: input.decision.basisDocumentIds,
    bankEventId: input.confirmation.bankEventId,
    createdAt: input.confirmation.confirmedAt,
    outcome: 'allowed',
    code: 'OK',
    reason,
  });

  return {
    valid: true,
    code: 'OK',
    reason,
    decision: {
      ...input.decision,
      status: p7BankConfirmationStatus(expectedPath),
      canSendToBank: false,
      blockerCodes: [],
      bankEventId: input.confirmation.bankEventId,
      idempotencyKey: input.confirmation.idempotencyKey,
      bankReference: input.confirmation.bankReference,
      confirmedAt: input.confirmation.confirmedAt,
      confirmationPath: expectedPath,
      confirmedByRole: input.confirmation.actorRole,
      correlationId: input.confirmation.correlationId,
      auditId: input.confirmation.auditId,
      note: reason,
    },
    moneyTree: moneyResult.tree,
    moneyOperation,
    moneyResult,
    auditPayload,
    auditPayloads: [auditPayload],
  };
}

export function p7ConfirmBankRelease(input: P7ConfirmBankReleaseInput): P7ConfirmBankReleaseResult {
  return p7ConfirmBankMovement(input, 'release');
}

export function p7RejectBankRelease(input: P7RejectBankReleaseInput): P7BankConfirmationResult {
  return p7ConfirmBankMovement(input, 'reject');
}

export function p7ConfirmBankRefund(input: P7ConfirmBankRefundInput): P7BankConfirmationResult {
  return p7ConfirmBankMovement(input, 'refund');
}

export function p7ConfirmBankHold(input: P7ConfirmBankHoldInput): P7BankConfirmationResult {
  return p7ConfirmBankMovement(input, 'hold');
}

export function p7StartBankManualReview(input: P7StartBankManualReviewInput): P7BankConfirmationResult {
  return p7ConfirmBankMovement(input, 'manual_review');
}
