import { createActionLogEntry, type PlatformActionLogEntry, type PlatformActionScope } from './action-log';
import { platformV7ActionMessages, type PlatformV7ActionMessageId } from './action-messages';

export type PlatformV7ExecutionMode = 'sandbox' | 'manual' | 'controlled-pilot' | 'live';
export type PlatformV7ExecutionRole = 'seller' | 'buyer' | 'operator' | 'logistics' | 'driver' | 'elevator' | 'lab';
export type PlatformV7ExecutionEntityType = 'lot' | 'offer' | 'deal' | 'money' | 'logistics' | 'document' | 'fieldEvent' | 'dispute';
export type PlatformV7SdizIssuedStatus = 'not_issued' | 'issued_manual_check' | 'issued_fgis_confirmed';
export type PlatformV7SdizSignedStatus = 'not_signed' | 'signed_manual_check' | 'signed_fgis_confirmed';
export type PlatformV7SdizTransferredStatus = 'not_transferred' | 'transferred_manual_check' | 'transferred_fgis_confirmed';
export type PlatformV7SdizRedeemedStatus = 'not_redeemed' | 'redeemed_awaiting_fgis_confirmation' | 'redeemed_fgis_confirmed' | 'refused_manual_check';
export type PlatformV7SdizRefusalStatus = 'none' | 'refusal_recorded_manual_check';
export type PlatformV7ManualReviewStatus = 'not_requested' | 'requested' | 'completed';

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
  readonly sdizIssuedStatus: PlatformV7SdizIssuedStatus;
  readonly sdizSignedStatus: PlatformV7SdizSignedStatus;
  readonly sdizTransferredStatus: PlatformV7SdizTransferredStatus;
  readonly sdizRedeemedStatus: PlatformV7SdizRedeemedStatus;
  readonly sdizRefusalStatus: PlatformV7SdizRefusalStatus;
  readonly sdizManualReviewStatus: PlatformV7ManualReviewStatus;
  readonly roleNotificationIds: readonly string[];
}

export interface PlatformV7ExecutionActionRequest {
  readonly actionId: PlatformV7ActionMessageId;
  readonly actorRole: PlatformV7ExecutionRole;
  readonly actorId?: string;
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
  readonly actionLabelRu?: string;
  readonly preconditions?: readonly string[];
  readonly previewImpact?: string;
  readonly statusBefore?: string;
  readonly statusAfter?: string;
  readonly moneyImpact?: string;
  readonly documentImpact?: string;
  readonly nextRoleTask?: string;
}

export interface PlatformV7ExecutionActionPreview {
  readonly actionId: PlatformV7ActionMessageId;
  readonly actionLabelRu: string;
  readonly actorRole: PlatformV7ExecutionRole;
  readonly actorId: string;
  readonly targetType: PlatformV7ExecutionEntityType;
  readonly targetId: string;
  readonly preconditions: readonly string[];
  readonly previewImpact: string;
  readonly statusBefore: string;
  readonly statusAfter: string;
  readonly moneyImpact?: string;
  readonly documentImpact?: string;
  readonly nextRoleTask?: string;
  readonly auditEvent: string;
}

export interface PlatformV7ExecutionActionReceipt {
  readonly receiptId: string;
  readonly actorRole: PlatformV7ExecutionRole;
  readonly actorId: string;
  readonly changedAt: string;
  readonly changed: string;
  readonly waitingFor: string;
  readonly nextRoleTask: string;
  readonly externalContour: string;
  readonly auditEventId: string;
}

export interface PlatformV7RoleNotification {
  readonly notificationId: string;
  readonly targetRole: PlatformV7ExecutionRole | 'bank' | 'compliance' | 'arbitrator' | 'support';
  readonly targetUserId: string;
  readonly linkedDealId: string;
  readonly text: string;
  readonly priority: 'low' | 'medium' | 'high' | 'critical';
  readonly dueAt: string;
  readonly actionLink: string;
  readonly createdByActionId: PlatformV7ActionMessageId;
  readonly readStatus: 'unread' | 'read';
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
  readonly preview: PlatformV7ExecutionActionPreview;
  readonly receipt: PlatformV7ExecutionActionReceipt;
  readonly roleNotifications: readonly PlatformV7RoleNotification[];
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
  sdizIssuedStatus: 'not_issued',
  sdizSignedStatus: 'not_signed',
  sdizTransferredStatus: 'not_transferred',
  sdizRedeemedStatus: 'not_redeemed',
  sdizRefusalStatus: 'none',
  sdizManualReviewStatus: 'not_requested',
  roleNotificationIds: [],
};

