import { describe, expect, it } from 'vitest';
import { p7BuildBankBasis, p7ConfirmBankRelease, p7MarkBankBasisSent, type P7BankConfirmationEvent, type P7BankConfirmationPath } from '@/lib/platform-v7/bank-basis';
import { buildPlatformV7IdempotencyKey } from '@/lib/platform-v7/idempotency-key-helper';
import type { PlatformV7MoneyTree, PlatformV7ReleaseGateDecision } from '@/lib/platform-v7/money-tree';
import type { PlatformV7DocumentRequirement, PlatformV7DocumentSource, PlatformV7DocumentStatus } from '@/lib/platform-v7/document-matrix';
import type { PlatformV7CanonicalRole } from '@/lib/platform-v7/role-canonical';

const releaseGate: PlatformV7ReleaseGateDecision = {
  allowed: true,
  reason: 'ready',
  nextStatus: 'release_requested',
};

function doc(
  documentId: string,
  title: string,
  ownerRole: PlatformV7CanonicalRole,
  status: PlatformV7DocumentStatus,
  source: PlatformV7DocumentSource,
): PlatformV7DocumentRequirement {
  return {
    documentId,
    dealId: 'deal-1',
    type: documentId,
    title,
    ownerRole,
    responsibleRole: ownerRole,
    status,
    blockStages: ['release'],
    affectsMoney: true,
    source,
    deadline: null,
    signatureStatus: 'not_required',
    nextAction: 'ok',
    createdAt: '',
    updatedAt: '',
  };
}

const docs: PlatformV7DocumentRequirement[] = [
  doc('contract', 'Договор', 'seller', 'confirmed', 'edo'),
  doc('sdiz', 'СДИЗ', 'seller', 'confirmed', 'fgis'),
  doc('acceptance_act', 'Акт', 'elevator_operator', 'signed', 'elevator'),
  doc('lab_protocol', 'Лаборатория', 'lab_specialist', 'confirmed', 'lab'),
  doc('arbitration_decision', 'Арбитраж', 'arbitrator', 'conditional', 'arbitration'),
  doc('bank_basis', 'Банк', 'operator', 'confirmed', 'bank'),
];

const releaseRequestedTree: PlatformV7MoneyTree = {
  dealId: 'deal-1',
  currency: 'RUB',
  totalDealAmount: 1000,
  reservedAmount: 1000,
  readyToReleaseAmount: 700,
  heldAmount: 100,
  manualReviewAmount: 0,
  releasedAmount: 100,
  refundedAmount: 100,
  platformFee: 10,
  bankFee: 5,
  status: 'release_requested',
};

function readySentBasis() {
  const ready = p7BuildBankBasis({
    dealId: 'deal-1',
    releaseGate,
    documents: docs,
    disputeResolved: true,
    amount: 300,
    currency: 'RUB',
    correlationId: 'corr-1',
    auditId: 'audit-1',
  });

  return p7MarkBankBasisSent(ready);
}

function confirmation(path: P7BankConfirmationPath, overrides: Partial<P7BankConfirmationEvent> = {}): P7BankConfirmationEvent {
  const amount = overrides.amount ?? (path === 'reject' ? 0 : 300);
  const bankEventId = overrides.bankEventId ?? `bank-event-${path}`;

  return {
    bankEventId,
    idempotencyKey: overrides.idempotencyKey ?? buildPlatformV7IdempotencyKey({
      boundaryId: 'confirm_money_released',
      actorId: overrides.actorId ?? 'bank-1',
      entityId: 'money-1',
      dealId: 'deal-1',
      amountMinor: amount,
      currency: 'RUB',
      attemptId: bankEventId,
    }),
    path,
    amount,
    actorId: overrides.actorId ?? 'bank-1',
    actorRole: overrides.actorRole ?? 'bank_officer',
    bankReference: overrides.bankReference ?? `BR-${path}`,
    confirmedAt: overrides.confirmedAt ?? '2026-05-23T08:00:00.000Z',
    auditId: overrides.auditId ?? 'audit-bank-1',
    correlationId: overrides.correlationId ?? 'corr-bank-1',
  };
}

