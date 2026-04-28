import { describe, expect, it } from 'vitest';
import { PLATFORM_V7_EXECUTION_SOURCE } from '@/lib/platform-v7/deal-execution-source-of-truth';
import {
  createPlatformV7ExecutionMachineBridgeSnapshot,
  createPlatformV7ExecutionMachineContextFromSource,
  platformV7MachineBlockers,
  platformV7MachineFinalGateReady,
} from '@/lib/platform-v7/execution-state-machine-bridge';

describe('platform-v7 execution state machine bridge', () => {
  it('maps the current execution source to a machine context without live claims', () => {
    const snapshot = createPlatformV7ExecutionMachineBridgeSnapshot();

    expect(snapshot.dealId).toBe(PLATFORM_V7_EXECUTION_SOURCE.deal.id);
    expect(snapshot.lotId).toBe(PLATFORM_V7_EXECUTION_SOURCE.deal.lotId);
    expect(snapshot.fgisPartyId).toBe(PLATFORM_V7_EXECUTION_SOURCE.deal.fgisPartyId);
    expect(snapshot.maturity).toBe('песочница');
    expect(snapshot.context.state).toBe('dealDraft');
    expect(snapshot.context.hasDraftDeal).toBe(true);
    expect(snapshot.context.hasMoneyReserveIntent).toBe(true);
    expect(snapshot.context.hasMoneyReserveConfirmed).toBe(false);
    expect(snapshot.context.hasDocumentsAttached).toBe(false);
    expect(snapshot.context.hasSdizReady).toBe(false);
    expect(snapshot.finalGateReady).toBe(false);
    expect(snapshot.blockers).toEqual(expect.arrayContaining(['reserve_not_confirmed', 'quality_not_accepted', 'documents_missing', 'sdiz_missing']));
  });

  it('does not expose release as ready while source gates are incomplete', () => {
    const ctx = createPlatformV7ExecutionMachineContextFromSource();
    expect(platformV7MachineFinalGateReady(ctx)).toBe(false);
    expect(platformV7MachineBlockers(ctx)).toContain('reserve_not_confirmed');
  });

  it('marks final gate ready only when bank, quality, documents, sdiz and dispute are clean', () => {
    const source = structuredClone(PLATFORM_V7_EXECUTION_SOURCE);
    source.deal.status = 'черновик сделки';
    source.readiness.bank.status = 'готово';
    source.money.bankDecision = 'готово';
    source.readiness.quality.status = 'готово';
    source.readiness.documents.status = 'готово';
    source.documents.missingDocuments = [];
    source.documents.sdizStatus = 'готов';
    source.dispute.status = 'готово';
    source.dispute.arbitratorNeeded = false;

    const ctx = createPlatformV7ExecutionMachineContextFromSource(source);
    expect(platformV7MachineFinalGateReady(ctx)).toBe(true);
    expect(platformV7MachineBlockers(ctx)).toEqual([]);
  });

  it('keeps dispute as a blocker when arbitrator is needed', () => {
    const source = structuredClone(PLATFORM_V7_EXECUTION_SOURCE);
    source.readiness.bank.status = 'готово';
    source.money.bankDecision = 'готово';
    source.readiness.quality.status = 'готово';
    source.readiness.documents.status = 'готово';
    source.documents.missingDocuments = [];
    source.documents.sdizStatus = 'готов';
    source.dispute.status = 'готово';
    source.dispute.arbitratorNeeded = true;

    const ctx = createPlatformV7ExecutionMachineContextFromSource(source);
    expect(ctx.hasOpenDispute).toBe(true);
    expect(platformV7MachineFinalGateReady(ctx)).toBe(false);
    expect(platformV7MachineBlockers(ctx)).toContain('dispute_open');
  });
});
