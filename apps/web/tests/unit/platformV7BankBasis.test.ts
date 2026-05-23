import { describe, expect, it } from 'vitest';
import {
  p7BuildBankBasis,
  p7BuildBankManualReviewResolvedAuditPayload,
  p7BuildBankBasisPayload,
  p7ConfirmBankHold,
  p7ConfirmBankRefund,
  p7ConfirmBankRelease,
  p7MarkBankBasisSent,
  p7RejectBankRelease,
  p7StartBankManualReview,
  p7ValidateBankBasisBeforeSend,
  type P7BankConfirmationEvent,
  type P7BankConfirmationOperationType,
  type P7BankConfirmationPath,
} from '@/lib/platform-v7/bank-basis';
import { buildPlatformV7IdempotencyKey } from '@/lib/platform-v7/idempotency-key-helper';
import type { PlatformV7MoneyTree, PlatformV7ReleaseGateDecision } from '@/lib/platform-v7/money-tree';
import type { PlatformV7DocumentRequirement, PlatformV7DocumentSource, PlatformV7DocumentStatus } from '@/lib/platform-v7/document-matrix';
import type { PlatformV7CanonicalRole } from '@/lib/platform-v7/role-canonical';

const releaseGate: PlatformV7ReleaseGateDecision = {
  allowed: true,
  reason: 'ready',
  nextStatus: 'release_requested',
};

