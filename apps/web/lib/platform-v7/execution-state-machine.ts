import type { PlatformActionScope } from './action-log';

// ─── States ───────────────────────────────────────────────────────────────────

export type ExecutionState =
  | 'offerDraft'
  | 'offerSubmitted'
  | 'offerAccepted'
  | 'dealDraft'
  | 'moneyReserveRequested'
  | 'moneyReserveConfirmedManual'
  | 'logisticsAssigned'
  | 'loadingPointArrived'
  | 'loadingStarted'
  | 'loadingFinished'
  | 'departedLoadingPoint'
  | 'arrivedElevator'
  | 'qualityCheckPending'
  | 'qualityAccepted'
  | 'qualityRejected'
  | 'documentsPending'
  | 'documentsAttached'
  | 'sdizRequired'
  | 'sdizReadyManual'
  | 'releaseRequested'
  | 'releaseBlocked'
  | 'releaseAllowed'
  | 'disputeOpen'
  | 'disputeResolved'
  | 'dealClosed';

// ─── Actions ──────────────────────────────────────────────────────────────────

export type ExecutionActionId =
  | 'confirmMoneyReserveManual'
  | 'cancelMoneyReserveIntent'
  | 'createLogisticsOrder'
  | 'markLoadingPointArrived'
  | 'startLoading'
  | 'finishLoading'
  | 'markDepartedLoadingPoint'
  | 'markArrivedElevator'
  | 'startQualityCheck'
  | 'acceptQuality'
  | 'rejectQuality'
  | 'attachLabResult'
  | 'markDocumentsPending'
  | 'attachDealDocuments'
  | 'markSdizRequired'
  | 'markSdizReadyManual'
  | 'requestReleaseAfterGates'
  | 'blockReleaseBecauseGatesPending'
  | 'resolveDispute'
  | 'closeDeal';

// ─── Context ──────────────────────────────────────────────────────────────────

export interface ExecutionActionRecord {
  readonly actionId: ExecutionActionId;
  readonly at: string;
  readonly fromState: ExecutionState;
  readonly toState: ExecutionState;
  readonly actor: string;
  readonly note: string;
  readonly mode: 'controlled-pilot' | 'manual';
}

type ContextFlags = {
  readonly hasAcceptedOffer: boolean;
  readonly hasDraftDeal: boolean;
  readonly hasMoneyReserveIntent: boolean;
  readonly hasMoneyReserveConfirmed: boolean;
  readonly hasLogisticsOrder: boolean;
  readonly hasQualityCheckStarted: boolean;
  readonly hasDocumentsAttached: boolean;
  readonly hasSdizReady: boolean;
  readonly hasOpenDispute: boolean;
};

export interface ExecutionContext extends ContextFlags {
  readonly state: ExecutionState;
  readonly previousStateRef: ExecutionState | null;
  readonly actionLog: readonly ExecutionActionRecord[];
}

// ─── Transition result ────────────────────────────────────────────────────────

export type ExecutionTransitionResult =
  | { readonly success: true; readonly context: ExecutionContext }
  | { readonly success: false; readonly guardReason: string; readonly actionId: ExecutionActionId };

// ─── Labels ───────────────────────────────────────────────────────────────────

export const EXECUTION_STATE_LABELS: Record<ExecutionState, string> = {
  offerDraft: 'Черновик ставки',
  offerSubmitted: 'Ставка подана',
  offerAccepted: 'Ставка принята',
  dealDraft: 'Черновик сделки',
  moneyReserveRequested: 'Запрос резерва денег',
  moneyReserveConfirmedManual: 'Резерв подтверждён вручную',
  logisticsAssigned: 'Логистика назначена',
  loadingPointArrived: 'Прибыл в пункт погрузки',
  loadingStarted: 'Погрузка начата',
  loadingFinished: 'Погрузка завершена',
  departedLoadingPoint: 'Выехал из пункта погрузки',
  arrivedElevator: 'Прибыл на элеватор',
  qualityCheckPending: 'Проверка качества начата',
  qualityAccepted: 'Качество принято',
  qualityRejected: 'Качество отклонено',
  documentsPending: 'Документы на оформлении',
  documentsAttached: 'Документы прикреплены',
  sdizRequired: 'Требуется СДИЗ',
  sdizReadyManual: 'СДИЗ готов (вручную)',
  releaseRequested: 'Запрос выпуска денег',
  releaseBlocked: 'Выпуск заблокирован',
  releaseAllowed: 'Выпуск разрешён',
  disputeOpen: 'Спор открыт',
  disputeResolved: 'Спор закрыт',
  dealClosed: 'Сделка закрыта',
};

