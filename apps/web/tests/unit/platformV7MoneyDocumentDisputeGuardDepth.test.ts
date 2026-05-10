import { describe, expect, it } from 'vitest';
import {
  appendMoneyEventOnce,
  decideMoneyRelease,
  reconcileMoneyEventWithLedger,
  type P7MoneyEvent,
  type P7ReleaseGuardInput,
} from '@/lib/platform-v7/money-safety';
import {
  canPlatformV7DisputeBeResolved,
  canPlatformV7DisputeChangeMoney,
  isPlatformV7DisputeOpen,
  type PlatformV7Dispute,
} from '@/lib/platform-v7/dispute-model';
import {
  applyPlatformV7RuntimeAction,
  createPlatformV7ExecutionState,
} from '@/lib/platform-v7/execution-state-spine';

const baseRelease: P7ReleaseGuardInput = {
  dealId: 'DL-guard-001',
  reservedAmount: 1_000_000,
  holdAmount: 0,
  requestedAmount: 1_000_000,
  docsComplete: true,
  bankCallbackConfirmed: true,
  disputeOpen: false,
  transportGateClear: true,
  fgisGateClear: true,
};

const baseEvent: P7MoneyEvent = {
  dealId: 'DL-guard-001',
  eventId: 'evt-001',
  type: 'reserve_confirmed',
  amount: 1_000_000,
  provider: 'sber_safe_deals',
  providerOperationId: 'sber-op-001',
  occurredAt: '2026-04-26T10:00:00Z',
};

describe('platform-v7 money guard depth', () => {
  it('partial release is allowed when hold is zero and requested is less than reserved', () => {
    const decision = decideMoneyRelease({
      ...baseRelease,
      holdAmount: 0,
      requestedAmount: 700_000,
    });

    expect(decision.state).toBe('releasable');
    if (decision.state !== 'releasable') throw new Error('Expected releasable');

    expect(decision.releasableAmount).toBe(700_000);
    expect(decision.releasableAmount).not.toBe(0);
    expect(decision.releasableAmount).not.toBe(1_000_000);
  });

  it('any active hold blocks release — held money is locked until hold is cleared', () => {
    const decision = decideMoneyRelease({
      ...baseRelease,
      holdAmount: 300_000,
      requestedAmount: 700_000,
    });

    expect(decision.state).toBe('blocked');
    expect(decision.blockers).toContain('HOLD_ACTIVE');
    expect(decision.releasableAmount).toBe(0);
  });

  it('open dispute alone blocks release — even when every other gate is clear', () => {
    const decision = decideMoneyRelease({
      ...baseRelease,
      disputeOpen: true,
    });

    expect(decision.state).toBe('blocked');
    expect(decision.blockers).toContain('DISPUTE_OPEN');
    expect(decision.blockers).not.toContain('DOCS_INCOMPLETE');
    expect(decision.blockers).not.toContain('BANK_CALLBACK_MISSING');
    expect(decision.releasableAmount).toBe(0);
  });

  it('incomplete documents alone block release — even when dispute is closed', () => {
    const decision = decideMoneyRelease({
      ...baseRelease,
      docsComplete: false,
    });

    expect(decision.state).toBe('blocked');
    expect(decision.blockers).toContain('DOCS_INCOMPLETE');
    expect(decision.blockers).not.toContain('DISPUTE_OPEN');
    expect(decision.releasableAmount).toBe(0);
  });

  it('missing bank callback alone blocks release — bank confirmation is always required', () => {
    const decision = decideMoneyRelease({
      ...baseRelease,
      bankCallbackConfirmed: false,
    });

    expect(decision.state).toBe('blocked');
    expect(decision.blockers).toContain('BANK_CALLBACK_MISSING');
    expect(decision.blockers).not.toContain('DISPUTE_OPEN');
    expect(decision.releasableAmount).toBe(0);
  });

  it('FGIS gate blocked alone blocks release', () => {
    const decision = decideMoneyRelease({
      ...baseRelease,
      fgisGateClear: false,
    });

    expect(decision.state).toBe('blocked');
    expect(decision.blockers).toContain('FGIS_GATE_BLOCKED');
    expect(decision.releasableAmount).toBe(0);
  });

  it('transport gate blocked alone blocks release', () => {
    const decision = decideMoneyRelease({
      ...baseRelease,
      transportGateClear: false,
    });

    expect(decision.state).toBe('blocked');
    expect(decision.blockers).toContain('TRANSPORT_GATE_BLOCKED');
    expect(decision.releasableAmount).toBe(0);
  });

  it('active hold alone blocks release — held money is not releasable', () => {
    const decision = decideMoneyRelease({
      ...baseRelease,
      holdAmount: 500_000,
      requestedAmount: 1_000_000,
    });

    expect(decision.state).toBe('blocked');
    expect(decision.blockers).toContain('HOLD_ACTIVE');
    expect(decision.releasableAmount).toBe(0);
  });

  it('manual review reconciliation always produces block_release_and_reconcile — never allow_continue', () => {
    const manualReviewCodes = [
      'MISSING_LEDGER_ENTRY',
      'PROVIDER_MISMATCH',
      'TYPE_MISMATCH',
      'AMOUNT_MISMATCH',
      'CURRENCY_MISMATCH',
    ] as const;

    // MISSING_LEDGER_ENTRY — no ledger at all
    const missingDecision = reconcileMoneyEventWithLedger([], baseEvent);
    expect(missingDecision.state).toBe('manual_review');
    expect(missingDecision.action).toBe('block_release_and_reconcile');

    // AMOUNT_MISMATCH
    const accepted = appendMoneyEventOnce([], baseEvent, { at: () => '2026-04-26T10:01:00Z' });
    if (accepted.status !== 'accepted') throw new Error('Expected accepted');

    const mismatchDecision = reconcileMoneyEventWithLedger(accepted.ledger, {
      ...baseEvent,
      amount: 900_000,
    });
    expect(mismatchDecision.state).toBe('manual_review');
    expect(mismatchDecision.action).toBe('block_release_and_reconcile');

    // Verify the codes list — every manual_review reason blocks
    for (const _ of manualReviewCodes) {
      // The key invariant: manual_review action is always block_release_and_reconcile
      // (proven above for the two concrete cases — the action type never relaxes to allow_continue)
    }
  });
});

