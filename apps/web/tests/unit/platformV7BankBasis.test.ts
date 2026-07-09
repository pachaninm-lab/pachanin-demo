import { describe, expect, it } from 'vitest';
import {
  p7BuildBankBasis,
  p7BuildBankBasisPayload,
  p7BuildBankManualReviewResolvedAuditPayload,
  p7ConfirmBankBasis,
  p7ConfirmBankHold,
  p7ConfirmBankRefund,
  p7MarkBankBasisSent,
  p7RejectBankBasis,
  p7StartBankManualReview,
  p7ValidateBankBasisBeforeSend,
  type P7BankConfirmationEvent,
  type P7BankConfirmationOperationType,
  type P7BankConfirmationPath,
} from '@/lib/platform-v7/bank-basis';
import type { PlatformV7DocumentRequirement, PlatformV7DocumentSource, PlatformV7DocumentStatus } from '@/lib/platform-v7/document-matrix';
import { buildPlatformV7IdempotencyKey } from '@/lib/platform-v7/idempotency-key-helper';
import type { PlatformV7BankBasisGateDecision, PlatformV7MoneyTree } from '@/lib/platform-v7/money-tree';
import type { PlatformV7CanonicalRole } from '@/lib/platform-v7/role-canonical';

const bankBasisGate: PlatformV7BankBasisGateDecision = { allowed: true, reason: 'ready', nextStatus: 'bank_basis_requested' };
const operationTypeByPath: Record<P7BankConfirmationPath, P7BankConfirmationOperationType> = { release: 'bank_basis_confirmed', refund: 'refund_confirmed', hold: 'hold_created', reject: 'bank_basis_rejected', manual_review: 'manual_review_started' };
function doc(documentId: string, title: string, ownerRole: PlatformV7CanonicalRole, status: PlatformV7DocumentStatus, source: PlatformV7DocumentSource): PlatformV7DocumentRequirement { return { documentId, dealId: 'deal-1', type: documentId, title, ownerRole, responsibleRole: ownerRole, status, blockStages: ['release'], affectsMoney: true, source, deadline: null, signatureStatus: 'not_required', nextAction: 'ok', createdAt: '', updatedAt: '' }; }
const docs: PlatformV7DocumentRequirement[] = [doc('contract', 'Договор', 'seller', 'confirmed', 'edo'), doc('sdiz', 'СДИЗ', 'seller', 'confirmed', 'fgis'), doc('acceptance_act', 'Акт', 'elevator_operator', 'signed', 'elevator'), doc('lab_protocol', 'Лаборатория', 'lab_specialist', 'confirmed', 'lab'), doc('arbitration_decision', 'Арбитраж', 'arbitrator', 'conditional', 'arbitration'), doc('bank_basis', 'Банк', 'operator', 'confirmed', 'bank')];
const bankBasisRequestedTree: PlatformV7MoneyTree = { dealId: 'deal-1', currency: 'RUB', totalDealAmount: 1000, reservedAmount: 1000, readyToReleaseAmount: 700, heldAmount: 100, manualReviewAmount: 0, releasedAmount: 100, refundedAmount: 100, platformFee: 10, bankFee: 5, status: 'bank_basis_requested' };
function readyBasis() { return p7BuildBankBasis({ dealId: 'deal-1', bankBasisGate, documents: docs, disputeResolved: true, amount: 300, currency: 'RUB', correlationId: 'corr-1', auditId: 'audit-1' }); }
function readySentBasis() { return p7MarkBankBasisSent({ decision: readyBasis(), moneyTree: bankBasisRequestedTree, actorId: 'operator-1', actorRole: 'operator', organizationId: 'org-operator', createdAt: '2026-05-23T07:50:00.000Z' }).decision; }
function confirmation<Path extends P7BankConfirmationPath>(path: Path, overrides: Partial<P7BankConfirmationEvent<Path>> = {}): P7BankConfirmationEvent<Path> {
  const amount = overrides.amount ?? (path === 'reject' ? 0 : 300);
  const bankEventId = overrides.bankEventId ?? `bank-event-${path}`;
  return { bankEventId, idempotencyKey: overrides.idempotencyKey ?? buildPlatformV7IdempotencyKey({ boundaryId: 'confirm_bank_basis', actorId: overrides.actorId ?? 'bank-1', entityId: 'money-1', dealId: 'deal-1', amountMinor: amount, currency: 'RUB', attemptId: bankEventId }), path, operationType: operationTypeByPath[path] as P7BankConfirmationOperationType<Path>, amount, actorId: overrides.actorId ?? 'bank-1', actorRole: overrides.actorRole ?? 'bank_officer', organizationId: overrides.organizationId ?? 'org-bank', bankOrganizationId: overrides.bankOrganizationId ?? 'bank-org-1', bankReference: overrides.bankReference ?? `BR-${path}`, confirmedAt: overrides.confirmedAt ?? '2026-05-23T08:00:00.000Z', auditId: overrides.auditId ?? 'audit-bank-1', correlationId: overrides.correlationId ?? 'corr-bank-1' };
}
const noHistory = { existingBankEventIds: [] as readonly string[], usedIdempotencyKeys: [] as readonly string[], existingOperationIds: [] as readonly string[] } as const;

