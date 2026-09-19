import type { PlatformActionScope } from './action-log';

export const PLATFORM_V7_EXECUTION_STATES = [
  'offerDraft', 'offerSubmitted', 'offerAccepted', 'dealDraft',
  'moneyReserveRequested', 'moneyReserveConfirmedManual',
  'logisticsAssigned', 'loadingPointArrived', 'loadingStarted', 'loadingFinished', 'departedLoadingPoint', 'arrivedElevator',
  'qualityCheckPending', 'qualityAccepted', 'qualityRejected',
  'documentsPending', 'documentsAttached', 'sdizRequired', 'sdizReadyManual',
  'releaseRequested', 'releaseBlocked', 'releaseAllowed',
  'disputeOpen', 'disputeResolved', 'dealClosed',
] as const;

export const PLATFORM_V7_EXECUTION_MACHINE_ACTIONS = [
  'confirmMoneyReserveManual', 'cancelMoneyReserveIntent', 'createLogisticsOrder',
  'markLoadingPointArrived', 'startLoading', 'finishLoading', 'markDepartedLoadingPoint', 'markArrivedElevator',
  'startQualityCheck', 'acceptQuality', 'rejectQuality', 'attachLabResult',
  'markDocumentsPending', 'attachDealDocuments', 'markSdizRequired', 'markSdizReadyManual',
  'requestReleaseAfterGates', 'blockReleaseBecauseGatesPending', 'resolveDispute', 'closeDeal',
] as const;

export type PlatformV7ExecutionState = typeof PLATFORM_V7_EXECUTION_STATES[number];
export type PlatformV7ExecutionMachineActionId = typeof PLATFORM_V7_EXECUTION_MACHINE_ACTIONS[number];
export type PlatformV7ExecutionMachineMode = 'controlled-pilot' | 'manual' | 'sandbox';
export type PlatformV7ExecutionMachineRole = 'seller' | 'buyer' | 'operator' | 'logistics' | 'driver' | 'elevator' | 'lab' | 'bank' | 'arbitrator';

type GuardResult = true | string;

export interface PlatformV7ExecutionMachineFlags {
  readonly hasAcceptedOffer: boolean;
  readonly hasDraftDeal: boolean;
  readonly hasMoneyReserveIntent: boolean;
  readonly hasMoneyReserveConfirmed: boolean;
  readonly hasLogisticsOrder: boolean;
  readonly hasLoadingStarted: boolean;
  readonly hasArrivedElevator: boolean;
  readonly hasQualityCheckStarted: boolean;
  readonly hasQualityAccepted: boolean;
  readonly hasQualityRejected: boolean;
  readonly hasDocumentsAttached: boolean;
  readonly hasSdizReady: boolean;
  readonly hasOpenDispute: boolean;
}

export interface PlatformV7ExecutionMachineLogEntry {
  readonly actionId: PlatformV7ExecutionMachineActionId;
  readonly fromState: PlatformV7ExecutionState;
  readonly toState: PlatformV7ExecutionState;
  readonly actorRole: PlatformV7ExecutionMachineRole;
  readonly mode: PlatformV7ExecutionMachineMode;
  readonly scope: PlatformActionScope;
  readonly at: string;
}

export interface PlatformV7ExecutionMachineSnapshot extends PlatformV7ExecutionMachineFlags {
  readonly state: PlatformV7ExecutionState;
  readonly actionLog: readonly PlatformV7ExecutionMachineLogEntry[];
}

export interface PlatformV7ExecutionMachineContext extends PlatformV7ExecutionMachineSnapshot {
  readonly previousContextRef: PlatformV7ExecutionMachineSnapshot | null;
}

export interface PlatformV7ExecutionMachineSpec {
  readonly actionId: PlatformV7ExecutionMachineActionId;
  readonly fromStates: readonly PlatformV7ExecutionState[];
  readonly allowedRoles: readonly PlatformV7ExecutionMachineRole[];
  readonly scope: PlatformActionScope;
  readonly mode: PlatformV7ExecutionMachineMode;
  readonly toState: PlatformV7ExecutionState | ((ctx: PlatformV7ExecutionMachineContext) => PlatformV7ExecutionState);
  readonly guard: (ctx: PlatformV7ExecutionMachineContext) => GuardResult;
  readonly mutateFlags?: (ctx: PlatformV7ExecutionMachineContext) => Partial<PlatformV7ExecutionMachineFlags>;
}