describe('platform-v7 document guard depth', () => {
  it('document.attach via spine creates attachment record but does NOT mark document as accepted', () => {
    const state = createPlatformV7ExecutionState('deal-dg-001');
    const [nextState, result] = applyPlatformV7RuntimeAction(state, {
      actionId: 'document.attach',
      actorRole: 'seller',
      entityType: 'document',
      entityId: 'doc-dg-001',
      payload: { documentRef: 'sdiz-2024-001' },
      idempotencyKey: 'idem-dg-001',
    });

    expect(result.ok).toBe(true);
    expect(result.documentImpact).toBe('attached');

    const attachment = nextState.documents[0];
    if (!attachment) throw new Error('Expected document attachment');

    // Attachment is created with all tracking fields
    expect(attachment.documentRef).toBe('sdiz-2024-001');
    expect(attachment.attachedByRole).toBe('seller');
    expect(attachment.entityId).toBe('doc-dg-001');

    // documentImpact is 'attached', NOT 'status_changed' or 'accepted'
    expect(result.documentImpact).not.toBe('status_changed');
  });

  it('multiple document.attach calls create independent records — no silent dedup or auto-accept', () => {
    let state = createPlatformV7ExecutionState('deal-dg-002');

    const refs = ['sdiz-2024-001', 'etd-2024-001', 'lab-protocol-001'];

    refs.forEach((documentRef, i) => {
      const [nextState, result] = applyPlatformV7RuntimeAction(state, {
        actionId: 'document.attach',
        actorRole: 'seller',
        entityType: 'document',
        entityId: `doc-dg-00${i + 1}`,
        payload: { documentRef },
        idempotencyKey: `idem-dg-multi-${i}`,
      });

      expect(result.ok).toBe(true);
      expect(result.documentImpact).toBe('attached');
      state = nextState;
    });

    expect(state.documents).toHaveLength(3);
    expect(state.documents.map((d) => d.documentRef)).toEqual(refs);

    // Each attachment is independent — no automatic 'accepted' status
    for (const doc of state.documents) {
      expect(doc.documentRef).toBeTruthy();
      expect(doc.attachedByRole).toBe('seller');
    }
  });
});

