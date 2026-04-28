import { describe, expect, it } from 'vitest';
import {
  applyExecutionAction,
  availableActions,
  blockedActionsInState,
  createInitialContext,
  mapSourceTruthToContext,
  mapSourceTruthToExecutionState,
  rollbackExecution,
  allExecutionActionSpecs,
  EXECUTION_STATE_LABELS,
  EXECUTION_ACTION_LABELS,
  type ExecutionContext,
  type ExecutionActionId,
} from '@/lib/platform-v7/execution-state-machine';

// ─── Helpers ──────────────────────────────────────────────────────────────────

type FailResult = { success: false; guardReason: string; actionId: ExecutionActionId };
type OkResult = { success: true; context: ExecutionContext };

function apply(ctx: ExecutionContext, ...actions: ExecutionActionId[]): ExecutionContext {
  let current = ctx;
  for (const actionId of actions) {
    const result = applyExecutionAction(current, actionId);
    if (!result.success) {
      throw new Error(`Action ${actionId} failed: ${(result as FailResult).guardReason}`);
    }
    current = (result as OkResult).context;
  }
  return current;
}

function expectBlocked(ctx: ExecutionContext, actionId: ExecutionActionId, containing?: string) {
  const result = applyExecutionAction(ctx, actionId);
  expect(result.success).toBe(false);
  if (!result.success && containing) {
    expect((result as FailResult).guardReason).toContain(containing);
  }
}

// ─── Source-of-truth mapping ──────────────────────────────────────────────────

describe('mapSourceTruthToExecutionState', () => {
  it('maps черновик сделки to dealDraft', () => {
    expect(mapSourceTruthToExecutionState('черновик сделки')).toBe('dealDraft');
  });

  it('maps unknown status to dealDraft as safe default', () => {
    expect(mapSourceTruthToExecutionState('unknown-status')).toBe('dealDraft');
  });

  it('maps all known statuses without throwing', () => {
    const known = [
      'черновик сделки', 'принята ставка', 'резерв запрошен', 'резерв подтверждён',
      'логистика назначена', 'погрузка начата', 'документы на оформлении',
      'документы прикреплены', 'выпуск запрошен', 'выпуск разрешён',
      'спор открыт', 'сделка закрыта',
    ];
    for (const status of known) {
      expect(() => mapSourceTruthToExecutionState(status)).not.toThrow();
    }
  });

  it('mapSourceTruthToContext creates context with hasDraftDeal=true', () => {
    const ctx = mapSourceTruthToContext({ status: 'черновик сделки' });
    expect(ctx.hasDraftDeal).toBe(true);
    expect(ctx.state).toBe('dealDraft');
  });
});

// ─── Happy path ───────────────────────────────────────────────────────────────