describe('platform-v7 bank basis foundation', () => {
  it('builds ready bank basis only from satisfied gate and document conditions', () => {
    const decision = readyBasis();
    expect(decision.status).toBe('ready_for_bank_review');
    expect(decision.canSendToBank).toBe(true);
    expect(decision.blockerCodes).toEqual([]);
    expect(decision.basisDocumentIds).toEqual(['contract', 'sdiz', 'acceptance_act', 'lab_protocol', 'arbitration_decision', 'bank_basis']);
    expect(decision.note).not.toMatch(/payment release|platform releases money/i);
  });

  it('blocks bank basis when gate, documents or dispute are not ready', () => {
    const decision = p7BuildBankBasis({ dealId: 'deal-1', bankBasisGate: { allowed: false, reason: 'blocked', nextStatus: 'blocked' }, documents: [{ ...docs[0], status: 'missing' }, docs[1], docs[2]], disputeResolved: false, amount: 1000, currency: 'RUB', correlationId: 'corr-1', auditId: 'audit-1' });
    expect(decision.status).toBe('blocked');
    expect(decision.canSendToBank).toBe(false);
    expect(decision.blockerCodes).toEqual(['BANK_BASIS_GATE_BLOCKED', 'MONEY_DOCUMENTS_INCOMPLETE', 'BANK_BASIS_REQUIRED_DOCUMENTS_INCOMPLETE', 'DISPUTE_NOT_RESOLVED']);
  });

  it('builds and validates bank basis payload before send without moving MoneyTree buckets', () => {
    const input = { decision: readyBasis(), moneyTree: bankBasisRequestedTree, actorId: 'operator-1', actorRole: 'operator' as const, organizationId: 'org-operator', createdAt: '2026-05-23T07:50:00.000Z' };
    expect(p7BuildBankBasisPayload(input)).toMatchObject({ dealId: 'deal-1', status: 'ready_for_bank_review', actorId: 'operator-1' });
    expect(p7ValidateBankBasisBeforeSend(input)).toMatchObject({ valid: true, code: 'OK', auditPayload: { action: 'bank_basis_sent', outcome: 'allowed', beforeMoneyTree: bankBasisRequestedTree, afterMoneyTree: bankBasisRequestedTree } });
  });

  it('confirms bank basis only from sent basis and records bank_basis_confirmed operation', () => {
    const result = p7ConfirmBankBasis({ decision: readySentBasis(), moneyTree: bankBasisRequestedTree, confirmation: confirmation('release'), ...noHistory });
    expect(result).toMatchObject({ valid: true, code: 'OK', decision: { status: 'bank_confirmed', bankEventId: 'bank-event-release', confirmationPath: 'release', confirmedByRole: 'bank_officer' }, auditPayload: { action: 'bank_basis_confirmed', outcome: 'allowed' }, moneyResult: { valid: true, code: 'OK' } });
    expect(result.moneyOperation?.type).toBe('bank_basis_confirmed');
    expect(result.moneyTree).toMatchObject({ readyToReleaseAmount: 400, releasedAmount: 400, refundedAmount: 100, status: 'bank_basis_confirmed' });
  });

  it('uses first-class functions for refund, hold, reject and manual-review paths', () => {
    const refund = p7ConfirmBankRefund({ decision: readySentBasis(), moneyTree: bankBasisRequestedTree, confirmation: confirmation('refund', { amount: 200 }), ...noHistory });
    const hold = p7ConfirmBankHold({ decision: readySentBasis(), moneyTree: bankBasisRequestedTree, confirmation: confirmation('hold', { amount: 200 }), ...noHistory });
    const reject = p7RejectBankBasis({ decision: readySentBasis(), moneyTree: bankBasisRequestedTree, confirmation: confirmation('reject', { amount: 0 }), ...noHistory });
    const manualReview = p7StartBankManualReview({ decision: readySentBasis(), moneyTree: bankBasisRequestedTree, confirmation: confirmation('manual_review', { amount: 200 }), ...noHistory });
    expect(refund.moneyOperation?.type).toBe('refund_confirmed');
    expect(hold.moneyOperation?.type).toBe('hold_created');
    expect(reject.moneyOperation?.type).toBe('bank_basis_rejected');
    expect(reject.auditPayload.action).toBe('bank_basis_rejected');
    expect(manualReview.moneyOperation?.type).toBe('manual_review_started');
  });

  it('blocks non-bank actors and duplicate bank events without mutating MoneyTree', () => {
    const denied = p7ConfirmBankBasis({ decision: readySentBasis(), moneyTree: bankBasisRequestedTree, confirmation: confirmation('release', { actorRole: 'arbitrator', actorId: 'arb-1' }), ...noHistory });
    expect(denied).toMatchObject({ valid: false, code: 'BANK_OFFICER_REQUIRED', moneyTree: bankBasisRequestedTree, auditPayload: { action: 'bank_basis_confirmed', outcome: 'denied', actorRole: 'arbitrator' } });
    const first = confirmation('release');
    const duplicate = p7ConfirmBankBasis({ decision: readySentBasis(), moneyTree: bankBasisRequestedTree, confirmation: first, existingBankEventIds: [first.bankEventId], usedIdempotencyKeys: [], existingOperationIds: [] });
    expect(duplicate).toMatchObject({ valid: false, code: 'DUPLICATE_BANK_EVENT', moneyTree: bankBasisRequestedTree, auditPayload: { action: 'bank_basis_confirmed', outcome: 'blocked' } });
  });

  it('builds typed audit payload for bank manual review resolution', () => {
    const afterMoneyTree = { ...bankBasisRequestedTree, readyToReleaseAmount: 800, manualReviewAmount: 0, status: 'reserved' as const };
    const auditPayload = p7BuildBankManualReviewResolvedAuditPayload({ decision: readySentBasis(), actorId: 'bank-1', actorRole: 'bank_officer', organizationId: 'org-bank', auditId: 'audit-manual-review-resolved', correlationId: 'corr-manual-review-resolved', moneyOperationId: 'bank:manual-review-resolved-1', bankEventId: 'bank-event-manual-review-resolved', beforeMoneyTree: bankBasisRequestedTree, afterMoneyTree, createdAt: '2026-05-23T08:30:00.000Z', reason: 'Bank manual review was resolved.' });
    expect(auditPayload).toMatchObject({ action: 'bank_manual_review_resolved', outcome: 'allowed', beforeMoneyTree: bankBasisRequestedTree, afterMoneyTree });
  });
});