export type PlatformV7ExecutionMachineResult =
  | { readonly status: 'success'; readonly context: PlatformV7ExecutionMachineContext; readonly logEntry: PlatformV7ExecutionMachineLogEntry }
  | { readonly status: 'blocked'; readonly actionId: PlatformV7ExecutionMachineActionId; readonly disabledReason: string };

const ok = (value: boolean, reason: string): GuardResult => value ? true : reason;
const pass = (): GuardResult => true;
const spec = (
  actionId: PlatformV7ExecutionMachineActionId,
  fromStates: readonly PlatformV7ExecutionState[],
  toState: PlatformV7ExecutionMachineSpec['toState'],
  guard: PlatformV7ExecutionMachineSpec['guard'],
  allowedRoles: readonly PlatformV7ExecutionMachineRole[],
  scope: PlatformActionScope,
  mode: PlatformV7ExecutionMachineMode,
  mutateFlags?: PlatformV7ExecutionMachineSpec['mutateFlags'],
): PlatformV7ExecutionMachineSpec => ({ actionId, fromStates, toState, guard, allowedRoles, scope, mode, mutateFlags });

const releaseGuard = (ctx: PlatformV7ExecutionMachineContext): GuardResult => {
  if (!ctx.hasMoneyReserveConfirmed) return 'reserve_not_confirmed';
  if (!ctx.hasQualityAccepted) return 'quality_not_accepted';
  if (!ctx.hasDocumentsAttached) return 'documents_missing';
  if (!ctx.hasSdizReady) return 'sdiz_missing';
  if (ctx.hasOpenDispute) return 'dispute_open';
  return true;
};