describe('happy path: full execution lifecycle', () => {
  it('offerAccepted (hasAcceptedOffer=true) creates dealDraft initial context', () => {
    const ctx = createInitialContext(true);
    expect(ctx.state).toBe('dealDraft');
    expect(ctx.hasDraftDeal).toBe(true);
  });

  it('dealDraft → moneyReserveRequested via confirmMoneyReserveManual', () => {
    const ctx = createInitialContext(true);
    const r = applyExecutionAction(ctx, 'confirmMoneyReserveManual');
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.context.state).toBe('moneyReserveRequested');
      expect(r.context.hasMoneyReserveIntent).toBe(true);
    }
  });

  it('moneyReserveRequested → moneyReserveConfirmedManual via confirmMoneyReserveManual', () => {
    const ctx = apply(createInitialContext(true), 'confirmMoneyReserveManual');
    expect(ctx.state).toBe('moneyReserveRequested');

    const r = applyExecutionAction(ctx, 'confirmMoneyReserveManual');
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.context.state).toBe('moneyReserveConfirmedManual');
      expect(r.context.hasMoneyReserveConfirmed).toBe(true);
    }
  });

  it('moneyReserveConfirmedManual → logisticsAssigned via createLogisticsOrder', () => {
    const ctx = apply(createInitialContext(true), 'confirmMoneyReserveManual', 'confirmMoneyReserveManual');
    const r = applyExecutionAction(ctx, 'createLogisticsOrder');
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.context.state).toBe('logisticsAssigned');
      expect(r.context.hasLogisticsOrder).toBe(true);
    }
  });

  it('logisticsAssigned through arrivedElevator via field events', () => {
    const ctx = apply(createInitialContext(true),
      'confirmMoneyReserveManual', 'confirmMoneyReserveManual', 'createLogisticsOrder',
    );
    const final = apply(ctx,
      'markLoadingPointArrived', 'startLoading', 'finishLoading',
      'markDepartedLoadingPoint', 'markArrivedElevator',
    );
    expect(final.state).toBe('arrivedElevator');
  });

  it('arrivedElevator → qualityCheckPending → qualityAccepted', () => {
    const ctx = apply(createInitialContext(true),
      'confirmMoneyReserveManual', 'confirmMoneyReserveManual', 'createLogisticsOrder',
      'markLoadingPointArrived', 'startLoading', 'finishLoading',
      'markDepartedLoadingPoint', 'markArrivedElevator', 'startQualityCheck',
    );
    expect(ctx.state).toBe('qualityCheckPending');
    expect(ctx.hasQualityCheckStarted).toBe(true);

    const r = applyExecutionAction(ctx, 'acceptQuality');
    expect(r.success).toBe(true);
    if (r.success) expect(r.context.state).toBe('qualityAccepted');
  });

  it('qualityAccepted → documentsAttached via attachDealDocuments', () => {
    const ctx = apply(createInitialContext(true),
      'confirmMoneyReserveManual', 'confirmMoneyReserveManual', 'createLogisticsOrder',
      'markLoadingPointArrived', 'startLoading', 'finishLoading',
      'markDepartedLoadingPoint', 'markArrivedElevator',
      'startQualityCheck', 'acceptQuality',
    );
    const r = applyExecutionAction(ctx, 'attachDealDocuments');
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.context.state).toBe('documentsAttached');
      expect(r.context.hasDocumentsAttached).toBe(true);
    }
  });

  it('documentsAttached → sdizReadyManual via markSdizReadyManual', () => {
    const ctx = apply(createInitialContext(true),
      'confirmMoneyReserveManual', 'confirmMoneyReserveManual', 'createLogisticsOrder',
      'markLoadingPointArrived', 'startLoading', 'finishLoading',
      'markDepartedLoadingPoint', 'markArrivedElevator',
      'startQualityCheck', 'acceptQuality', 'attachDealDocuments',
    );
    const r = applyExecutionAction(ctx, 'markSdizReadyManual');
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.context.state).toBe('sdizReadyManual');
      expect(r.context.hasSdizReady).toBe(true);
    }
  });

  it('sdizReadyManual → releaseRequested via requestReleaseAfterGates (step 1)', () => {
    const ctx = apply(createInitialContext(true),
      'confirmMoneyReserveManual', 'confirmMoneyReserveManual', 'createLogisticsOrder',
      'markLoadingPointArrived', 'startLoading', 'finishLoading',
      'markDepartedLoadingPoint', 'markArrivedElevator',
      'startQualityCheck', 'acceptQuality', 'attachDealDocuments', 'markSdizReadyManual',
    );
    const r = applyExecutionAction(ctx, 'requestReleaseAfterGates');
    expect(r.success).toBe(true);
    if (r.success) expect(r.context.state).toBe('releaseRequested');
  });

  it('releaseRequested → releaseAllowed via requestReleaseAfterGates (step 2)', () => {
    const ctx = apply(createInitialContext(true),
      'confirmMoneyReserveManual', 'confirmMoneyReserveManual', 'createLogisticsOrder',
      'markLoadingPointArrived', 'startLoading', 'finishLoading',
      'markDepartedLoadingPoint', 'markArrivedElevator',
      'startQualityCheck', 'acceptQuality', 'attachDealDocuments', 'markSdizReadyManual',
      'requestReleaseAfterGates',
    );
    expect(ctx.state).toBe('releaseRequested');

    const r = applyExecutionAction(ctx, 'requestReleaseAfterGates');
    expect(r.success).toBe(true);
    if (r.success) expect(r.context.state).toBe('releaseAllowed');
  });

  it('releaseAllowed → dealClosed via closeDeal', () => {
    const ctx = apply(createInitialContext(true),
      'confirmMoneyReserveManual', 'confirmMoneyReserveManual', 'createLogisticsOrder',
      'markLoadingPointArrived', 'startLoading', 'finishLoading',
      'markDepartedLoadingPoint', 'markArrivedElevator',
      'startQualityCheck', 'acceptQuality', 'attachDealDocuments', 'markSdizReadyManual',
      'requestReleaseAfterGates', 'requestReleaseAfterGates',
    );
    expect(ctx.state).toBe('releaseAllowed');

    const r = applyExecutionAction(ctx, 'closeDeal');
    expect(r.success).toBe(true);
    if (r.success) expect(r.context.state).toBe('dealClosed');
  });

  it('full happy path ends in dealClosed with 15 log entries', () => {
    const final = apply(createInitialContext(true),
      'confirmMoneyReserveManual', 'confirmMoneyReserveManual', 'createLogisticsOrder',
      'markLoadingPointArrived', 'startLoading', 'finishLoading',
      'markDepartedLoadingPoint', 'markArrivedElevator',
      'startQualityCheck', 'acceptQuality', 'attachDealDocuments', 'markSdizReadyManual',
      'requestReleaseAfterGates', 'requestReleaseAfterGates', 'closeDeal',
    );
    expect(final.state).toBe('dealClosed');
    expect(final.actionLog.length).toBe(15);
  });
});