export const EXECUTION_ACTION_LABELS: Record<ExecutionActionId, string> = {
  confirmMoneyReserveManual: 'Подтвердить резерв денег (вручную)',
  cancelMoneyReserveIntent: 'Отменить запрос резерва',
  createLogisticsOrder: 'Создать логистический заказ',
  markLoadingPointArrived: 'Отметить прибытие в пункт погрузки',
  startLoading: 'Начать погрузку',
  finishLoading: 'Завершить погрузку',
  markDepartedLoadingPoint: 'Отметить выезд из пункта погрузки',
  markArrivedElevator: 'Отметить прибытие на элеватор',
  startQualityCheck: 'Начать проверку качества',
  acceptQuality: 'Принять качество',
  rejectQuality: 'Отклонить качество',
  attachLabResult: 'Прикрепить результат лаборатории',
  markDocumentsPending: 'Отметить документы на оформлении',
  attachDealDocuments: 'Прикрепить документы сделки',
  markSdizRequired: 'Отметить требование СДИЗ',
  markSdizReadyManual: 'Подтвердить СДИЗ вручную',
  requestReleaseAfterGates: 'Запросить выпуск денег после gate-проверок',
  blockReleaseBecauseGatesPending: 'Заблокировать выпуск (gate не пройдены)',
  resolveDispute: 'Закрыть спор',
  closeDeal: 'Закрыть сделку',
};

// ─── Source-of-truth mapping ──────────────────────────────────────────────────

export function mapSourceTruthToExecutionState(status: string): ExecutionState {
  const map: Record<string, ExecutionState> = {
    'черновик сделки': 'dealDraft',
    'принята ставка': 'offerAccepted',
    'резерв запрошен': 'moneyReserveRequested',
    'резерв подтверждён': 'moneyReserveConfirmedManual',
    'логистика назначена': 'logisticsAssigned',
    'погрузка начата': 'loadingStarted',
    'документы на оформлении': 'documentsPending',
    'документы прикреплены': 'documentsAttached',
    'выпуск запрошен': 'releaseRequested',
    'выпуск разрешён': 'releaseAllowed',
    'спор открыт': 'disputeOpen',
    'сделка закрыта': 'dealClosed',
  };
  return map[status] ?? 'dealDraft';
}

// ─── Transition definitions ───────────────────────────────────────────────────

interface ExecutionTransitionDef {
  readonly fromStates: readonly ExecutionState[];
  readonly getToState: (ctx: ExecutionContext) => ExecutionState;
  readonly guard: (ctx: ExecutionContext) => boolean;
  readonly getGuardReason: (ctx: ExecutionContext) => string;
  readonly allowedRoles: readonly string[];
  readonly scope: PlatformActionScope;
  readonly mode: 'controlled-pilot' | 'manual';
  readonly contextMutation: (ctx: ExecutionContext) => Partial<ContextFlags>;
}

const T = (
  fromStates: readonly ExecutionState[],
  toState: ExecutionState,
  guard: (ctx: ExecutionContext) => boolean,
  guardReason: string,
  allowedRoles: readonly string[],
  scope: PlatformActionScope,
  mode: 'controlled-pilot' | 'manual',
  contextMutation: (ctx: ExecutionContext) => Partial<ContextFlags> = () => ({}),
): ExecutionTransitionDef => ({
  fromStates,
  getToState: () => toState,
  guard,
  getGuardReason: () => guardReason,
  allowedRoles,
  scope,
  mode,
  contextMutation,
});

