import { describe, expect, it } from 'vitest';
import { getPlatformV7BankCockpitState } from '@/lib/platform-v7/runtime/bank-cockpit-state';
import { getPlatformV7DisputeCockpitState } from '@/lib/platform-v7/runtime/dispute-cockpit-state';
import { PLATFORM_V7_EXECUTION_SOURCE } from '@/lib/platform-v7/deal-execution-source-of-truth';

describe('platform-v7 bank cockpit runtime binding (VP-6)', () => {
  it('derives amount, basis, documents and journal from the runtime source', () => {
    const state = getPlatformV7BankCockpitState();

    expect(state.sourceMeta.runtimeBound).toBe(true);
    expect(state.dealId).toBe(PLATFORM_V7_EXECUTION_SOURCE.deal.id);
    expect(state.reservedRub).toBe(PLATFORM_V7_EXECUTION_SOURCE.money.reservedRub);
    expect(state.missingDocuments).toEqual(PLATFORM_V7_EXECUTION_SOURCE.documents.missingDocuments);
    expect(state.journal.length).toBe(PLATFORM_V7_EXECUTION_SOURCE.audit.length);
  });

  it('never moves money without a bank event (Stage 4/5 invariant)', () => {
    const state = getPlatformV7BankCockpitState();
    expect(state.releasedRub).toBe(0);
    // basis is not ready while conditions are open in the source
    expect(state.basisStatus).toBe('not-ready');
    expect(state.canRequestRelease).toBe(false);
  });
});

describe('platform-v7 dispute cockpit runtime binding (VP-7)', () => {
  it('holds money and builds evidence pack from the runtime source', () => {
    const state = getPlatformV7DisputeCockpitState();

    expect(state.sourceMeta.runtimeBound).toBe(true);
    expect(state.heldRub).toBe(PLATFORM_V7_EXECUTION_SOURCE.money.holdRub);
    expect(state.evidencePack.length).toBe(PLATFORM_V7_EXECUTION_SOURCE.audit.length);
    expect(typeof state.active).toBe('boolean');
  });
});