export const PLATFORM_V7_EXECUTION_MACHINE_SPECS: Record<PlatformV7ExecutionMachineActionId, PlatformV7ExecutionMachineSpec> = {
  confirmMoneyReserveManual: spec('confirmMoneyReserveManual', ['dealDraft', 'moneyReserveRequested'], (ctx) => ctx.state === 'dealDraft' ? 'moneyReserveRequested' : 'moneyReserveConfirmedManual', (ctx) => ok(ctx.hasDraftDeal, 'draft_required'), ['operator', 'bank'], 'bank', 'controlled-pilot', (ctx) => ctx.state === 'dealDraft' ? { hasMoneyReserveIntent: true } : { hasMoneyReserveConfirmed: true }),
  cancelMoneyReserveIntent: spec('cancelMoneyReserveIntent', ['moneyReserveRequested'], 'dealDraft', (ctx) => ok(ctx.hasMoneyReserveIntent, 'reserve_intent_required'), ['operator', 'bank'], 'bank', 'manual', () => ({ hasMoneyReserveIntent: false })),
  createLogisticsOrder: spec('createLogisticsOrder', ['moneyReserveRequested', 'moneyReserveConfirmedManual'], 'logisticsAssigned', (ctx) => ok(ctx.hasMoneyReserveIntent || ctx.hasMoneyReserveConfirmed, 'reserve_required'), ['operator', 'logistics'], 'logistics', 'controlled-pilot', () => ({ hasLogisticsOrder: true })),
  markLoadingPointArrived: spec('markLoadingPointArrived', ['logisticsAssigned'], 'loadingPointArrived', (ctx) => ok(ctx.hasLogisticsOrder, 'logistics_required'), ['operator', 'driver', 'logistics'], 'logistics', 'manual'),
  startLoading: spec('startLoading', ['loadingPointArrived'], 'loadingStarted', (ctx) => ok(ctx.hasLogisticsOrder, 'logistics_required'), ['operator', 'driver', 'logistics'], 'logistics', 'manual', () => ({ hasLoadingStarted: true })),
  finishLoading: spec('finishLoading', ['loadingStarted'], 'loadingFinished', (ctx) => ok(ctx.hasLoadingStarted, 'loading_required'), ['operator', 'driver', 'logistics'], 'logistics', 'manual'),
  markDepartedLoadingPoint: spec('markDepartedLoadingPoint', ['loadingFinished'], 'departedLoadingPoint', (ctx) => ok(ctx.hasLogisticsOrder, 'logistics_required'), ['operator', 'driver', 'logistics'], 'logistics', 'manual'),
  markArrivedElevator: spec('markArrivedElevator', ['departedLoadingPoint'], 'arrivedElevator', (ctx) => ok(ctx.hasLogisticsOrder, 'logistics_required'), ['operator', 'driver', 'elevator', 'logistics'], 'elevator', 'manual', () => ({ hasArrivedElevator: true })),
  startQualityCheck: spec('startQualityCheck', ['arrivedElevator'], 'qualityCheckPending', (ctx) => ok(ctx.hasArrivedElevator, 'elevator_required'), ['operator', 'lab', 'elevator'], 'lab', 'controlled-pilot', () => ({ hasQualityCheckStarted: true })),
  acceptQuality: spec('acceptQuality', ['qualityCheckPending'], 'qualityAccepted', (ctx) => ok(ctx.hasQualityCheckStarted, 'quality_check_required'), ['operator', 'lab'], 'lab', 'controlled-pilot', () => ({ hasQualityAccepted: true, hasQualityRejected: false })),
  rejectQuality: spec('rejectQuality', ['qualityCheckPending'], 'qualityRejected', (ctx) => ok(ctx.hasQualityCheckStarted, 'quality_check_required'), ['operator', 'lab'], 'lab', 'controlled-pilot', () => ({ hasQualityAccepted: false, hasQualityRejected: true })),
  attachLabResult: spec('attachLabResult', ['qualityCheckPending', 'qualityAccepted', 'qualityRejected'], (ctx) => ctx.state, (ctx) => ok(ctx.hasQualityCheckStarted, 'quality_check_required'), ['operator', 'lab'], 'lab', 'manual'),
  markDocumentsPending: spec('markDocumentsPending', ['qualityAccepted', 'moneyReserveConfirmedManual', 'logisticsAssigned'], 'documentsPending', (ctx) => ok(ctx.hasDraftDeal, 'draft_required'), ['operator'], 'deal', 'manual'),
  attachDealDocuments: spec('attachDealDocuments', ['qualityAccepted', 'documentsPending'], 'documentsAttached', (ctx) => ok(ctx.hasDraftDeal, 'draft_required'), ['operator', 'seller', 'buyer'], 'deal', 'manual', () => ({ hasDocumentsAttached: true })),
  markSdizRequired: spec('markSdizRequired', ['documentsPending', 'documentsAttached'], 'sdizRequired', (ctx) => ok(ctx.hasDraftDeal, 'draft_required'), ['operator'], 'deal', 'manual'),
  markSdizReadyManual: spec('markSdizReadyManual', ['documentsAttached', 'sdizRequired'], 'sdizReadyManual', (ctx) => ok(ctx.hasDocumentsAttached, 'documents_required'), ['operator'], 'deal', 'manual', () => ({ hasSdizReady: true })),
  requestReleaseAfterGates: spec('requestReleaseAfterGates', ['sdizReadyManual', 'releaseRequested'], (ctx) => ctx.state === 'sdizReadyManual' ? 'releaseRequested' : 'releaseAllowed', releaseGuard, ['operator', 'bank'], 'bank', 'controlled-pilot'),
  blockReleaseBecauseGatesPending: spec('blockReleaseBecauseGatesPending', ['sdizReadyManual', 'releaseRequested', 'qualityRejected', 'disputeOpen'], 'releaseBlocked', pass, ['operator', 'bank'], 'bank', 'controlled-pilot'),
  resolveDispute: spec('resolveDispute', ['disputeOpen'], 'disputeResolved', (ctx) => ok(ctx.hasOpenDispute, 'dispute_required'), ['operator', 'arbitrator'], 'dispute', 'controlled-pilot', () => ({ hasOpenDispute: false })),
  closeDeal: spec('closeDeal', ['releaseAllowed', 'disputeResolved'], 'dealClosed', (ctx) => ok(!ctx.hasOpenDispute, 'dispute_open'), ['operator'], 'deal', 'controlled-pilot'),
};

const STATUS_MAP: Record<string, PlatformV7ExecutionState> = {
  'черновик сделки': 'dealDraft', 'резерв запрошен': 'moneyReserveRequested', 'резерв подтверждён': 'moneyReserveConfirmedManual',
  'логистика назначена': 'logisticsAssigned', 'погрузка начата': 'loadingStarted', 'документы на оформлении': 'documentsPending',
  'документы приложены': 'documentsAttached', 'документы прикреплены': 'documentsAttached', 'выпуск запрошен': 'releaseRequested',
  'выпуск разрешён': 'releaseAllowed', 'спор открыт': 'disputeOpen', 'спор закрыт': 'disputeResolved', 'сделка закрыта': 'dealClosed',
};

export function createPlatformV7ExecutionMachineContext(hasAcceptedOffer = true): PlatformV7ExecutionMachineContext {
  return {
    state: hasAcceptedOffer ? 'dealDraft' : 'offerDraft', previousContextRef: null,
    hasAcceptedOffer, hasDraftDeal: hasAcceptedOffer, hasMoneyReserveIntent: false, hasMoneyReserveConfirmed: false,
    hasLogisticsOrder: false, hasLoadingStarted: false, hasArrivedElevator: false, hasQualityCheckStarted: false,
    hasQualityAccepted: false, hasQualityRejected: false, hasDocumentsAttached: false, hasSdizReady: false, hasOpenDispute: false,
    actionLog: [],
  };
}