const EXECUTION_TRANSITIONS: Record<ExecutionActionId, ExecutionTransitionDef> = {
  confirmMoneyReserveManual: {
    fromStates: ['dealDraft', 'moneyReserveRequested'],
    getToState: (ctx) => ctx.state === 'dealDraft' ? 'moneyReserveRequested' : 'moneyReserveConfirmedManual',
    guard: (ctx) => ctx.hasDraftDeal,
    getGuardReason: () => 'нельзя подтвердить резерв денег без черновика сделки',
    allowedRoles: ['operator', 'bank'],
    scope: 'bank',
    mode: 'controlled-pilot',
    contextMutation: (ctx) => ctx.state === 'dealDraft'
      ? { hasMoneyReserveIntent: true }
      : { hasMoneyReserveConfirmed: true },
  },

  cancelMoneyReserveIntent: T(
    ['moneyReserveRequested'],
    'dealDraft',
    (ctx) => ctx.hasMoneyReserveIntent,
    'нет активного запроса резерва для отмены',
    ['operator'],
    'deal',
    'manual',
    () => ({ hasMoneyReserveIntent: false }),
  ),

  createLogisticsOrder: T(
    ['dealDraft', 'moneyReserveRequested', 'moneyReserveConfirmedManual'],
    'logisticsAssigned',
    (ctx) => ctx.hasMoneyReserveIntent || ctx.hasMoneyReserveConfirmed,
    'нельзя назначить логистику без запроса или подтверждения резерва денег',
    ['operator', 'logistics'],
    'logistics',
    'controlled-pilot',
    () => ({ hasLogisticsOrder: true }),
  ),

  markLoadingPointArrived: T(
    ['logisticsAssigned'],
    'loadingPointArrived',
    (ctx) => ctx.hasLogisticsOrder,
    'нельзя зафиксировать прибытие без логистического заказа',
    ['driver', 'operator'],
    'logistics',
    'manual',
  ),

  startLoading: T(
    ['loadingPointArrived'],
    'loadingStarted',
    (ctx) => ctx.hasLogisticsOrder,
    'нельзя начать погрузку без логистического заказа',
    ['driver', 'operator'],
    'logistics',
    'manual',
  ),

  finishLoading: T(
    ['loadingStarted'],
    'loadingFinished',
    (ctx) => ctx.hasLogisticsOrder,
    'нельзя завершить погрузку без логистического заказа',
    ['driver', 'operator'],
    'logistics',
    'manual',
  ),

  markDepartedLoadingPoint: T(
    ['loadingFinished'],
    'departedLoadingPoint',
    (ctx) => ctx.hasLogisticsOrder,
    'нельзя зафиксировать выезд без логистического заказа',
    ['driver', 'operator'],
    'logistics',
    'manual',
  ),

  markArrivedElevator: T(
    ['departedLoadingPoint'],
    'arrivedElevator',
    (ctx) => ctx.hasLogisticsOrder,
    'нельзя зафиксировать прибытие на элеватор без логистического заказа',
    ['driver', 'elevator', 'operator'],
    'elevator',
    'manual',
  ),

  startQualityCheck: T(
    ['arrivedElevator'],
    'qualityCheckPending',
    () => true,
    'нельзя начать проверку качества до прибытия на элеватор',
    ['lab', 'elevator', 'operator'],
    'lab',
    'controlled-pilot',
    () => ({ hasQualityCheckStarted: true }),
  ),

  acceptQuality: T(
    ['qualityCheckPending'],
    'qualityAccepted',
    (ctx) => ctx.hasQualityCheckStarted,
    'нельзя принять качество без активной проверки качества',
    ['lab', 'operator'],
    'lab',
    'controlled-pilot',
  ),

  rejectQuality: T(
    ['qualityCheckPending'],
    'qualityRejected',
    (ctx) => ctx.hasQualityCheckStarted,
    'нельзя отклонить качество без активной проверки качества',
    ['lab', 'operator'],
    'lab',
    'controlled-pilot',
  ),

  attachLabResult: T(
    ['qualityCheckPending'],
    'qualityAccepted',
    (ctx) => ctx.hasQualityCheckStarted,
    'нельзя прикрепить результат лаборатории без начатой проверки качества',
    ['lab', 'operator'],
    'lab',
    'manual',
  ),

  markDocumentsPending: T(
    ['qualityAccepted', 'moneyReserveConfirmedManual', 'logisticsAssigned'],
    'documentsPending',
    (ctx) => ctx.hasDraftDeal,
    'нельзя начать оформление документов без черновика сделки',
    ['operator'],
    'deal',
    'manual',
  ),

  attachDealDocuments: T(
    ['qualityAccepted', 'documentsPending'],
    'documentsAttached',
    (ctx) => ctx.hasDraftDeal,
    'нельзя прикрепить документы без черновика сделки',
    ['operator', 'seller'],
    'deal',
    'manual',
    () => ({ hasDocumentsAttached: true }),
  ),

  markSdizRequired: T(
    ['documentsAttached', 'documentsPending'],
    'sdizRequired',
    (ctx) => ctx.hasDraftDeal,
    'нельзя отметить требование СДИЗ без черновика сделки',
    ['operator'],
    'deal',
    'manual',
  ),

  markSdizReadyManual: T(
    ['documentsAttached', 'sdizRequired'],
    'sdizReadyManual',
    (ctx) => ctx.hasDocumentsAttached,
    'нельзя подтвердить СДИЗ вручную без прикреплённых документов',
    ['operator'],
    'deal',
    'manual',
    () => ({ hasSdizReady: true }),
  ),

  requestReleaseAfterGates: {
    fromStates: ['sdizReadyManual', 'releaseRequested'],
    getToState: (ctx) => ctx.state === 'sdizReadyManual' ? 'releaseRequested' : 'releaseAllowed',
    guard: (ctx) => {
      if (ctx.state === 'sdizReadyManual') {
        return ctx.hasDocumentsAttached && ctx.hasSdizReady && ctx.hasMoneyReserveConfirmed;
      }
      return (
        ctx.hasMoneyReserveConfirmed &&
        ctx.hasDocumentsAttached &&
        ctx.hasSdizReady &&
        !ctx.hasOpenDispute
      );
    },
    getGuardReason: (ctx) => {
      if (!ctx.hasMoneyReserveConfirmed) return 'резерв денег не подтверждён';
      if (!ctx.hasDocumentsAttached) return 'документы не прикреплены';
      if (!ctx.hasSdizReady) return 'СДИЗ не подтверждён';
      if (ctx.hasOpenDispute) return 'есть открытый спор — нельзя выпустить деньги';
      return 'не все условия выполнены для выпуска денег';
    },
    allowedRoles: ['operator', 'bank'],
    scope: 'bank',
    mode: 'controlled-pilot',
    contextMutation: () => ({}),
  },

  blockReleaseBecauseGatesPending: T(
    ['sdizReadyManual', 'releaseRequested'],
    'releaseBlocked',
    () => true,
    '',
    ['operator', 'bank'],
    'bank',
    'controlled-pilot',
  ),

  resolveDispute: T(
    ['disputeOpen'],
    'disputeResolved',
    (ctx) => ctx.hasOpenDispute,
    'нет открытого спора для закрытия',
    ['operator', 'arbitrator'],
    'dispute',
    'controlled-pilot',
    () => ({ hasOpenDispute: false }),
  ),

  closeDeal: T(
    ['releaseAllowed', 'disputeResolved'],
    'dealClosed',
    (ctx) => !ctx.hasOpenDispute,
    'нельзя закрыть сделку при открытом споре',
    ['operator'],
    'deal',
    'controlled-pilot',
  ),
};