describe('platform-v7 bank basis foundation', () => {
  it('builds ready bank basis only from satisfied release and document conditions', () => {
    const decision = p7BuildBankBasis({
      dealId: 'deal-1',
      releaseGate,
      documents: docs,
      disputeResolved: true,
      amount: 1000,
      currency: 'RUB',
      correlationId: 'corr-1',
      auditId: 'audit-1',
    });

    expect(decision.status).toBe('ready_for_bank_review');
    expect(decision.canSendToBank).toBe(true);
    expect(decision.blockerCodes).toEqual([]);
    expect(decision.basisDocumentIds).toEqual(['contract', 'sdiz', 'acceptance_act', 'lab_protocol', 'arbitration_decision', 'bank_basis']);
    expect(decision.note).toContain('does not confirm payment release');
  });

  it('blocks bank basis when release gate, documents or dispute are not ready', () => {
    const decision = p7BuildBankBasis({
      dealId: 'deal-1',
      releaseGate: { allowed: false, reason: 'blocked', nextStatus: 'blocked' },
      documents: [{ ...docs[0], status: 'missing' }, docs[1], docs[2]],
      disputeResolved: false,
      amount: 1000,
      currency: 'RUB',
      correlationId: 'corr-1',
      auditId: 'audit-1',
    });

    expect(decision.status).toBe('blocked');
    expect(decision.canSendToBank).toBe(false);
    expect(decision.blockerCodes).toEqual(['RELEASE_GATE_BLOCKED', 'MONEY_DOCUMENTS_INCOMPLETE', 'BANK_BASIS_REQUIRED_DOCUMENTS_INCOMPLETE', 'DISPUTE_NOT_RESOLVED']);
  });

  it('requires amount and trace ids', () => {
    const decision = p7BuildBankBasis({
      dealId: 'deal-1',
      releaseGate,
      documents: docs,
      disputeResolved: true,
      amount: 0,
      currency: 'RUB',
      correlationId: '',
      auditId: '',
    });

    expect(decision.blockerCodes).toContain('INVALID_AMOUNT');
    expect(decision.blockerCodes).toContain('TRACE_REQUIRED');
  });

  it('marks ready basis as sent without claiming bank confirmation', () => {
    const ready = p7BuildBankBasis({
      dealId: 'deal-1',
      releaseGate,
      documents: docs,
      disputeResolved: true,
      amount: 1000,
      currency: 'RUB',
      correlationId: 'corr-1',
      auditId: 'audit-1',
    });

    expect(p7MarkBankBasisSent(ready).status).toBe('sent_to_bank');
    expect(p7MarkBankBasisSent(ready).canSendToBank).toBe(false);
  });

  it('keeps sent_to_bank separate from bank_confirmed until a bank event arrives', () => {
    const sent = readySentBasis();

    expect(sent.status).toBe('sent_to_bank');
    expect(sent.canSendToBank).toBe(false);
    expect(sent.bankEventId).toBeUndefined();
  });

  it('confirms release only from sent basis and moves MoneyTree through release_confirmed', () => {
    const result = p7ConfirmBankRelease({
      decision: readySentBasis(),
      moneyTree: releaseRequestedTree,
      confirmation: confirmation('release'),
    });

    expect(result).toMatchObject({
      valid: true,
      code: 'OK',
      decision: {
        status: 'bank_confirmed',
        bankEventId: 'bank-event-release',
        confirmationPath: 'release',
        confirmedByRole: 'bank_officer',
      },
      moneyResult: {
        valid: true,
        code: 'OK',
      },
    });
    expect(result.moneyOperation?.type).toBe('release_confirmed');
    expect(result.moneyTree).toMatchObject({
      readyToReleaseAmount: 400,
      releasedAmount: 400,
      refundedAmount: 100,
      status: 'released',
    });
  });

  it.each([
    ['refund', 'refund_confirmed', 'refunded'],
    ['hold', 'hold_created', 'hold_created'],
    ['reject', 'release_failed', 'release_failed'],
    ['manual_review', 'manual_review_started', 'manual_review'],
  ] as const)('applies %s bank confirmation path through MoneyTree %s', (path, operationType, moneyStatus) => {
    const result = p7ConfirmBankRelease({
      decision: readySentBasis(),
      moneyTree: releaseRequestedTree,
      confirmation: confirmation(path, { amount: path === 'reject' ? 0 : 200 }),
    });

    expect(result.valid).toBe(true);
    expect(result.moneyOperation?.type).toBe(operationType);
    expect(result.moneyTree.status).toBe(moneyStatus);
    expect(result.decision.status).toBe(path === 'reject' ? 'bank_rejected' : path === 'manual_review' ? 'manual_review' : 'bank_confirmed');
  });

  it('blocks bank confirmation before basis is sent', () => {
    const result = p7ConfirmBankRelease({
      decision: p7BuildBankBasis({
        dealId: 'deal-1',
        releaseGate,
        documents: docs,
        disputeResolved: true,
        amount: 300,
        currency: 'RUB',
        correlationId: 'corr-1',
        auditId: 'audit-1',
      }),
      moneyTree: releaseRequestedTree,
      confirmation: confirmation('release'),
    });

    expect(result).toMatchObject({
      valid: false,
      code: 'CANNOT_CONFIRM_UNSENT_BASIS',
      decision: { status: 'manual_review' },
      moneyTree: releaseRequestedTree,
    });
  });

  it('allows arbitration decision as basis evidence but blocks arbitrator from moving money', () => {
    const sent = readySentBasis();

    expect(sent.basisDocumentIds).toContain('arbitration_decision');

    const result = p7ConfirmBankRelease({
      decision: sent,
      moneyTree: releaseRequestedTree,
      confirmation: confirmation('release', { actorRole: 'arbitrator', actorId: 'arb-1' }),
    });

    expect(result).toMatchObject({
      valid: false,
      code: 'BANK_OFFICER_REQUIRED',
      decision: { status: 'manual_review' },
      moneyTree: releaseRequestedTree,
    });
  });

  it('does not move money twice for duplicate bankEventId or idempotencyKey', () => {
    const sent = readySentBasis();
    const first = confirmation('release');

    const duplicateEvent = p7ConfirmBankRelease({
      decision: sent,
      moneyTree: releaseRequestedTree,
      confirmation: first,
      existingBankEventIds: [first.bankEventId],
    });
    const duplicateIdempotency = p7ConfirmBankRelease({
      decision: sent,
      moneyTree: releaseRequestedTree,
      confirmation: first,
      usedIdempotencyKeys: [first.idempotencyKey],
    });

    expect(duplicateEvent).toMatchObject({
      valid: false,
      code: 'DUPLICATE_BANK_EVENT',
      moneyTree: releaseRequestedTree,
    });
    expect(duplicateIdempotency).toMatchObject({
      valid: false,
      code: 'DUPLICATE_IDEMPOTENCY_KEY',
      moneyTree: releaseRequestedTree,
    });
  });
});
