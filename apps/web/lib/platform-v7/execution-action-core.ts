import { createActionLogEntry, type PlatformActionLogEntry, type PlatformActionScope } from './action-log';
import { platformV7ActionMessages, type PlatformV7ActionMessageId } from './action-messages';

export type PlatformV7ExecutionMode = 'sandbox' | 'manual' | 'controlled-pilot' | 'live';
export type PlatformV7ExecutionRole = 'seller' | 'buyer' | 'operator' | 'logistics' | 'driver' | 'elevator' | 'lab';
export type PlatformV7ExecutionEntityType = 'lot' | 'offer' | 'deal' | 'money' | 'logistics' | 'document' | 'fieldEvent' | 'dispute';

export interface PlatformV7ExecutionActionState {
  readonly lotId: string | null;
  readonly offerId: string | null;
  readonly dealId: string | null;
  readonly submittedOfferIds: readonly string[];
  readonly acceptedOfferId: string | null;
  readonly rejectedOfferIds: readonly string[];
  readonly counterOfferIds: readonly string[];
  readonly draftDealId: string | null;
  readonly moneyReserveIntentId: string | null;
  readonly logisticsOrderId: string | null;
  readonly documentIds: readonly string[];
  readonly fieldEventIds: readonly string[];
  readonly disputeId: string | null;
}

export interface PlatformV7ExecutionActionRequest {
  readonly actionId: PlatformV7ActionMessageId;
  readonly actorRole: PlatformV7ExecutionRole;
  readonly entityId: string;
  readonly mode?: PlatformV7ExecutionMode;
}

export interface PlatformV7ExecutionActionSpec {
  readonly actionId: PlatformV7ActionMessageId;
  readonly entityType: PlatformV7ExecutionEntityType;
  readonly scope: PlatformActionScope;
  readonly allowedRoles: readonly PlatformV7ExecutionRole[];
  readonly mode: PlatformV7ExecutionMode;
  readonly successStateLabel: string;
  readonly rollbackLabel: string;
}

export interface PlatformV7ExecutionActionBlocked {
  readonly status: 'blocked';
  readonly actionId: PlatformV7ActionMessageId;
  readonly entityType: PlatformV7ExecutionEntityType;
  readonly entityId: string;
  readonly actorRole: PlatformV7ExecutionRole;
  readonly mode: PlatformV7ExecutionMode;
  readonly disabledReason: string;
}

export interface PlatformV7ExecutionActionApplied {
  readonly status: 'success';
  readonly actionId: PlatformV7ActionMessageId;
  readonly entityType: PlatformV7ExecutionEntityType;
  readonly entityId: string;
  readonly actorRole: PlatformV7ExecutionRole;
  readonly mode: PlatformV7ExecutionMode;
  readonly previousStateRef: PlatformV7ExecutionActionState;
  readonly nextStateRef: PlatformV7ExecutionActionState;
  readonly rollbackRef: string;
  readonly timestamp: string;
  readonly toastCopy: string;
  readonly auditCopy: string;
  readonly logEntry: PlatformActionLogEntry;
}

export type PlatformV7ExecutionActionResult = PlatformV7ExecutionActionBlocked | PlatformV7ExecutionActionApplied;

export const PLATFORM_V7_INITIAL_EXECUTION_ACTION_STATE: PlatformV7ExecutionActionState = {
  lotId: 'LOT-2403',
  offerId: 'OFFER-2403-A',
  dealId: null,
  submittedOfferIds: [],
  acceptedOfferId: null,
  rejectedOfferIds: [],
  counterOfferIds: [],
  draftDealId: null,
  moneyReserveIntentId: null,
  logisticsOrderId: null,
  documentIds: [],
  fieldEventIds: [],
  disputeId: null,
};

export const PLATFORM_V7_EXECUTION_ACTION_SPECS: Record<
  'submitSellerOffer' | 'acceptOffer' | 'rejectOffer' | 'sendCounterOffer' | 'createDraftDealFromOffer' | 'requestMoneyReserve' | 'assignLogistics' | 'attachDocument' | 'recordFieldEvent' | 'openDispute',
  PlatformV7ExecutionActionSpec
