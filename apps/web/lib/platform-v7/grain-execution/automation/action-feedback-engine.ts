import type { AuditEvent, MoneyProjection, NextAction, UserRole } from '../types';

export interface ActionFeedbackPreview {
  readonly actionId: string;
  readonly title: string;
  readonly statusText: string;
  readonly auditEvent: Pick<AuditEvent, 'entityType' | 'entityId' | 'actorRole' | 'action' | 'reason'>;
  readonly externalConfirmationText: string;
}

const actionStatusText: Record<NextAction['actionType'], string> = {
  create_batch: 'Черновик партии будет создан в тестовом контуре.',
  link_fgis: 'Статус ФГИС / СДИЗ уйдёт на ручную проверку.',
  attach_quality: 'Анализ качества будет добавлен к партии как основание готовности.',
  publish_lot: 'Лот будет подготовлен к публикации после проверки готовности партии.',
  create_rfq: 'Закупочный запрос будет создан как структурированная потребность покупателя.',
  accept_offer: 'Оффер будет зафиксирован как основание будущей сделки.',
  create_deal: 'Сделка будет создана только после проверки условий сторон.',
  reserve_money: 'Запрос резерва будет отправлен в банковый контур после подтверждения условий.',
  prepare_sdiz: 'СДИЗ будет переведён в следующий проверочный статус.',
  assign_logistics: 'Заявка на рейс будет передана в логистический контур.',
  capture_weight: 'Вес будет зафиксирован как доказательство приёмки.',
  take_sample: 'Проба будет зафиксирована в цепочке лабораторных доказательств.',
  upload_document: 'Документ будет добавлен в пакет допуска сделки.',
  resolve_blocker: 'Причина остановки будет взята в работу с записью в журнале.',
  request_support: 'Будет создано обращение в центр поддержки исполнения сделки.',
  open_dispute: 'Спор будет открыт на конкретное основание и сумму влияния.',
  approve_release: 'Будет подготовлено основание для банковского подтверждения выпуска денег.',
};

function canSeeActionFeedback(role: UserRole, action: NextAction): boolean {
  if (role === 'admin' || role === 'operator') return true;
  if (role === 'driver') return action.role === 'driver' && ['capture_weight', 'upload_document', 'request_support'].includes(action.actionType);
  if (role === 'investor') return false;
  if (role === 'bank') return action.role === 'bank' || ['approve_release', 'reserve_money', 'upload_document'].includes(action.actionType);
  return action.role === role;
}

function moneyProjectionMismatch(moneyProjection?: MoneyProjection): boolean {
  if (!moneyProjection) return false;
  const reserved = moneyProjection.reservedAmount.value;
  const parts = moneyProjection.readyToReleaseAmount.value + moneyProjection.heldAmount.value + moneyProjection.manualReviewAmount.value + moneyProjection.releasedAmount.value;
  return Math.abs(reserved - parts) > 0.01;
}

export function createActionFeedbackPreview(action: NextAction, moneyProjection?: MoneyProjection): ActionFeedbackPreview {
  const isMoneyAction = action.actionType === 'approve_release' || action.actionType === 'reserve_money';
  const hasMoneyMismatch = isMoneyAction && moneyProjectionMismatch(moneyProjection);
  const statusText = hasMoneyMismatch
    ? 'Денежное действие закрыто: суммы резерва, выпуска, удержания и ручной проверки не сходятся.'
    : action.disabled
      ? action.disabledReason ?? 'Действие закрыто до выполнения условий.'
      : actionStatusText[action.actionType];

  return {
    actionId: action.id,
    title: action.disabled || hasMoneyMismatch ? 'Действие пока закрыто' : 'Действие принято в работу',
    statusText,
    auditEvent: {
      entityType: 'next_action',
      entityId: action.id,
      actorRole: action.role,
      action: action.title,
      reason: hasMoneyMismatch
        ? 'Перед действием нужна сверка денежных сумм.'
        : action.requiresReason
          ? 'Действие требует основания и будет сохранено в журнале после подтверждения.'
          : 'Действие сохранено как controlled-pilot событие интерфейса.',
    },
    externalConfirmationText:
      action.actionType === 'approve_release' || action.actionType === 'reserve_money'
        ? 'Внешнее банковое подтверждение не имитируется. Нужен ответ банка или ручная сверка.'
        : 'Внешнее подтверждение не имитируется. Показан внутренний след действия.',
  };
}

export function createActionFeedbackPreviewsForRole(actions: readonly NextAction[], role: UserRole, moneyProjection?: MoneyProjection): ActionFeedbackPreview[] {
  return actions.filter((action) => canSeeActionFeedback(role, action)).map((action) => createActionFeedbackPreview(action, moneyProjection));
}