export const PLATFORM_V7_EXECUTION_ACTION_SPECS: Record<
  'submitSellerOffer' | 'acceptOffer' | 'rejectOffer' | 'sendCounterOffer' | 'createDraftDealFromOffer' | 'requestMoneyReserve' | 'assignLogistics' | 'attachDocument' | 'recordFieldEvent' | 'openDispute' | 'redeemSdiz' | 'refuseSdizRedemption' | 'sendSdizManualReview',
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
  redeemSdiz: {
    actionId: 'redeemSdiz',
    entityType: 'document',
    scope: 'deal',
    allowedRoles: ['buyer', 'operator'],
    mode: 'manual',
    successStateLabel: 'Погашение СДИЗ зафиксировано на ручной проверке',
    rollbackLabel: 'Отменить ручную отметку погашения СДИЗ',
    actionLabelRu: 'Погасить СДИЗ',
    preconditions: [
      'Сделка создана',
      'СДИЗ оформлен',
      'СДИЗ подписан',
      'СДИЗ передан покупателю',
      'Приёмка готова к ручной проверке',
    ],
    previewImpact: 'Покупатель фиксирует погашение СДИЗ в пилотном журнале. Автоматического подтверждения ФГИС нет.',
    statusBefore: 'СДИЗ передан покупателю, погашение не подтверждено',
    statusAfter: 'СДИЗ погашен покупателем · ожидает внешнее подтверждение ФГИС',
    moneyImpact: 'Деньги не готовы к выплате: банк получает только документный сигнал для проверки основания.',
    documentImpact: 'Документ СДИЗ получает статус ручной проверки погашения.',
    nextRoleTask: 'Банк проверяет документный пакет и ждёт подтверждение ФГИС/ручную отметку оператора.',
  },
  refuseSdizRedemption: {
    actionId: 'refuseSdizRedemption',
    entityType: 'document',
    scope: 'deal',
    allowedRoles: ['buyer', 'operator'],
    mode: 'manual',
    successStateLabel: 'Отказ от погашения СДИЗ зафиксирован',
    rollbackLabel: 'Отменить ручную отметку отказа от погашения',
    actionLabelRu: 'Зафиксировать отказ от погашения СДИЗ',
    preconditions: [
      'Сделка создана',
      'СДИЗ передан покупателю',
      'Покупатель указал основание отказа',
    ],
    previewImpact: 'Отказ блокирует выпуск денег и создаёт документный блокер для поддержки, комплаенса и возможного спора.',
    statusBefore: 'СДИЗ передан покупателю, отказ не зафиксирован',
    statusAfter: 'Отказ от погашения СДИЗ зафиксирован · ручная проверка',
    moneyImpact: 'Резерв остаётся на ручной проверке до обработки отказа и банкового основания.',
    documentImpact: 'СДИЗ переводится в ветку отказа/ручной проверки.',
    nextRoleTask: 'Поддержка снимает блокер, комплаенс проверяет основание, арбитр подключается при споре.',
  },
  sendSdizManualReview: {
    actionId: 'sendSdizManualReview',
    entityType: 'document',
    scope: 'deal',
    allowedRoles: ['buyer', 'operator'],
    mode: 'manual',
    successStateLabel: 'СДИЗ отправлен на ручную проверку',
    rollbackLabel: 'Отменить отправку СДИЗ на ручную проверку',
    actionLabelRu: 'Отправить СДИЗ на ручную проверку',
    preconditions: [
      'Сделка создана',
      'Есть СДИЗ или блокер СДИЗ',
    ],
    previewImpact: 'Создаётся задача оператору проверить статус СДИЗ во внешнем контуре или по документу пилота.',
    statusBefore: 'Статус СДИЗ требует проверки',
    statusAfter: 'СДИЗ на ручной проверке',
    moneyImpact: 'Выплата не разрешается до результата ручной проверки и банкового основания.',
    documentImpact: 'Документный gate остаётся блокирующим до результата проверки.',
    nextRoleTask: 'Оператор фиксирует основание проверки и передаёт результат банку/комплаенсу.',
  },
};