> = {
  submitSellerOffer: {
    actionId: 'submitSellerOffer',
    entityType: 'offer',
    scope: 'lot',
    allowedRoles: ['seller'],
    mode: 'controlled-pilot',
    successStateLabel: 'Ставка продавца отправлена',
    rollbackLabel: 'Отменить отправку ставки',
  },
  acceptOffer: {
    actionId: 'acceptOffer',
    entityType: 'offer',
    scope: 'lot',
    allowedRoles: ['buyer'],
    mode: 'controlled-pilot',
    successStateLabel: 'Ставка принята',
    rollbackLabel: 'Отменить принятие ставки',
  },
  rejectOffer: {
    actionId: 'rejectOffer',
    entityType: 'offer',
    scope: 'lot',
    allowedRoles: ['buyer'],
    mode: 'controlled-pilot',
    successStateLabel: 'Ставка отклонена',
    rollbackLabel: 'Вернуть ставку в активные',
  },
  sendCounterOffer: {
    actionId: 'sendCounterOffer',
    entityType: 'offer',
    scope: 'lot',
    allowedRoles: ['buyer', 'seller'],
    mode: 'controlled-pilot',
    successStateLabel: 'Встречное предложение отправлено',
    rollbackLabel: 'Отменить встречное предложение',
  },
  createDraftDealFromOffer: {
    actionId: 'createDraftDealFromOffer',
    entityType: 'deal',
    scope: 'deal',
    allowedRoles: ['buyer', 'seller', 'operator'],
    mode: 'controlled-pilot',
    successStateLabel: 'Черновик сделки создан',
    rollbackLabel: 'Удалить черновик сделки',
  },
  requestMoneyReserve: {
    actionId: 'requestMoneyReserve',
    entityType: 'money',
    scope: 'bank',
    allowedRoles: ['buyer', 'operator'],
    mode: 'controlled-pilot',
    successStateLabel: 'Намерение резерва денег создано',
    rollbackLabel: 'Отменить намерение резерва',
  },
  assignLogistics: {
    actionId: 'assignLogistics',
    entityType: 'logistics',
    scope: 'logistics',
    allowedRoles: ['operator', 'logistics'],
    mode: 'manual',
    successStateLabel: 'Логистика назначена',
    rollbackLabel: 'Снять назначение логистики',
  },
  attachDocument: {
    actionId: 'attachDocument',
    entityType: 'document',
    scope: 'deal',
    allowedRoles: ['seller', 'buyer', 'operator'],
    mode: 'manual',
    successStateLabel: 'Внутренний документ приложен',
    rollbackLabel: 'Удалить внутренний документ',
  },
  recordFieldEvent: {
    actionId: 'recordFieldEvent',
    entityType: 'fieldEvent',
    scope: 'logistics',
    allowedRoles: ['driver', 'operator', 'elevator', 'logistics'],
    mode: 'manual',
    successStateLabel: 'Полевое событие зафиксировано',
    rollbackLabel: 'Удалить полевое событие',
  },
  openDispute: {
    actionId: 'openDispute',
    entityType: 'dispute',
    scope: 'dispute',
    allowedRoles: ['buyer', 'seller', 'operator'],
    mode: 'controlled-pilot',
    successStateLabel: 'Спор открыт',
    rollbackLabel: 'Закрыть созданный спор',
  },
};

export function platformV7ExecutionActionSpec(actionId: PlatformV7ActionMessageId): PlatformV7ExecutionActionSpec | null {
  return actionId in PLATFORM_V7_EXECUTION_ACTION_SPECS
    ? PLATFORM_V7_EXECUTION_ACTION_SPECS[actionId as keyof typeof PLATFORM_V7_EXECUTION_ACTION_SPECS]
    : null;
}

