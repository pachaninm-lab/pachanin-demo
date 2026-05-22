import type { PlatformV7DocumentRequirement } from './document-matrix';
import type { PlatformV7ReleaseGateDecision } from './money-tree';

export type P7BankBasisStatus = 'draft' | 'blocked' | 'ready_for_bank_review' | 'sent_to_bank' | 'bank_confirmed' | 'bank_rejected' | 'manual_review';

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

  if (!input.releaseGate.allowed) blockers.push('RELEASE_GATE_BLOCKED');
  if (missingMoneyDocuments.length > 0) blockers.push('MONEY_DOCUMENTS_INCOMPLETE');
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