export function mapPlatformV7ExecutionStatusToMachineState(status: string): PlatformV7ExecutionState {
  return STATUS_MAP[status.trim().toLowerCase()] ?? 'dealDraft';
}

export function mapPlatformV7ExecutionSourceToMachineContext(sourceDeal: { status: string }): PlatformV7ExecutionMachineContext {
  return { ...createPlatformV7ExecutionMachineContext(true), state: mapPlatformV7ExecutionStatusToMachineState(sourceDeal.status) };
}

export function platformV7ExecutionMachineSpec(actionId: PlatformV7ExecutionMachineActionId): PlatformV7ExecutionMachineSpec {
  return PLATFORM_V7_EXECUTION_MACHINE_SPECS[actionId];
}

export function allPlatformV7ExecutionMachineSpecs(): PlatformV7ExecutionMachineSpec[] {
  return PLATFORM_V7_EXECUTION_MACHINE_ACTIONS.map(platformV7ExecutionMachineSpec);
}

function snapshot(ctx: PlatformV7ExecutionMachineContext): PlatformV7ExecutionMachineSnapshot {
  const { previousContextRef: _previousContextRef, ...snapshotRef } = ctx;
  return snapshotRef;
}

export function applyPlatformV7ExecutionMachineAction(
  ctx: PlatformV7ExecutionMachineContext,
  actionId: PlatformV7ExecutionMachineActionId,
  actorRole: PlatformV7ExecutionMachineRole = 'operator',
  now: () => string = () => new Date().toISOString(),
): PlatformV7ExecutionMachineResult {
  const entry = platformV7ExecutionMachineSpec(actionId);
  if (!entry.fromStates.includes(ctx.state)) return { status: 'blocked', actionId, disabledReason: `wrong_state:${ctx.state}` };
  if (!entry.allowedRoles.includes(actorRole)) return { status: 'blocked', actionId, disabledReason: 'role_blocked' };
  const guard = entry.guard(ctx);
  if (guard !== true) return { status: 'blocked', actionId, disabledReason: guard };
  const toState = typeof entry.toState === 'function' ? entry.toState(ctx) : entry.toState;
  const logEntry: PlatformV7ExecutionMachineLogEntry = { actionId, fromState: ctx.state, toState, actorRole, mode: entry.mode, scope: entry.scope, at: now() };
  return { status: 'success', logEntry, context: { ...ctx, ...(entry.mutateFlags?.(ctx) ?? {}), state: toState, previousContextRef: snapshot(ctx), actionLog: [logEntry, ...ctx.actionLog] } };
}

export function rollbackPlatformV7ExecutionMachineAction(ctx: PlatformV7ExecutionMachineContext): PlatformV7ExecutionMachineContext | null {
  if (!ctx.previousContextRef) return null;
  return { ...ctx.previousContextRef, previousContextRef: null };
}

export function availablePlatformV7ExecutionMachineActions(ctx: PlatformV7ExecutionMachineContext, actorRole: PlatformV7ExecutionMachineRole = 'operator'): PlatformV7ExecutionMachineActionId[] {
  return PLATFORM_V7_EXECUTION_MACHINE_ACTIONS.filter((actionId) => {
    const entry = platformV7ExecutionMachineSpec(actionId);
    return entry.fromStates.includes(ctx.state) && entry.allowedRoles.includes(actorRole) && entry.guard(ctx) === true;
  });
}

export function blockedPlatformV7ExecutionMachineActions(ctx: PlatformV7ExecutionMachineContext, actorRole: PlatformV7ExecutionMachineRole = 'operator'): Array<{ readonly actionId: PlatformV7ExecutionMachineActionId; readonly disabledReason: string }> {
  return PLATFORM_V7_EXECUTION_MACHINE_ACTIONS
    .filter((actionId) => platformV7ExecutionMachineSpec(actionId).fromStates.includes(ctx.state))
    .map((actionId) => {
      const entry = platformV7ExecutionMachineSpec(actionId);
      if (!entry.allowedRoles.includes(actorRole)) return { actionId, disabledReason: 'role_blocked' };
      const guard = entry.guard(ctx);
      return guard === true ? null : { actionId, disabledReason: guard };
    })
    .filter((item): item is { readonly actionId: PlatformV7ExecutionMachineActionId; readonly disabledReason: string } => Boolean(item));
}