export function guardPlatformV7ExecutionAction(
  state: PlatformV7ExecutionActionState,
  request: PlatformV7ExecutionActionRequest,
): PlatformV7ExecutionActionBlocked | null {
  const spec = platformV7ExecutionActionSpec(request.actionId);
  const mode = request.mode ?? spec?.mode ?? 'controlled-pilot';

  if (!spec) {
    return blocked(request, 'deal', mode, 'Действие не входит в первый E4 action wiring slice.');
  }

  if (!spec.allowedRoles.includes(request.actorRole)) {
    return blocked(request, spec.entityType, mode, 'У роли нет права выполнить это действие.');
  }

  if (!request.entityId.trim()) {
    return blocked(request, spec.entityType, mode, 'Не выбран объект действия.');
  }

  if ((request.actionId === 'submitSellerOffer' || request.actionId === 'acceptOffer' || request.actionId === 'rejectOffer' || request.actionId === 'sendCounterOffer') && !state.offerId) {
    return blocked(request, spec.entityType, mode, 'Нет активной ставки.');
  }

  if (request.actionId === 'submitSellerOffer' && state.submittedOfferIds.includes(request.entityId)) {
    return blocked(request, spec.entityType, mode, 'Ставка уже отправлена. Повторная отправка заблокирована.');
  }

  if (request.actionId === 'acceptOffer' && state.acceptedOfferId) {
    return blocked(request, spec.entityType, mode, 'Ставка уже принята. Сначала откати предыдущее принятие.');
  }

  if (request.actionId === 'rejectOffer' && state.rejectedOfferIds.includes(request.entityId)) {
    return blocked(request, spec.entityType, mode, 'Ставка уже отклонена.');
  }

  if (request.actionId === 'createDraftDealFromOffer' && !state.acceptedOfferId) {
    return blocked(request, spec.entityType, mode, 'Черновик сделки можно создать только после принятия ставки.');
  }

  if (request.actionId === 'createDraftDealFromOffer' && state.draftDealId) {
    return blocked(request, spec.entityType, mode, 'Черновик сделки уже создан.');
  }

  if (request.actionId === 'requestMoneyReserve' && !state.draftDealId) {
    return blocked(request, spec.entityType, mode, 'Резерв денег доступен только после создания черновика сделки.');
  }

  if (request.actionId === 'requestMoneyReserve' && state.moneyReserveIntentId) {
    return blocked(request, spec.entityType, mode, 'Намерение резерва уже создано.');
  }

  if (request.actionId === 'assignLogistics' && !state.moneyReserveIntentId) {
    return blocked(request, spec.entityType, mode, 'Логистика назначается после намерения резерва денег или ручного override.');
  }

  if (request.actionId === 'attachDocument' && !state.draftDealId) {
    return blocked(request, spec.entityType, mode, 'Документ можно приложить только к черновику или сделке.');
  }

  if (request.actionId === 'recordFieldEvent' && !state.logisticsOrderId) {
    return blocked(request, spec.entityType, mode, 'Полевое событие требует назначенной логистики.');
  }

  if (request.actionId === 'openDispute' && !state.draftDealId) {
    return blocked(request, spec.entityType, mode, 'Спор можно открыть только по созданной сделке или черновику сделки.');
  }

  if (request.actionId === 'openDispute' && state.disputeId) {
    return blocked(request, spec.entityType, mode, 'По этой сделке уже открыт спор.');
  }

  return null;
}

export function applyPlatformV7ExecutionAction(
  state: PlatformV7ExecutionActionState,
  request: PlatformV7ExecutionActionRequest,
  now: () => string = () => new Date().toISOString(),
): PlatformV7ExecutionActionResult {
  const spec = platformV7ExecutionActionSpec(request.actionId);
  const mode = request.mode ?? spec?.mode ?? 'controlled-pilot';
  const guard = guardPlatformV7ExecutionAction(state, request);

  if (guard) return guard;
  if (!spec) return blocked(request, 'deal', mode, 'Действие не найдено.');

  const timestamp = now();
  const nextStateRef = mutateState(state, request, timestamp);
  const messages = platformV7ActionMessages(request.actionId);
  const auditCopy = `${spec.successStateLabel}. Режим: ${mode}.`;
  const logEntry = createActionLogEntry({
    scope: spec.scope,
    status: 'success',
    objectId: request.entityId,
    action: request.actionId,
    message: auditCopy,
    actor: request.actorRole,
    at: timestamp,
  });

  return {
    status: 'success',
    actionId: request.actionId,
    entityType: spec.entityType,
    entityId: request.entityId,
    actorRole: request.actorRole,
    mode,
    previousStateRef: state,
    nextStateRef,
    rollbackRef: `${request.actionId}:${request.entityId}:${timestamp}`,
    timestamp,
    toastCopy: `${request.entityId}: ${messages.success}`,
    auditCopy,
    logEntry,
  };
}