// ─── Public API ───────────────────────────────────────────────────────────────

export function applyExecutionAction(
  ctx: ExecutionContext,
  actionId: ExecutionActionId,
  actor: string = 'оператор',
  at: string = new Date().toISOString(),
): ExecutionTransitionResult {
  const transition = EXECUTION_TRANSITIONS[actionId];

  if (!transition.fromStates.includes(ctx.state)) {
    return {
      success: false,
      guardReason: `действие «${EXECUTION_ACTION_LABELS[actionId]}» недопустимо в состоянии «${EXECUTION_STATE_LABELS[ctx.state]}»`,
      actionId,
    };
  }

  if (!transition.guard(ctx)) {
    return {
      success: false,
      guardReason: transition.getGuardReason(ctx),
      actionId,
    };
  }

  const toState = transition.getToState(ctx);
  const record: ExecutionActionRecord = {
    actionId,
    at,
    fromState: ctx.state,
    toState,
    actor,
    note: `${EXECUTION_ACTION_LABELS[actionId]} · ${transition.mode}`,
    mode: transition.mode,
  };

  const newContext: ExecutionContext = {
    ...ctx,
    ...transition.contextMutation(ctx),
    state: toState,
    previousStateRef: ctx.state,
    actionLog: [record, ...ctx.actionLog],
  };

  return { success: true, context: newContext };
}

