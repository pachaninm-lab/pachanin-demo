import { describe, expect, it } from 'vitest';
import {
  PLATFORM_V7_EXECUTION_MACHINE_ACTIONS,
  PLATFORM_V7_EXECUTION_STATES,
  allPlatformV7ExecutionMachineSpecs,
  applyPlatformV7ExecutionMachineAction,
  createPlatformV7ExecutionMachineContext,
  rollbackPlatformV7ExecutionMachineAction,
  type PlatformV7ExecutionMachineActionId,
  type PlatformV7ExecutionMachineContext,
} from '@/lib/platform-v7/execution-state-machine';

const now = () => '2026-04-28T16:00:00.000Z';

function apply(ctx: PlatformV7ExecutionMachineContext, actionId: PlatformV7ExecutionMachineActionId): PlatformV7ExecutionMachineContext {
  const result = applyPlatformV7ExecutionMachineAction(ctx, actionId, 'operator', now);
  expect(result.status).toBe('success');
  if (result.status !== 'success') throw new Error(`Expected success for ${actionId}`);
  return result.context;
}

describe('platform-v7 execution state machine', () => {
  it('contains exactly 25 states and 20 actions', () => {
    expect(PLATFORM_V7_EXECUTION_STATES).toHaveLength(25);
    expect(PLATFORM_V7_EXECUTION_MACHINE_ACTIONS).toHaveLength(20);
  });

  it('runs a full controlled-pilot happy path to dealClosed', () => {
    let ctx = createPlatformV7ExecutionMachineContext(true);
    ctx = apply(ctx, 'confirmMoneyReserveManual');
    ctx = apply(ctx, 'confirmMoneyReserveManual');
    ctx = apply(ctx, 'createLogisticsOrder');
    ctx = apply(ctx, 'markLoadingPointArrived');
    ctx = apply(ctx, 'startLoading');
    ctx = apply(ctx, 'finishLoading');
    ctx = apply(ctx, 'markDepartedLoadingPoint');
    ctx = apply(ctx, 'markArrivedElevator');
    ctx = apply(ctx, 'startQualityCheck');
    ctx = apply(ctx, 'acceptQuality');
    ctx = apply(ctx, 'attachDealDocuments');
    ctx = apply(ctx, 'markSdizReadyManual');
    ctx = apply(ctx, 'requestReleaseAfterGates');
    ctx = apply(ctx, 'requestReleaseAfterGates');
    ctx = apply(ctx, 'closeDeal');

    expect(ctx.state).toBe('dealClosed');
    expect(ctx.actionLog).toHaveLength(15);
  });

  it('blocks release without confirmed money reserve', () => {
    const ctx: PlatformV7ExecutionMachineContext = {
      ...createPlatformV7ExecutionMachineContext(true),
      state: 'sdizReadyManual',
      hasQualityAccepted: true,
      hasDocumentsAttached: true,
      hasSdizReady: true,
    };

    const result = applyPlatformV7ExecutionMachineAction(ctx, 'requestReleaseAfterGates', 'operator', now);
    expect(result).toEqual(expect.objectContaining({ status: 'blocked', disabledReason: 'reserve_not_confirmed' }));
  });

  it('blocks release without accepted quality', () => {
    const ctx: PlatformV7ExecutionMachineContext = {
      ...createPlatformV7ExecutionMachineContext(true),
      state: 'sdizReadyManual',
      hasMoneyReserveConfirmed: true,
      hasDocumentsAttached: true,
      hasSdizReady: true,
    };

    const result = applyPlatformV7ExecutionMachineAction(ctx, 'requestReleaseAfterGates', 'operator', now);
    expect(result).toEqual(expect.objectContaining({ status: 'blocked', disabledReason: 'quality_not_accepted' }));
  });

  it('blocks release without attached documents', () => {
    const ctx: PlatformV7ExecutionMachineContext = {
      ...createPlatformV7ExecutionMachineContext(true),
      state: 'sdizReadyManual',
      hasMoneyReserveConfirmed: true,
      hasQualityAccepted: true,
      hasSdizReady: true,
    };

    const result = applyPlatformV7ExecutionMachineAction(ctx, 'requestReleaseAfterGates', 'operator', now);
    expect(result).toEqual(expect.objectContaining({ status: 'blocked', disabledReason: 'documents_missing' }));
  });

  it('blocks release without SDIZ ready flag', () => {
    const ctx: PlatformV7ExecutionMachineContext = {
      ...createPlatformV7ExecutionMachineContext(true),
      state: 'sdizReadyManual',
      hasMoneyReserveConfirmed: true,
      hasQualityAccepted: true,
      hasDocumentsAttached: true,
    };

    const result = applyPlatformV7ExecutionMachineAction(ctx, 'requestReleaseAfterGates', 'operator', now);
    expect(result).toEqual(expect.objectContaining({ status: 'blocked', disabledReason: 'sdiz_missing' }));
  });

  it('blocks release when dispute is open', () => {
    const ctx: PlatformV7ExecutionMachineContext = {
      ...createPlatformV7ExecutionMachineContext(true),
      state: 'sdizReadyManual',
      hasMoneyReserveConfirmed: true,
      hasQualityAccepted: true,
      hasDocumentsAttached: true,
      hasSdizReady: true,
      hasOpenDispute: true,
    };

    const result = applyPlatformV7ExecutionMachineAction(ctx, 'requestReleaseAfterGates', 'operator', now);
    expect(result).toEqual(expect.objectContaining({ status: 'blocked', disabledReason: 'dispute_open' }));
  });

  it('blocks quality acceptance before quality check', () => {
    const ctx = { ...createPlatformV7ExecutionMachineContext(true), state: 'qualityCheckPending' as const };
    const result = applyPlatformV7ExecutionMachineAction(ctx, 'acceptQuality', 'operator', now);
    expect(result).toEqual(expect.objectContaining({ status: 'blocked', disabledReason: 'quality_check_required' }));
  });

  it('blocks field event without logistics order', () => {
    const ctx = { ...createPlatformV7ExecutionMachineContext(true), state: 'logisticsAssigned' as const };
    const result = applyPlatformV7ExecutionMachineAction(ctx, 'markLoadingPointArrived', 'operator', now);
    expect(result).toEqual(expect.objectContaining({ status: 'blocked', disabledReason: 'logistics_required' }));
  });

  it('blocks closeDeal when dispute is open', () => {
    const ctx = { ...createPlatformV7ExecutionMachineContext(true), state: 'releaseAllowed' as const, hasOpenDispute: true };
    const result = applyPlatformV7ExecutionMachineAction(ctx, 'closeDeal', 'operator', now);
    expect(result).toEqual(expect.objectContaining({ status: 'blocked', disabledReason: 'dispute_open' }));
  });

  it('does not allow qualityRejected to become releaseAllowed', () => {
    const ctx = { ...createPlatformV7ExecutionMachineContext(true), state: 'qualityRejected' as const, hasQualityRejected: true };
    const result = applyPlatformV7ExecutionMachineAction(ctx, 'requestReleaseAfterGates', 'operator', now);
    expect(result).toEqual(expect.objectContaining({ status: 'blocked', disabledReason: 'wrong_state:qualityRejected' }));
  });

  it('blocks wrong role', () => {
    const ctx = createPlatformV7ExecutionMachineContext(true);
    const result = applyPlatformV7ExecutionMachineAction(ctx, 'confirmMoneyReserveManual', 'seller', now);
    expect(result).toEqual(expect.objectContaining({ status: 'blocked', disabledReason: 'role_blocked' }));
  });

  it('blocks duplicate close and wrong state', () => {
    const ctx = { ...createPlatformV7ExecutionMachineContext(true), state: 'dealClosed' as const };
    const result = applyPlatformV7ExecutionMachineAction(ctx, 'closeDeal', 'operator', now);
    expect(result).toEqual(expect.objectContaining({ status: 'blocked', disabledReason: 'wrong_state:dealClosed' }));
  });

  it('rolls back the full previous context including flags and log', () => {
    const ctx: PlatformV7ExecutionMachineContext = {
      ...createPlatformV7ExecutionMachineContext(true),
      state: 'moneyReserveRequested',
      hasMoneyReserveIntent: true,
      actionLog: [{
        actionId: 'confirmMoneyReserveManual',
        fromState: 'dealDraft',
        toState: 'moneyReserveRequested',
        actorRole: 'operator',
        mode: 'controlled-pilot',
        scope: 'bank',
        at: now(),
      }],
    };

    const result = applyPlatformV7ExecutionMachineAction(ctx, 'confirmMoneyReserveManual', 'operator', now);
    expect(result.status).toBe('success');
    if (result.status !== 'success') throw new Error('Expected success');
    expect(result.context.hasMoneyReserveConfirmed).toBe(true);
    expect(result.context.actionLog).toHaveLength(2);

    const rollback = rollbackPlatformV7ExecutionMachineAction(result.context);
    expect(rollback).toEqual({ ...ctx, previousContextRef: null });
    expect(rollback?.hasMoneyReserveConfirmed).toBe(false);
    expect(rollback?.hasMoneyReserveIntent).toBe(true);
    expect(rollback?.actionLog).toHaveLength(1);
  });

  it('every spec has roles, scope, mode and no live mode', () => {
    allPlatformV7ExecutionMachineSpecs().forEach((entry) => {
      expect(entry.allowedRoles.length).toBeGreaterThan(0);
      expect(entry.scope).toBeTruthy();
      expect(entry.mode).toBeTruthy();
      expect(entry.mode).not.toBe('live');
    });
  });
});