export function rollbackPlatformV7ExecutionAction(result: PlatformV7ExecutionActionApplied): PlatformV7ExecutionActionState {
  return result.previousStateRef;
}

export function executionActionStateLabel(state: PlatformV7ExecutionActionState, actionId: PlatformV7ActionMessageId): string {
  switch (actionId) {
    case 'submitSellerOffer':
      return state.submittedOfferIds.length > 0 ? 'Ставка отправлена' : 'Не отправлена';
    case 'acceptOffer':
      return state.acceptedOfferId ? 'Принята' : 'Не принята';
    case 'rejectOffer':
      return state.rejectedOfferIds.length > 0 ? 'Есть отклонение' : 'Нет отклонений';
    case 'sendCounterOffer':
      return state.counterOfferIds.length > 0 ? 'Встречное отправлено' : 'Нет встречного';
    case 'createDraftDealFromOffer':
      return state.draftDealId ?? 'Черновик не создан';
    case 'requestMoneyReserve':
      return state.moneyReserveIntentId ? 'Резерв намерен' : 'Резерв не запрошен';
    case 'assignLogistics':
      return state.logisticsOrderId ? 'Логистика назначена' : 'Логистика не назначена';
    case 'attachDocument':
      return state.documentIds.length > 0 ? `${state.documentIds.length} док.` : 'Нет документов';
    case 'recordFieldEvent':
      return state.fieldEventIds.length > 0 ? `${state.fieldEventIds.length} событий` : 'Нет событий';
    case 'openDispute':
      return state.disputeId ? 'Спор открыт' : 'Спора нет';
    default:
      return '—';
  }
}

function blocked(
  request: PlatformV7ExecutionActionRequest,
  entityType: PlatformV7ExecutionEntityType,
  mode: PlatformV7ExecutionMode,
  disabledReason: string,
): PlatformV7ExecutionActionBlocked {
  return {
    status: 'blocked',
    actionId: request.actionId,
    entityType,
    entityId: request.entityId,
    actorRole: request.actorRole,
    mode,
    disabledReason,
  };
}

function mutateState(
  state: PlatformV7ExecutionActionState,
  request: PlatformV7ExecutionActionRequest,
  timestamp: string,
): PlatformV7ExecutionActionState {
  const token = request.entityId.trim() || `${request.actionId}-${timestamp}`;

  switch (request.actionId) {
    case 'submitSellerOffer':
      return { ...state, submittedOfferIds: unique([...state.submittedOfferIds, token]) };
    case 'acceptOffer':
      return { ...state, acceptedOfferId: token, rejectedOfferIds: state.rejectedOfferIds.filter((id) => id !== token) };
    case 'rejectOffer':
      return { ...state, rejectedOfferIds: unique([...state.rejectedOfferIds, token]), acceptedOfferId: state.acceptedOfferId === token ? null : state.acceptedOfferId };
    case 'sendCounterOffer':
      return { ...state, counterOfferIds: unique([...state.counterOfferIds, token]) };
    case 'createDraftDealFromOffer':
      return { ...state, dealId: token, draftDealId: token };
    case 'requestMoneyReserve':
      return { ...state, moneyReserveIntentId: token };
    case 'assignLogistics':
      return { ...state, logisticsOrderId: token };
    case 'attachDocument':
      return { ...state, documentIds: unique([...state.documentIds, token]) };
    case 'recordFieldEvent':
      return { ...state, fieldEventIds: unique([...state.fieldEventIds, token]) };
    case 'openDispute':
      return { ...state, disputeId: token };
    default:
      return state;
  }
}

function unique(values: readonly string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}