export function platformV7ExecutionActionSpec(actionId: PlatformV7ActionMessageId): PlatformV7ExecutionActionSpec | null {
  return actionId in PLATFORM_V7_EXECUTION_ACTION_SPECS
    ? PLATFORM_V7_EXECUTION_ACTION_SPECS[actionId as keyof typeof PLATFORM_V7_EXECUTION_ACTION_SPECS]
    : null;
}

const SDIZ_ACTION_IDS = ['redeemSdiz', 'refuseSdizRedemption', 'sendSdizManualReview'] as const satisfies readonly PlatformV7ActionMessageId[];

function isSdizAction(actionId: PlatformV7ActionMessageId): boolean {
  return (SDIZ_ACTION_IDS as readonly PlatformV7ActionMessageId[]).includes(actionId);
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

  if (isSdizAction(request.actionId) && !(state.dealId || state.draftDealId)) {
    return blocked(request, spec.entityType, mode, 'Действие по СДИЗ доступно только после создания сделки.');
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

  if ((request.actionId === 'redeemSdiz' || request.actionId === 'refuseSdizRedemption') && state.sdizIssuedStatus === 'not_issued') {
    return blocked(request, spec.entityType, mode, 'СДИЗ ещё не оформлен. Погашение или отказ фиксируются после оформления СДИЗ.');
  }

  if ((request.actionId === 'redeemSdiz' || request.actionId === 'refuseSdizRedemption') && state.sdizSignedStatus === 'not_signed') {
    return blocked(request, spec.entityType, mode, 'СДИЗ ещё не подписан продавцом.');
  }

  if ((request.actionId === 'redeemSdiz' || request.actionId === 'refuseSdizRedemption') && state.sdizTransferredStatus === 'not_transferred') {
    return blocked(request, spec.entityType, mode, 'СДИЗ ещё не передан покупателю.');
  }

  if (request.actionId === 'redeemSdiz' && state.sdizRedeemedStatus !== 'not_redeemed') {
    return blocked(request, spec.entityType, mode, 'Погашение СДИЗ уже зафиксировано или заменено отказом.');
  }

  if (request.actionId === 'redeemSdiz' && state.sdizRefusalStatus !== 'none') {
    return blocked(request, spec.entityType, mode, 'Нельзя погасить СДИЗ после зафиксированного отказа без отката.');
  }

  if (request.actionId === 'refuseSdizRedemption' && state.sdizRefusalStatus !== 'none') {
    return blocked(request, spec.entityType, mode, 'Отказ от погашения СДИЗ уже зафиксирован.');
  }

  if (request.actionId === 'sendSdizManualReview' && state.sdizManualReviewStatus === 'requested') {
    return blocked(request, spec.entityType, mode, 'СДИЗ уже находится на ручной проверке.');
  }

  return null;
}

export function previewPlatformV7ExecutionAction(
  state: PlatformV7ExecutionActionState,
  request: PlatformV7ExecutionActionRequest,
): PlatformV7ExecutionActionPreview | null {
  const spec = platformV7ExecutionActionSpec(request.actionId);
  const mode = request.mode ?? spec?.mode ?? 'controlled-pilot';
  if (!spec) return null;

  const actionLabelRu = spec.actionLabelRu ?? spec.successStateLabel;
  const statusBefore = spec.statusBefore ?? executionActionStateLabel(state, request.actionId);
  const statusAfter = spec.statusAfter ?? spec.successStateLabel;

  return {
    actionId: request.actionId,
    actionLabelRu,
    actorRole: request.actorRole,
    actorId: request.actorId ?? request.actorRole,
    targetType: spec.entityType,
    targetId: request.entityId,
    preconditions: spec.preconditions ?? ['роль имеет право на действие', 'выбран объект действия'],
    previewImpact: spec.previewImpact ?? `${spec.successStateLabel}. Режим: ${mode}.`,
    statusBefore,
    statusAfter,
    moneyImpact: spec.moneyImpact,
    documentImpact: spec.documentImpact,
    nextRoleTask: spec.nextRoleTask,
    auditEvent: `${actionLabelRu}. ${statusBefore} → ${statusAfter}. Режим: ${mode}.`,
  };
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
  const mutatedState = mutateState(state, request, timestamp);
  const roleNotifications = buildRoleNotifications(mutatedState, request, timestamp);
  const nextStateRef = {
    ...mutatedState,
    roleNotificationIds: unique([
      ...mutatedState.roleNotificationIds,
      ...roleNotifications.map((notification) => notification.notificationId),
    ]),
  };
  const messages = platformV7ActionMessages(request.actionId);
  const preview = previewPlatformV7ExecutionAction(state, request);
  const auditCopy = preview?.auditEvent ?? `${spec.successStateLabel}. Режим: ${mode}.`;
  const logEntry = createActionLogEntry({
    scope: spec.scope,
    status: 'success',
    objectId: request.entityId,
    action: request.actionId,
    message: auditCopy,
    actor: request.actorId ?? request.actorRole,
    at: timestamp,
  });
  const receipt: PlatformV7ExecutionActionReceipt = {
    receiptId: `${request.actionId}:${request.entityId}:${timestamp}`,
    actorRole: request.actorRole,
    actorId: request.actorId ?? request.actorRole,
    changedAt: timestamp,
    changed: preview?.statusAfter ?? spec.successStateLabel,
    waitingFor: preview?.nextRoleTask ?? 'Следующая задача определяется журналом сделки.',
    nextRoleTask: preview?.nextRoleTask ?? 'Проверить следующий блокер сделки.',
    externalContour: mode === 'manual' ? 'ручная проверка / ожидает внешнее подтверждение' : 'контур исполнения без заявления о внешней интеграции',
    auditEventId: logEntry.id,
  };

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
    preview: preview ?? {
      actionId: request.actionId,
      actionLabelRu: spec.successStateLabel,
      actorRole: request.actorRole,
      actorId: request.actorId ?? request.actorRole,
      targetType: spec.entityType,
      targetId: request.entityId,
      preconditions: [],
      previewImpact: spec.successStateLabel,
      statusBefore: '',
      statusAfter: spec.successStateLabel,
      auditEvent: auditCopy,
    },
    receipt,
    roleNotifications,
    logEntry,
  };
}