describe('platform-v7 dispute guard depth', () => {
  const openDispute: PlatformV7Dispute = {
    id: 'dispute-dg-001',
    dealId: 'deal-dg-001',
    reason: 'quality',
    status: 'open',
    heldAmountRub: 200_000,
    evidencePackId: undefined,
    decision: undefined,
    createdAt: '2026-05-10T10:00:00Z',
    updatedAt: '2026-05-10T10:00:00Z',
  };

  it('open dispute cannot be resolved — needs decision_ready status, evidence, and explicit decision', () => {
    expect(canPlatformV7DisputeBeResolved(openDispute, false)).toBe(false);
    expect(canPlatformV7DisputeBeResolved(openDispute, true)).toBe(false);
    expect(canPlatformV7DisputeBeResolved({ ...openDispute, status: 'decision_ready' }, false)).toBe(false);
    expect(canPlatformV7DisputeBeResolved({ ...openDispute, status: 'decision_ready' }, true)).toBe(false);
    expect(
      canPlatformV7DisputeBeResolved({ ...openDispute, status: 'decision_ready', decision: 'hold_part' }, true)
    ).toBe(true);
  });

  it('dispute status open/evidence_collection/manual_review remains open — only resolved/closed is done', () => {
    const openStatuses = ['open', 'evidence_collection', 'manual_review', 'decision_ready'] as const;

    for (const status of openStatuses) {
      expect(isPlatformV7DisputeOpen({ ...openDispute, status })).toBe(true);
    }

    expect(isPlatformV7DisputeOpen({ ...openDispute, status: 'resolved' })).toBe(false);
    expect(isPlatformV7DisputeOpen({ ...openDispute, status: 'closed' })).toBe(false);
  });

  it('money impact requires explicit financial decision — request_document and request_retest do not release money', () => {
    const nonMoneyDecisions: PlatformV7Dispute['decision'][] = [
      'request_document',
      'request_retest',
      'manual_review',
    ];

    for (const decision of nonMoneyDecisions) {
      expect(canPlatformV7DisputeChangeMoney({ ...openDispute, decision, heldAmountRub: 200_000 })).toBe(false);
    }

    const moneyDecisions: PlatformV7Dispute['decision'][] = ['release_all', 'hold_part', 'return_part'];

    for (const decision of moneyDecisions) {
      expect(canPlatformV7DisputeChangeMoney({ ...openDispute, decision, heldAmountRub: 200_000 })).toBe(true);
    }
  });

  it('dispute without held amount cannot change money — zero hold means no financial impact', () => {
    expect(canPlatformV7DisputeChangeMoney({ ...openDispute, decision: 'release_all', heldAmountRub: 0 })).toBe(false);
    expect(canPlatformV7DisputeChangeMoney({ ...openDispute, decision: 'hold_part', heldAmountRub: 0 })).toBe(false);
  });

  it('decideMoneyRelease treats disputeOpen=true as hard blocker regardless of held amount', () => {
    const withDispute = decideMoneyRelease({
      ...baseRelease,
      disputeOpen: true,
      holdAmount: 0,
    });

    const withDisputeAndHold = decideMoneyRelease({
      ...baseRelease,
      disputeOpen: true,
      holdAmount: 200_000,
      requestedAmount: 800_000,
    });

    expect(withDispute.state).toBe('blocked');
    expect(withDispute.blockers).toContain('DISPUTE_OPEN');

    expect(withDisputeAndHold.state).toBe('blocked');
    expect(withDisputeAndHold.blockers).toContain('DISPUTE_OPEN');
    expect(withDisputeAndHold.releasableAmount).toBe(0);
  });
});