export function rollbackExecution(ctx: ExecutionContext): ExecutionContext | null {
  if (!ctx.previousStateRef) return null;
  const prev = ctx.previousStateRef;
  return {
    ...ctx,
    state: prev,
    previousStateRef: null,
    actionLog: ctx.actionLog.slice(1),
  };
}

export function availableActions(ctx: ExecutionContext): ExecutionActionId[] {
  return (Object.keys(EXECUTION_TRANSITIONS) as ExecutionActionId[]).filter((actionId) => {
    const transition = EXECUTION_TRANSITIONS[actionId];
    return transition.fromStates.includes(ctx.state) && transition.guard(ctx);
  });
}

export function blockedActionsInState(ctx: ExecutionContext): Array<{ actionId: ExecutionActionId; guardReason: string }> {
  return (Object.keys(EXECUTION_TRANSITIONS) as ExecutionActionId[])
    .filter((actionId) => {
      const transition = EXECUTION_TRANSITIONS[actionId];
      return transition.fromStates.includes(ctx.state) && !transition.guard(ctx);
    })
    .map((actionId) => ({
      actionId,
      guardReason: EXECUTION_TRANSITIONS[actionId].getGuardReason(ctx),
    }));
}

export function createInitialContext(hasAcceptedOffer: boolean = true): ExecutionContext {
  return {
    state: hasAcceptedOffer ? 'dealDraft' : 'offerDraft',
    previousStateRef: null,
    hasAcceptedOffer,
    hasDraftDeal: hasAcceptedOffer,
    hasMoneyReserveIntent: false,
    hasMoneyReserveConfirmed: false,
    hasLogisticsOrder: false,
    hasQualityCheckStarted: false,
    hasDocumentsAttached: false,
    hasSdizReady: false,
    hasOpenDispute: false,
    actionLog: [],
  };
}

export function mapSourceTruthToContext(sourceDeal: { status: string }): ExecutionContext {
  return {
    ...createInitialContext(true),
    state: mapSourceTruthToExecutionState(sourceDeal.status),
  };
}

export function executionActionSpec(actionId: ExecutionActionId) {
  const transition = EXECUTION_TRANSITIONS[actionId];
  return {
    actionId,
    label: EXECUTION_ACTION_LABELS[actionId],
    fromStates: transition.fromStates,
    allowedRoles: transition.allowedRoles,
    scope: transition.scope,
    mode: transition.mode,
  };
}

export function allExecutionActionSpecs() {
  return (Object.keys(EXECUTION_TRANSITIONS) as ExecutionActionId[]).map(executionActionSpec);
}