export function rollbackPlatformV7ExecutionAction(result: PlatformV7ExecutionActionApplied): PlatformV7ExecutionActionState {
  return result.previousStateRef;
}

function buildRoleNotifications(
  state: PlatformV7ExecutionActionState,
  request: PlatformV7ExecutionActionRequest,
  timestamp: string,
): PlatformV7RoleNotification[] {
  const dealId = state.dealId ?? state.draftDealId ?? request.entityId;

  switch (request.actionId) {
    case 'submitSellerOffer':
      return [notification(request, timestamp, dealId, 'buyer', 'Проверьте ставку продавца и примите, отклоните или отправьте встречное предложение.', 'medium', '/platform-v7/buyer-lot')];
    case 'acceptOffer':
      return [notification(request, timestamp, dealId, 'operator', 'Ставка принята. Создайте черновик сделки и проверьте перенос условий.', 'high', '/platform-v7/offer-to-deal')];
    case 'rejectOffer':
      return [notification(request, timestamp, dealId, 'seller', 'Ставка отклонена покупателем. Проверьте условия и подготовьте новую ставку.', 'medium', '/platform-v7/seller/offers')];
    case 'sendCounterOffer':
      return [notification(request, timestamp, dealId, 'operator', 'Встречное предложение требует фиксации версии условий и следующего владельца.', 'medium', '/platform-v7/offer-log')];
    case 'createDraftDealFromOffer':
      return [notification(request, timestamp, dealId, 'buyer', 'Черновик сделки создан. Запросите резерв денег в банковском контуре проверки.', 'high', '/platform-v7/buyer')];
    case 'requestMoneyReserve':
      return [notification(request, timestamp, dealId, 'bank', 'Намерение резерва создано. Проверьте KYB, 115-ФЗ, документы и банковое основание.', 'critical', '/platform-v7/bank')];
    case 'assignLogistics':
      return [notification(request, timestamp, dealId, 'driver', 'Рейс подготовлен. Примите рейс и подтвердите прибытие по полевому экрану.', 'high', '/platform-v7/driver/field')];
    case 'attachDocument':
      return [notification(request, timestamp, dealId, 'bank', 'К сделке приложен документ. Проверьте, влияет ли он на банковое основание.', 'medium', '/platform-v7/bank')];
    case 'recordFieldEvent':
      return [notification(request, timestamp, dealId, 'elevator', 'Полевое событие зафиксировано. Проверьте прибытие, вес, пломбу или акт.', 'high', '/platform-v7/elevator')];
    case 'openDispute':
      return [notification(request, timestamp, dealId, 'arbitrator', 'Спор открыт. Проверьте evidence pack, тип спора, сумму и SLA.', 'critical', '/platform-v7/arbitrator')];
    case 'redeemSdiz':
      return [notification(request, timestamp, dealId, 'bank', 'Покупатель зафиксировал погашение СДИЗ. Проверьте ручной статус ФГИС и документный пакет.', 'high', '/platform-v7/bank')];
    case 'refuseSdizRedemption':
      return [
        notification(request, timestamp, dealId, 'support', 'Покупатель зафиксировал отказ от погашения СДИЗ. Снимите блокер и SLA.', 'critical', '/platform-v7/support/operator'),
        notification(request, timestamp, dealId, 'compliance', 'Отказ от погашения СДИЗ требует проверки основания и полномочий.', 'high', '/platform-v7/compliance'),
      ];
    case 'sendSdizManualReview':
      return [notification(request, timestamp, dealId, 'operator', 'СДИЗ отправлен на ручную проверку. Зафиксируйте источник и результат проверки.', 'high', '/platform-v7/operator')];
    default:
      return [notification(request, timestamp, dealId, 'operator', 'Действие выполнено. Проверьте следующий блокер сделки.', 'medium', '/platform-v7/operator')];
  }
}

