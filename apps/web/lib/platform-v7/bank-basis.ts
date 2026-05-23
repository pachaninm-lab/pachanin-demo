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
export type P7BankConfirmationCode =
  | 'OK'
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

export interface P7BankConfirmationEvent {
  readonly bankEventId: string;
  readonly idempotencyKey: string;
  readonly path: P7BankConfirmationPath;
  readonly amount: number;
  readonly actorId: string;
  readonly actorRole: PlatformV7CanonicalRole;
  readonly bankReference: string;
  readonly confirmedAt: string;
  readonly auditId: string;
  readonly correlationId: string;
}

export interface P7ConfirmBankReleaseInput {
  readonly decision: P7BankBasisDecision;
  readonly moneyTree: PlatformV7MoneyTree;
  readonly confirmation: P7BankConfirmationEvent;
  readonly existingBankEventIds?: readonly string[];
  readonly usedIdempotencyKeys?: readonly string[];
  readonly existingOperationIds?: readonly string[];
}

export interface P7ConfirmBankReleaseResult {
  readonly valid: boolean;
  readonly code: P7BankConfirmationCode;
  readonly reason: string;
  readonly decision: P7BankBasisDecision;
  readonly moneyTree: PlatformV7MoneyTree;
  readonly moneyOperation?: PlatformV7MoneyOperation;
  readonly moneyResult?: PlatformV7MoneyOperationApplyResult;
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

export function p7MarkBankBasisSent(decision: P7BankBasisDecision): P7BankBasisDecision {
  if (!decision.canSendToBank) return { ...decision, status: 'blocked' };
  return { ...decision, status: 'sent_to_bank', canSendToBank: false };
}

function p7BankConfirmationStatus(path: P7BankConfirmationPath): P7BankBasisStatus {
  if (path === 'reject') return 'bank_rejected';
  if (path === 'manual_review') return 'manual_review';
  return 'bank_confirmed';
}

function p7BankMoneyOperationType(path: P7BankConfirmationPath): PlatformV7MoneyOperationType {
  if (path === 'refund') return 'refund_confirmed';
  if (path === 'hold') return 'hold_created';
  if (path === 'reject') return 'release_failed';
  if (path === 'manual_review') return 'manual_review_started';
  return 'release_confirmed';
}

function p7ManualReviewDecision(
  input: P7ConfirmBankReleaseInput,
  code: P7BankConfirmationCode,
  reason: string,
): P7ConfirmBankReleaseResult {
  return {
    valid: false,
    code,
    reason,
    decision: {
      ...input.decision,
      status: 'manual_review',
      canSendToBank: false,
      blockerCodes: [...input.decision.blockerCodes, code],
      note: reason,
    },
    moneyTree: input.moneyTree,
  };
}

export function p7ConfirmBankRelease(input: P7ConfirmBankReleaseInput): P7ConfirmBankReleaseResult {
  const { decision, moneyTree, confirmation } = input;

  if (decision.status !== 'sent_to_bank') {
    return p7ManualReviewDecision(input, 'CANNOT_CONFIRM_UNSENT_BASIS', 'Bank basis must be sent to bank before a confirmation can be applied.');
  }

  if (confirmation.actorRole !== 'bank_officer') {
    return p7ManualReviewDecision(input, 'BANK_OFFICER_REQUIRED', 'Only BankOfficer can confirm a bank money event.');
  }

  if (input.existingBankEventIds?.includes(confirmation.bankEventId)) {
    return {
      valid: false,
      code: 'DUPLICATE_BANK_EVENT',
      reason: 'Bank event was already processed.',
      decision,
      moneyTree,
    };
  }

  if (input.usedIdempotencyKeys?.includes(confirmation.idempotencyKey)) {
    return {
      valid: false,
      code: 'DUPLICATE_IDEMPOTENCY_KEY',
      reason: 'Bank confirmation idempotency key was already used.',
      decision,
      moneyTree,
    };
  }

  const operation: PlatformV7MoneyOperation = {
    operationId: `bank:${confirmation.bankEventId}`,
    dealId: decision.dealId,
    type: p7BankMoneyOperationType(confirmation.path),
    amount: confirmation.amount,
    currency: decision.currency,
    basisDocumentIds: decision.basisDocumentIds,
    actorId: confirmation.actorId,
    actorRole: confirmation.actorRole,
    occurredAt: confirmation.confirmedAt,
    idempotencyKey: confirmation.idempotencyKey,
    correlationId: confirmation.correlationId,
    auditId: confirmation.auditId,
  };

  const moneyResult = platformV7ApplyMoneyOperation({
    tree: moneyTree,
    operation,
    bankConfirmationExists: true,
    existingOperationIds: input.existingOperationIds,
    usedIdempotencyKeys: input.usedIdempotencyKeys,
  });

  if (!moneyResult.valid) {
    return {
      valid: false,
      code: 'MONEY_OPERATION_BLOCKED',
      reason: moneyResult.reason,
      decision: {
        ...decision,
        status: 'manual_review',
        canSendToBank: false,
        blockerCodes: [...decision.blockerCodes, moneyResult.code],
        note: moneyResult.reason,
      },
      moneyTree,
      moneyOperation: operation,
      moneyResult,
    };
  }

  return {
    valid: true,
    code: 'OK',
    reason: 'Bank confirmation event was applied to bank basis and MoneyTree.',
    decision: {
      ...decision,
      status: p7BankConfirmationStatus(confirmation.path),
      canSendToBank: false,
      blockerCodes: [],
      bankEventId: confirmation.bankEventId,
      idempotencyKey: confirmation.idempotencyKey,
      bankReference: confirmation.bankReference,
      confirmedAt: confirmation.confirmedAt,
      confirmationPath: confirmation.path,
      confirmedByRole: confirmation.actorRole,
      correlationId: confirmation.correlationId,
      auditId: confirmation.auditId,
      note: confirmation.path === 'release'
        ? 'Bank confirmed the release event. MoneyTree mutation is recorded separately through release_confirmed.'
        : 'Bank event was recorded. MoneyTree mutation is recorded separately through the matching money operation.',
    },
    moneyTree: moneyResult.tree,
    moneyOperation: operation,
    moneyResult,
  };
}