const operationTypeByPath: Record<P7BankConfirmationPath, P7BankConfirmationOperationType> = {
  release: 'release_confirmed',
  refund: 'refund_confirmed',
  hold: 'hold_created',
  reject: 'release_failed',
  manual_review: 'manual_review_started',
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

function readyBasis() {
  return p7BuildBankBasis({
    dealId: 'deal-1',
    releaseGate,
    documents: docs,
    disputeResolved: true,
    amount: 300,
    currency: 'RUB',
    correlationId: 'corr-1',
    auditId: 'audit-1',
  });
}

function readySentBasis() {
  return p7MarkBankBasisSent({
    decision: readyBasis(),
    moneyTree: releaseRequestedTree,
    actorId: 'operator-1',
    actorRole: 'operator',
    organizationId: 'org-operator',
    createdAt: '2026-05-23T07:50:00.000Z',
  }).decision;
}

function confirmation<Path extends P7BankConfirmationPath>(
  path: Path,
  overrides: Partial<P7BankConfirmationEvent<Path>> = {},
): P7BankConfirmationEvent<Path> {
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
    operationType: operationTypeByPath[path] as P7BankConfirmationOperationType<Path>,
    amount,
    actorId: overrides.actorId ?? 'bank-1',
    actorRole: overrides.actorRole ?? 'bank_officer',
    organizationId: overrides.organizationId ?? 'org-bank',
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

  it('builds and validates bank basis payload before send', () => {
    const input = {
      decision: readyBasis(),
      moneyTree: releaseRequestedTree,
      actorId: 'operator-1',
      actorRole: 'operator' as const,
      organizationId: 'org-operator',
      createdAt: '2026-05-23T07:50:00.000Z',
    };

    expect(p7BuildBankBasisPayload(input)).toMatchObject({
      dealId: 'deal-1',
      status: 'ready_for_bank_review',
      actorId: 'operator-1',
      organizationId: 'org-operator',
    });
    expect(p7ValidateBankBasisBeforeSend(input)).toMatchObject({
      valid: true,
      code: 'OK',
      auditPayload: {
        action: 'bank_basis_sent',
        outcome: 'allowed',
        beforeMoneyTree: releaseRequestedTree,
        afterMoneyTree: releaseRequestedTree,
        moneyOperationId: 'bank_basis:deal-1:audit-1',
        bankEventId: null,
      },
    });
    expect(p7ValidateBankBasisBeforeSend(input).auditPayloads.map((payload) => payload.action)).toEqual([
      'bank_basis_sent',
      'arbitration_decision_used_as_basis',
    ]);
  });

  it('marks ready basis as sent without moving MoneyTree buckets', () => {
    const result = p7MarkBankBasisSent({
      decision: readyBasis(),
      moneyTree: releaseRequestedTree,
      actorId: 'operator-1',
      actorRole: 'operator',
      organizationId: 'org-operator',
      createdAt: '2026-05-23T07:50:00.000Z',
    });

    expect(result.decision.status).toBe('sent_to_bank');
    expect(result.decision.canSendToBank).toBe(false);
    expect(result.auditPayload.action).toBe('bank_basis_sent');
    expect(result.auditPayload.beforeMoneyTree).toBe(releaseRequestedTree);
    expect(result.auditPayload.afterMoneyTree).toBe(releaseRequestedTree);
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
      auditPayload: {
        action: 'bank_release_confirmed',
        outcome: 'allowed',
        bankEventId: 'bank-event-release',
        actorRole: 'bank_officer',
        organizationId: 'org-bank',
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

  it('uses explicit first-class functions for refund, hold, reject and manual-review paths', () => {
    const refund = p7ConfirmBankRefund({
      decision: readySentBasis(),
      moneyTree: releaseRequestedTree,
      confirmation: confirmation('refund', { amount: 200 }),
    });
    const hold = p7ConfirmBankHold({
      decision: readySentBasis(),
      moneyTree: releaseRequestedTree,
      confirmation: confirmation('hold', { amount: 200 }),
    });
    const reject = p7RejectBankRelease({
      decision: readySentBasis(),
      moneyTree: releaseRequestedTree,
      confirmation: confirmation('reject', { amount: 0 }),
    });
    const manualReview = p7StartBankManualReview({
      decision: readySentBasis(),
      moneyTree: releaseRequestedTree,
      confirmation: confirmation('manual_review', { amount: 200 }),
    });

    expect(refund.moneyOperation?.type).toBe('refund_confirmed');
    expect(refund.moneyTree).toMatchObject({ refundedAmount: 300, releasedAmount: 100, status: 'refunded' });
    expect(refund.auditPayload.action).toBe('bank_refund_confirmed');

    expect(hold.moneyOperation?.type).toBe('hold_created');
    expect(hold.moneyTree).toMatchObject({ heldAmount: 300, releasedAmount: 100, status: 'hold_created' });
    expect(hold.auditPayload.action).toBe('bank_hold_confirmed');

    expect(reject.moneyOperation?.type).toBe('release_failed');
    expect(reject.moneyTree).toMatchObject({ releasedAmount: 100, refundedAmount: 100, status: 'release_failed' });
    expect(reject.decision.status).toBe('bank_rejected');
    expect(reject.auditPayload.action).toBe('bank_release_rejected');

    expect(manualReview.moneyOperation?.type).toBe('manual_review_started');
    expect(manualReview.moneyTree).toMatchObject({ manualReviewAmount: 200, releasedAmount: 100, status: 'manual_review' });
    expect(manualReview.auditPayload.action).toBe('bank_manual_review_started');
  });

  it('builds typed audit payload for bank manual review resolution', () => {
    const afterMoneyTree = {
      ...releaseRequestedTree,
      readyToReleaseAmount: 800,
      manualReviewAmount: 0,
      status: 'reserved' as const,
    };
    const auditPayload = p7BuildBankManualReviewResolvedAuditPayload({
      decision: readySentBasis(),
      actorId: 'bank-1',
      actorRole: 'bank_officer',
      organizationId: 'org-bank',
      auditId: 'audit-manual-review-resolved',
      correlationId: 'corr-manual-review-resolved',
      moneyOperationId: 'bank:manual-review-resolved-1',
      bankEventId: 'bank-event-manual-review-resolved',
      beforeMoneyTree: releaseRequestedTree,
      afterMoneyTree,
      createdAt: '2026-05-23T08:30:00.000Z',
      reason: 'Bank manual review was resolved.',
    });

    expect(auditPayload).toMatchObject({
      action: 'bank_manual_review_resolved',
      outcome: 'allowed',
      actorRole: 'bank_officer',
      beforeMoneyTree: releaseRequestedTree,
      afterMoneyTree,
      bankEventId: 'bank-event-manual-review-resolved',
    });
  });

  it('blocks bank confirmation before basis is sent with blocked audit payload', () => {
    const result = p7ConfirmBankRelease({
      decision: readyBasis(),
      moneyTree: releaseRequestedTree,
      confirmation: confirmation('release'),
    });

    expect(result).toMatchObject({
      valid: false,
      code: 'CANNOT_CONFIRM_UNSENT_BASIS',
      decision: { status: 'manual_review' },
      moneyTree: releaseRequestedTree,
      auditPayload: {
        action: 'bank_release_confirmed',
        outcome: 'blocked',
        beforeMoneyTree: releaseRequestedTree,
        afterMoneyTree: releaseRequestedTree,
      },
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
      auditPayload: {
        action: 'bank_release_confirmed',
        outcome: 'denied',
        actorRole: 'arbitrator',
      },
    });
  });

  it.each([
    'seller',
    'buyer',
    'operator',
    'arbitrator',
    'support_agent',
    'executive_viewer',
  ] as const)('denies %s bank movement confirmation without mutating MoneyTree', (actorRole) => {
    const result = p7ConfirmBankRelease({
      decision: readySentBasis(),
      moneyTree: releaseRequestedTree,
      confirmation: confirmation('release', { actorRole, actorId: `${actorRole}-1` }),
    });

    expect(result.valid).toBe(false);
    expect(result.code).toBe('BANK_OFFICER_REQUIRED');
    expect(result.moneyTree).toBe(releaseRequestedTree);
    expect(result.moneyTree.releasedAmount).toBe(releaseRequestedTree.releasedAmount);
    expect(result.moneyTree.refundedAmount).toBe(releaseRequestedTree.refundedAmount);
    expect(result.auditPayload).toMatchObject({
      action: 'bank_release_confirmed',
      outcome: 'denied',
      actorRole,
      beforeMoneyTree: releaseRequestedTree,
      afterMoneyTree: releaseRequestedTree,
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
      auditPayload: {
        action: 'bank_release_confirmed',
        outcome: 'blocked',
        beforeMoneyTree: releaseRequestedTree,
        afterMoneyTree: releaseRequestedTree,
      },
    });
    expect(duplicateIdempotency).toMatchObject({
      valid: false,
      code: 'DUPLICATE_IDEMPOTENCY_KEY',
      moneyTree: releaseRequestedTree,
      auditPayload: {
        action: 'bank_release_confirmed',
        outcome: 'blocked',
        beforeMoneyTree: releaseRequestedTree,
        afterMoneyTree: releaseRequestedTree,
      },
    });
  });

  it('keeps forbidden maturity and payment claims out of bank basis runtime notes', () => {
    const text = [
      readyBasis().note,
      p7ConfirmBankRelease({
        decision: readySentBasis(),
        moneyTree: releaseRequestedTree,
        confirmation: confirmation('release'),
      }).reason,
    ].join(' ');

    expect(text).not.toMatch(/production-ready|fully live|fully integrated|платформа гарантирует оплату|платформа сама выпускает деньги/i);
  });
});