// ─── Bad paths ────────────────────────────────────────────────────────────────

describe('bad paths: guards block invalid transitions', () => {
  it('releaseAllowed без documentsAttached = blocked', () => {
    const ctx: ExecutionContext = {
      ...createInitialContext(true),
      state: 'releaseRequested',
      hasMoneyReserveConfirmed: true,
      hasDocumentsAttached: false,
      hasSdizReady: true,
      hasOpenDispute: false,
    };
    expectBlocked(ctx, 'requestReleaseAfterGates', 'документы');
  });

  it('releaseAllowed без sdizReadyManual = blocked', () => {
    const ctx: ExecutionContext = {
      ...createInitialContext(true),
      state: 'releaseRequested',
      hasMoneyReserveConfirmed: true,
      hasDocumentsAttached: true,
      hasSdizReady: false,
      hasOpenDispute: false,
    };
    expectBlocked(ctx, 'requestReleaseAfterGates', 'СДИЗ');
  });

  it('releaseAllowed при disputeOpen = blocked', () => {
    const ctx: ExecutionContext = {
      ...createInitialContext(true),
      state: 'releaseRequested',
      hasMoneyReserveConfirmed: true,
      hasDocumentsAttached: true,
      hasSdizReady: true,
      hasOpenDispute: true,
    };
    expectBlocked(ctx, 'requestReleaseAfterGates', 'спор');
  });

  it('acceptQuality без qualityCheckPending = blocked', () => {
    const ctx: ExecutionContext = {
      ...createInitialContext(true),
      state: 'qualityCheckPending',
      hasQualityCheckStarted: false,
    };
    expectBlocked(ctx, 'acceptQuality');
  });

  it('field event без logisticsOrder = blocked', () => {
    const ctx: ExecutionContext = {
      ...createInitialContext(true),
      state: 'logisticsAssigned',
      hasLogisticsOrder: false,
    };
    expectBlocked(ctx, 'markLoadingPointArrived', 'логистического заказа');
  });

  it('field event from wrong state = blocked with state reason', () => {
    expectBlocked(createInitialContext(true), 'startLoading', 'недопустимо');
  });

  it('duplicate submit: closing already closed deal = blocked', () => {
    const ctx: ExecutionContext = { ...createInitialContext(true), state: 'dealClosed' };
    expectBlocked(ctx, 'closeDeal', 'недопустимо');
  });

  it('duplicate dispute resolve without open dispute = blocked', () => {
    const ctx: ExecutionContext = {
      ...createInitialContext(true),
      state: 'disputeOpen',
      hasOpenDispute: false,
    };
    expectBlocked(ctx, 'resolveDispute', 'спор');
  });

  it('closeDeal при open dispute = blocked', () => {
    const ctx: ExecutionContext = {
      ...createInitialContext(true),
      state: 'releaseAllowed',
      hasOpenDispute: true,
    };
    expectBlocked(ctx, 'closeDeal', 'спор');
  });

  it('qualityRejected → releaseAllowed impossible (wrong fromState)', () => {
    const ctx: ExecutionContext = { ...createInitialContext(true), state: 'qualityRejected' };
    expectBlocked(ctx, 'requestReleaseAfterGates', 'недопустимо');
  });

  it('createLogisticsOrder without moneyReserve intent = blocked', () => {
    const ctx: ExecutionContext = {
      ...createInitialContext(true),
      state: 'moneyReserveRequested',
      hasMoneyReserveIntent: false,
      hasMoneyReserveConfirmed: false,
    };
    expectBlocked(ctx, 'createLogisticsOrder', 'резерва');
  });

  it('confirmMoneyReserveManual без hasDraftDeal = blocked', () => {
    const ctx: ExecutionContext = {
      ...createInitialContext(false),
      state: 'dealDraft',
      hasDraftDeal: false,
    };
    expectBlocked(ctx, 'confirmMoneyReserveManual', 'черновика');
  });
});

