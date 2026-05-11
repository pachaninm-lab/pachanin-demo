import { describe, expect, it } from 'vitest';
import {
  appendMoneyEventOnce,
  decideMoneyRelease,
  reconcileMoneyEventWithLedger,
  type P7MoneyEvent,
} from '@/lib/platform-v7/money-safety';
import {
  canPlatformV7DisputeBeResolved,
  canPlatformV7DisputeChangeMoney,
  isPlatformV7DisputeOpen,
  type PlatformV7Dispute,
  type PlatformV7DisputeStatus,
} from '@/lib/platform-v7/dispute-model';
import {
  applyPlatformV7RuntimeAction,
  createPlatformV7ExecutionState,
  type PlatformV7RuntimeActionCommand,
} from '@/lib/platform-v7/execution-state-spine';

const baseMoneyEvent: P7MoneyEvent = {
  dealId: 'deal-001',
  eventId: 'evt-001',
  type: 'reserve_confirmed',
  amount: 1_000_000,
  currency: 'RUB',
  provider: 'manual_bank',
  providerOperationId: 'bank-op-001',
  occurredAt: '2026-05-11T00:00:00.000Z',
  payloadHash: 'hash-001',
};

function makeDispute(overrides: Partial<PlatformV7Dispute> = {}): PlatformV7Dispute {
  return {
    id: 'dispute-001',
    dealId: 'deal-001',
    reason: 'quality',
    status: 'decision_ready',
    heldAmountRub: 250_000,
    evidencePackId: 'evidence-001',
    decision: 'hold_part',
    createdAt: '2026-05-11T00:00:00.000Z',
    updatedAt: '2026-05-11T00:00:00.000Z',
    ...overrides,
  };
}

function makeCommand(overrides: Partial<PlatformV7RuntimeActionCommand>): PlatformV7RuntimeActionCommand {
  return {
    actionId: 'document.attach',
    actorRole: 'seller',
    entityType: 'document',
    entityId: 'doc-001',
    idempotencyKey: 'idem-doc-001',
    ...overrides,
  };
}

