export type WorkflowAction = {
  id: string;
  label: string;
  description: string;
  tone: 'primary' | 'secondary' | 'danger';
  nextStatus?: string;
};

export type WorkflowPolicy = {
  primary: WorkflowAction | null;
  secondary: WorkflowAction[];
  blockedReason?: string;
};

function unique<T extends { id: string }>(items: T[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

export function getFinanceApplicationPolicy(status: string): WorkflowPolicy {
  const normalized = String(status || '').trim().toUpperCase();
  switch (normalized) {
    case 'DRAFT':
      return {
        primary: { id: 'submit', label: 'Отправить в review', description: 'Пакет собран и заявка может уйти в рабочий review.', tone: 'primary', nextStatus: 'SUBMITTED' },
        secondary: [],
      };
    case 'SUBMITTED':
      return {
        primary: { id: 'startReview', label: 'Взять в review', description: 'Начать реальный разбор документов, лимитов и рисков.', tone: 'primary', nextStatus: 'UNDER_REVIEW' },
        secondary: [{ id: 'reopenDraft', label: 'Вернуть в draft', description: 'Вернуть заявку на доработку пакета.', tone: 'secondary', nextStatus: 'DRAFT' }],
      };
    case 'UNDER_REVIEW':
      return {
        primary: { id: 'approve', label: 'Одобрить', description: 'Перевести заявку в approved после положительного review.', tone: 'primary', nextStatus: 'APPROVED' },
        secondary: [
          { id: 'requestLimitReview', label: 'Отправить на limit review', description: 'Вынести заявку на отдельное лимитное решение.', tone: 'secondary', nextStatus: 'LIMIT_REVIEW' },
          { id: 'decline', label: 'Отклонить', description: 'Закрыть заявку с reason code.', tone: 'danger', nextStatus: 'DECLINED' },
        ],
      };
    case 'LIMIT_REVIEW':
      return {
        primary: { id: 'approve', label: 'Одобрить после limit review', description: 'Вернуть заявку в approved после лимитного решения.', tone: 'primary', nextStatus: 'APPROVED' },
        secondary: [{ id: 'decline', label: 'Отклонить', description: 'Снять заявку после лимитного review.', tone: 'danger', nextStatus: 'DECLINED' }],
      };
    case 'APPROVED':
      return {
        primary: { id: 'fund', label: 'Перевести в funded', description: 'Перевести заявку в funded после реального readiness waterfall.', tone: 'primary', nextStatus: 'FUNDED' },
        secondary: [
          { id: 'reopenReview', label: 'Вернуть в review', description: 'Нужен повторный пересмотр заявки и blockers.', tone: 'secondary', nextStatus: 'UNDER_REVIEW' },
          { id: 'decline', label: 'Снять одобрение', description: 'Откатить заявку и зафиксировать причину отказа.', tone: 'danger', nextStatus: 'DECLINED' },
        ],
      };
    case 'FUNDED':
      return {
        primary: null,
        secondary: [{ id: 'reopenReview', label: 'Открыть повторный review', description: 'Использовать только при ошибке или reconciliation.', tone: 'secondary', nextStatus: 'UNDER_REVIEW' }],
        blockedReason: 'Финзаявка уже funded. Дальше двигаются только release steps и закрытие хвостов.',
      };
    case 'DECLINED':
      return {
        primary: { id: 'reopenDraft', label: 'Вернуть в draft', description: 'Перезапустить заявку после исправления пакета.', tone: 'primary', nextStatus: 'DRAFT' },
        secondary: [],
      };
    default:
      return { primary: null, secondary: [], blockedReason: 'Для этого статуса policy не определена.' };
  }
}

export function mapFinanceInputToNextStatus(input: string, currentStatus: string): string | null {
  const value = String(input || '').trim();
  if (!value) return null;
  const normalized = value.toUpperCase();
  const legacyStatusMap: Record<string, string> = {
    DRAFT: 'DRAFT',
    SUBMITTED: 'SUBMITTED',
    UNDER_REVIEW: 'UNDER_REVIEW',
    LIMIT_REVIEW: 'LIMIT_REVIEW',
    APPROVED: 'APPROVED',
    FUNDED: 'FUNDED',
    DECLINED: 'DECLINED',
    SUBMIT: 'SUBMITTED',
    STARTREVIEW: 'UNDER_REVIEW',
    APPROVE: 'APPROVED',
    FUND: 'FUNDED',
    DECLINE: 'DECLINED',
    REOPENDRAFT: 'DRAFT',
    REOPENREVIEW: 'UNDER_REVIEW',
    REQUESTLIMITREVIEW: 'LIMIT_REVIEW',
  };
  return legacyStatusMap[normalized] || null;
}

export function getQueueSlotPolicy(status: string): WorkflowPolicy {
  const normalized = String(status || '').toUpperCase();
  switch (normalized) {
    case 'PLANNED':
    case 'BOOKED':
      return {
        primary: { id: 'gateIn', label: 'Открыть gate-in', description: 'Машина прибыла и должна зайти в физический контур площадки.', tone: 'primary', nextStatus: 'AT_GATE' },
        secondary: [{ id: 'rebook', label: 'Перенести слот', description: 'Изменить окно при риске no-show или ETA drift.', tone: 'secondary', nextStatus: 'REBOOKED' }],
      };
    case 'AT_GATE':
      return {
        primary: { id: 'scale', label: 'Передать на весовую', description: 'Открыть переход на этап фиксации веса.', tone: 'primary', nextStatus: 'ON_SCALE' },
        secondary: [{ id: 'etaRisk', label: 'ETA risk', description: 'Есть задержка, нужна ручная координация.', tone: 'secondary', nextStatus: 'ETA_RISK' }],
      };
    case 'ON_SCALE':
      return {
        primary: { id: 'unload', label: 'Начать выгрузку', description: 'Вес зафиксирован, машина идёт на выгрузку.', tone: 'primary', nextStatus: 'UNLOADING' },
        secondary: [],
      };
    case 'UNLOADING':
      return {
        primary: { id: 'complete', label: 'Завершить приёмку', description: 'Выгрузка закончена и слот передан дальше.', tone: 'primary', nextStatus: 'COMPLETED' },
        secondary: [],
      };
    case 'COMPLETED':
      return {
        primary: { id: 'checkOut', label: 'Закрыть checkout', description: 'Машина покинула площадку, контур можно закрывать.', tone: 'primary', nextStatus: 'CHECKED_OUT' },
        secondary: [],
      };
    case 'ETA_RISK':
    case 'NO_SHOW_RISK':
      return {
        primary: { id: 'rebook', label: 'Перенести слот', description: 'Сначала снять риск и назначить новое окно.', tone: 'primary', nextStatus: 'REBOOKED' },
        secondary: [],
      };
    default:
      return { primary: null, secondary: [], blockedReason: 'Слот уже закрыт или не допускает дальнейших действий.' };
  }
}

export function isQueueActionAllowed(status: string, action: string) {
  const policy = getQueueSlotPolicy(status);
  return unique([...(policy.primary ? [policy.primary] : []), ...policy.secondary]).some((item) => item.id === action);
}

export function getDispatchPolicy(status: string): WorkflowPolicy {
  const normalized = String(status || '').toUpperCase();
  switch (normalized) {
    case 'PLANNED':
      return {
        primary: { id: 'assign', label: 'Назначить перевозчика', description: 'Связать рейс с перевозчиком и owner.', tone: 'primary', nextStatus: 'ASSIGNED' },
        secondary: [],
      };
    case 'ASSIGNED':
      return {
        primary: { id: 'pickup', label: 'Подтвердить подачу', description: 'Машина реально прибыла на загрузку.', tone: 'primary', nextStatus: 'AT_PICKUP' },
        secondary: [{ id: 'incident', label: 'Инцидент', description: 'Есть риск или отклонение ещё до погрузки.', tone: 'danger', nextStatus: 'INCIDENT' }],
      };
    case 'AT_PICKUP':
      return {
        primary: { id: 'transit', label: 'Отправить в путь', description: 'Погрузка завершена, включаем путь и ETA.', tone: 'primary', nextStatus: 'IN_TRANSIT' },
        secondary: [{ id: 'incident', label: 'Инцидент', description: 'Погрузка сорвалась или есть риск.', tone: 'danger', nextStatus: 'INCIDENT' }],
      };
    case 'IN_TRANSIT':
      return {
        primary: { id: 'gate', label: 'Передать в приёмку', description: 'Машина прибыла на площадку и должна открыть gate-flow.', tone: 'primary', nextStatus: 'AT_GATE' },
        secondary: [{ id: 'incident', label: 'Маршрутный риск', description: 'Поднять alert и не двигать дальше вслепую.', tone: 'danger', nextStatus: 'INCIDENT' }],
      };
    case 'AT_GATE':
      return {
        primary: { id: 'unload', label: 'Начать выгрузку', description: 'Рейс переходит в физическую выгрузку.', tone: 'primary', nextStatus: 'UNLOADING' },
        secondary: [],
      };
    case 'UNLOADING':
      return {
        primary: { id: 'close', label: 'Закрыть рейс', description: 'Передать evidence, docs и handoff в деньги.', tone: 'primary', nextStatus: 'CLOSED' },
        secondary: [],
      };
    case 'INCIDENT':
      return {
        primary: { id: 'gate', label: 'Вернуть в рабочий контур', description: 'Использовать только после ручной верификации и снятия риска.', tone: 'primary', nextStatus: 'AT_GATE' },
        secondary: [],
      };
    default:
      return { primary: null, secondary: [], blockedReason: 'Рейс уже закрыт или не допускает дальнейших шагов.' };
  }
}

export function isDispatchActionAllowed(status: string, action: string) {
  const policy = getDispatchPolicy(status);
  return unique([...(policy.primary ? [policy.primary] : []), ...policy.secondary]).some((item) => item.id === action);
}

export function getWaterfallStepPolicy(status: string): WorkflowPolicy {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'PENDING') return { primary: null, secondary: [], blockedReason: 'Этап ещё не готов к решению. Сначала надо снять upstream blockers.' };
  if (normalized === 'READY') {
    return {
      primary: { id: 'release', label: 'Выпустить', description: 'Пустить деньги только после проверки gate policy.', tone: 'primary' },
      secondary: [{ id: 'hold', label: 'Поставить hold', description: 'Остановить выпуск и зафиксировать причину.', tone: 'danger' }],
    };
  }
  if (normalized === 'HELD') {
    return {
      primary: { id: 'reset', label: 'Вернуть в READY', description: 'Использовать после снятия hold-причины.', tone: 'primary' },
      secondary: [],
    };
  }
  return { primary: null, secondary: [], blockedReason: 'Этап уже выпущен и не должен двигаться повторно напрямую.' };
}