// ─── Rollback ─────────────────────────────────────────────────────────────────

describe('rollback', () => {
  it('rollback restores previous state', () => {
    const ctx0 = createInitialContext(true);
    const r = applyExecutionAction(ctx0, 'confirmMoneyReserveManual');
    expect(r.success).toBe(true);
    if (!r.success) return;
    const ctx1 = r.context;
    expect(ctx1.state).toBe('moneyReserveRequested');
    expect(ctx1.previousStateRef).toBe('dealDraft');

    const rolled = rollbackExecution(ctx1);
    expect(rolled).not.toBeNull();
    expect(rolled!.state).toBe('dealDraft');
    expect(rolled!.previousStateRef).toBeNull();
  });

  it('rollback removes last log entry', () => {
    const ctx0 = createInitialContext(true);
    const r = applyExecutionAction(ctx0, 'confirmMoneyReserveManual');
    expect(r.success).toBe(true);
    if (!r.success) return;
    const ctx1 = r.context;
    expect(ctx1.actionLog.length).toBe(1);

    const rolled = rollbackExecution(ctx1);
    expect(rolled!.actionLog.length).toBe(0);
  });

  it('rollback from no-history returns null', () => {
    expect(rollbackExecution(createInitialContext(true))).toBeNull();
  });

  it('rollback does not mutate other context flags except state and previousStateRef', () => {
    const ctx0 = createInitialContext(true);
    const r = applyExecutionAction(ctx0, 'confirmMoneyReserveManual');
    expect(r.success).toBe(true);
    if (!r.success) return;
    const ctx1 = r.context;

    const rolled = rollbackExecution(ctx1);
    expect(rolled!.hasDraftDeal).toBe(ctx1.hasDraftDeal);
    expect(rolled!.hasAcceptedOffer).toBe(ctx1.hasAcceptedOffer);
    expect(rolled!.previousStateRef).toBeNull();
  });
});

// ─── availableActions and blockedActionsInState ───────────────────────────────

describe('availableActions / blockedActionsInState', () => {
  it('initial dealDraft has confirmMoneyReserveManual available', () => {
    const ctx = createInitialContext(true);
    expect(availableActions(ctx)).toContain('confirmMoneyReserveManual');
  });

  it('dealClosed has no available actions', () => {
    const ctx: ExecutionContext = { ...createInitialContext(true), state: 'dealClosed' };
    expect(availableActions(ctx)).toHaveLength(0);
  });

  it('releaseRequested without conditions has blockedActionsInState', () => {
    const ctx: ExecutionContext = {
      ...createInitialContext(true),
      state: 'releaseRequested',
      hasMoneyReserveConfirmed: false,
      hasDocumentsAttached: false,
      hasSdizReady: false,
    };
    const blocked = blockedActionsInState(ctx);
    expect(blocked.some((b) => b.actionId === 'requestReleaseAfterGates')).toBe(true);
  });
});

// ─── State/action label coverage ─────────────────────────────────────────────

describe('labels completeness', () => {
  it('every ExecutionState has a label', () => {
    expect(Object.keys(EXECUTION_STATE_LABELS).length).toBeGreaterThan(20);
    for (const label of Object.values(EXECUTION_STATE_LABELS)) {
      expect(label.length).toBeGreaterThan(0);
    }
  });

  it('every ExecutionActionId has a label and there are 20 actions', () => {
    for (const label of Object.values(EXECUTION_ACTION_LABELS)) {
      expect(label.length).toBeGreaterThan(0);
    }
    expect(Object.keys(EXECUTION_ACTION_LABELS)).toHaveLength(20);
  });

  it('allExecutionActionSpecs returns 20 specs', () => {
    expect(allExecutionActionSpecs()).toHaveLength(20);
  });
});