describe('platform-v7 money, document and dispute guard depth', () => {
  it('allows partial release only when all gates are clear and no hold is active', () => {
    expect(decideMoneyRelease({
      dealId: 'deal-001',
      reservedAmount: 1_000_000,
      holdAmount: 0,
      requestedAmount: 400_000,
      docsComplete: true,
      bankCallbackConfirmed: true,
      disputeOpen: false,
      transportGateClear: true,
      fgisGateClear: true,
      releaseRequestId: 'rel-001',
    })).toMatchObject({
      state: 'releasable',
      reasonCode: 'READY_FOR_RELEASE',
      blockers: [],
      releasableAmount: 400_000,
    });
  });

  it('keeps any active hold as a hard money release blocker', () => {
    expect(decideMoneyRelease({
      dealId: 'deal-001',
      reservedAmount: 1_000_000,
      holdAmount: 1,
      requestedAmount: 400_000,
      docsComplete: true,
      bankCallbackConfirmed: true,
      disputeOpen: false,
      transportGateClear: true,
      fgisGateClear: true,
    })).toMatchObject({
      state: 'blocked',
      reasonCode: 'HOLD_ACTIVE',
      blockers: ['HOLD_ACTIVE'],
      releasableAmount: 0,
    });
  });

  it('blocks release on an open dispute even when every other gate is clear', () => {
    expect(decideMoneyRelease({
      dealId: 'deal-001',
      reservedAmount: 1_000_000,
      holdAmount: 0,
      requestedAmount: 400_000,
      docsComplete: true,
      bankCallbackConfirmed: true,
      disputeOpen: true,
      transportGateClear: true,
      fgisGateClear: true,
    })).toMatchObject({
      state: 'blocked',
      reasonCode: 'DISPUTE_OPEN',
      blockers: ['DISPUTE_OPEN'],
    });
  });

  it('keeps each external release gate independently blocking', () => {
    expect(decideMoneyRelease({ dealId: 'deal-001', reservedAmount: 1_000_000, holdAmount: 0, requestedAmount: 400_000, docsComplete: false, bankCallbackConfirmed: true, disputeOpen: false, transportGateClear: true, fgisGateClear: true }).blockers).toContain('DOCS_INCOMPLETE');
    expect(decideMoneyRelease({ dealId: 'deal-001', reservedAmount: 1_000_000, holdAmount: 0, requestedAmount: 400_000, docsComplete: true, bankCallbackConfirmed: false, disputeOpen: false, transportGateClear: true, fgisGateClear: true }).blockers).toContain('BANK_CALLBACK_MISSING');
    expect(decideMoneyRelease({ dealId: 'deal-001', reservedAmount: 1_000_000, holdAmount: 0, requestedAmount: 400_000, docsComplete: true, bankCallbackConfirmed: true, disputeOpen: false, transportGateClear: false, fgisGateClear: true }).blockers).toContain('TRANSPORT_GATE_BLOCKED');
    expect(decideMoneyRelease({ dealId: 'deal-001', reservedAmount: 1_000_000, holdAmount: 0, requestedAmount: 400_000, docsComplete: true, bankCallbackConfirmed: true, disputeOpen: false, transportGateClear: true, fgisGateClear: false }).blockers).toContain('FGIS_GATE_BLOCKED');
  });

  it('keeps manual reconciliation from allowing continuation', () => {
    expect(reconcileMoneyEventWithLedger([], baseMoneyEvent)).toMatchObject({
      state: 'manual_review',
      reasonCode: 'MISSING_LEDGER_ENTRY',
      action: 'block_release_and_reconcile',
    });

    const accepted = appendMoneyEventOnce([], baseMoneyEvent, { at: () => '2026-05-11T00:01:00.000Z' });
    expect(accepted.status).toBe('accepted');

    if (accepted.status !== 'accepted') throw new Error('Expected money event to be accepted');

    expect(reconcileMoneyEventWithLedger(accepted.ledger, { ...baseMoneyEvent, amount: 999_999 })).toMatchObject({
      state: 'manual_review',
      reasonCode: 'AMOUNT_MISMATCH',
      action: 'block_release_and_reconcile',
    });
  });

  it('keeps document.attach as attach-only and never document acceptance', () => {
    const state = createPlatformV7ExecutionState('deal-001');
    const [nextState, result] = applyPlatformV7RuntimeAction(
      state,
      makeCommand({ payload: { documentRef: 'sdiz-001' } }),
    );

    expect(result.ok).toBe(true);
    expect(result.documentImpact).toBe('attached');
    expect(result.moneyImpact).toBe('none');
    expect(nextState.documents).toHaveLength(1);
    expect(nextState.documents[0]).toMatchObject({
      documentRef: 'sdiz-001',
      attachedByRole: 'seller',
    });
    expect(result.documentImpact).not.toBe('status_changed');
    expect(nextState.money).toBeNull();
  });

  it('keeps repeated document.attach calls idempotent per command key', () => {
    const state = createPlatformV7ExecutionState('deal-001');
    const command = makeCommand({ payload: { documentRef: 'transport-doc-001' }, idempotencyKey: 'idem-doc-repeat-001' });
    const [state1] = applyPlatformV7RuntimeAction(state, command);
    const [state2, result2] = applyPlatformV7RuntimeAction(state1, command);

    expect(state2.documents).toHaveLength(1);
    expect(state2.auditEvents).toHaveLength(1);
    expect(result2.stateChanged).toBe(false);
  });

  it('requires decision_ready, evidence readiness and explicit decision before dispute resolution', () => {
    expect(canPlatformV7DisputeBeResolved(makeDispute({ status: 'manual_review' }), true)).toBe(false);
    expect(canPlatformV7DisputeBeResolved(makeDispute({ evidencePackId: undefined }), false)).toBe(false);
    expect(canPlatformV7DisputeBeResolved(makeDispute({ decision: undefined }), true)).toBe(false);
    expect(canPlatformV7DisputeBeResolved(makeDispute(), true)).toBe(true);
  });

  it('treats every non-closed dispute status as open', () => {
    (['open', 'evidence_collection', 'manual_review', 'decision_ready'] as const satisfies readonly PlatformV7DisputeStatus[]).forEach((status) => {
      expect(isPlatformV7DisputeOpen(makeDispute({ status }))).toBe(true);
    });
    expect(isPlatformV7DisputeOpen(makeDispute({ status: 'resolved' }))).toBe(false);
    expect(isPlatformV7DisputeOpen(makeDispute({ status: 'closed' }))).toBe(false);
  });

  it('keeps non-financial dispute decisions from changing money', () => {
    expect(canPlatformV7DisputeChangeMoney(makeDispute({ decision: 'request_document' }))).toBe(false);
    expect(canPlatformV7DisputeChangeMoney(makeDispute({ decision: 'request_retest' }))).toBe(false);
    expect(canPlatformV7DisputeChangeMoney(makeDispute({ decision: 'manual_review' }))).toBe(false);
  });

  it('requires positive held amount for dispute money impact', () => {
    expect(canPlatformV7DisputeChangeMoney(makeDispute({ heldAmountRub: 0, decision: 'hold_part' }))).toBe(false);
    expect(canPlatformV7DisputeChangeMoney(makeDispute({ heldAmountRub: 250_000, decision: 'hold_part' }))).toBe(true);
  });
});