function notification(
  request: PlatformV7ExecutionActionRequest,
  timestamp: string,
  dealId: string,
  targetRole: PlatformV7RoleNotification['targetRole'],
  text: string,
  priority: PlatformV7RoleNotification['priority'],
  actionLink: string,
): PlatformV7RoleNotification {
  const dueAt = new Date(new Date(timestamp).getTime() + notificationSlaHours(priority) * 60 * 60 * 1000).toISOString();

  return {
    notificationId: `${request.actionId}:${request.entityId}:${targetRole}:${timestamp}`,
    targetRole,
    targetUserId: `${targetRole}-pilot-user`,
    linkedDealId: dealId,
    text,
    priority,
    dueAt,
    actionLink,
    createdByActionId: request.actionId,
    readStatus: 'unread',
  };
}

function notificationSlaHours(priority: PlatformV7RoleNotification['priority']): number {
  if (priority === 'critical') return 2;
  if (priority === 'high') return 6;
  if (priority === 'medium') return 24;
  return 72;
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
    case 'redeemSdiz':
      if (state.sdizRedeemedStatus === 'redeemed_fgis_confirmed') return 'Погашение подтверждено ФГИС';
      if (state.sdizRedeemedStatus === 'redeemed_awaiting_fgis_confirmation') return 'Погашение на ручной проверке';
      if (state.sdizRedeemedStatus === 'refused_manual_check') return 'Есть отказ от погашения';
      return 'СДИЗ не погашен';
    case 'refuseSdizRedemption':
      return state.sdizRefusalStatus === 'none' ? 'Отказ не зафиксирован' : 'Отказ на ручной проверке';
    case 'sendSdizManualReview':
      return state.sdizManualReviewStatus === 'requested' ? 'Ручная проверка запрошена' : 'Нет ручной проверки';
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
    case 'redeemSdiz':
      return {
        ...state,
        documentIds: unique([...state.documentIds, `${token}:sdiz-redeemed-manual-check`]),
        sdizRedeemedStatus: 'redeemed_awaiting_fgis_confirmation',
        sdizManualReviewStatus: 'requested',
        roleNotificationIds: unique([
          ...state.roleNotificationIds,
          `bank:${state.dealId ?? state.draftDealId ?? token}:sdiz-redeemed-check`,
          `seller:${state.dealId ?? state.draftDealId ?? token}:sdiz-redeemed-check`,
        ]),
      };
    case 'refuseSdizRedemption':
      return {
        ...state,
        documentIds: unique([...state.documentIds, `${token}:sdiz-refusal-manual-check`]),
        sdizRedeemedStatus: 'refused_manual_check',
        sdizRefusalStatus: 'refusal_recorded_manual_check',
        sdizManualReviewStatus: 'requested',
        roleNotificationIds: unique([
          ...state.roleNotificationIds,
          `support:${state.dealId ?? state.draftDealId ?? token}:sdiz-refusal`,
          `compliance:${state.dealId ?? state.draftDealId ?? token}:sdiz-refusal`,
        ]),
      };
    case 'sendSdizManualReview':
      return {
        ...state,
        sdizManualReviewStatus: 'requested',
        roleNotificationIds: unique([
          ...state.roleNotificationIds,
          `operator:${state.dealId ?? state.draftDealId ?? token}:sdiz-manual-review`,
        ]),
      };
    default:
      return state;
  }
}

function unique(values: readonly string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}
