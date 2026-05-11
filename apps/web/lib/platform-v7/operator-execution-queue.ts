export type QueueEntityType = 'deal' | 'lot' | 'document' | 'batch';
export type QueuePriority = 'stop' | 'wait' | 'info';
export type QueueOwnerRole = 'продавец' | 'грузополучатель' | 'лаборатория' | 'оператор' | 'банк' | 'ФГИС «Зерно»';

export interface OperatorQueueItem {
  readonly id: string;
  readonly entityType: QueueEntityType;
  readonly entityId: string;
  readonly moneyAtRisk: string;
  readonly blocker: string;
  readonly ownerRole: QueueOwnerRole;
  readonly priority: QueuePriority;
  readonly slaLabel: string;
  readonly requiredAction: string;
  readonly safeNextAction: string;
  readonly whyNotExecutable: string;
  readonly href: string;
}

export const OPERATOR_QUEUE_ITEMS: readonly OperatorQueueItem[] = [
  {
    id: 'OQ-001',
    entityType: 'document',
    entityId: 'DL-9106 / СДИЗ',
    moneyAtRisk: '9,65 млн ₽',
    blocker: 'СДИЗ не подтверждён в ФГИС «Зерно»',
    ownerRole: 'продавец',
    priority: 'stop',
    slaLabel: 'блокирует выплату',
    requiredAction: 'продавец отправляет СДИЗ и дожидается подтверждения от ФГИС «Зерно»',
    safeNextAction: 'открыть карточку сделки и проверить статус СДИЗ',
    whyNotExecutable: 'пилотный контур ожидает ручного подтверждения ФГИС «Зерно» — автоматическое закрытие не предусмотрено',
    href: '/platform-v7/deals/DL-9106/clean',
  },
  {
    id: 'OQ-002',
    entityType: 'document',
    entityId: 'DL-9106 / ЭТрН',
    moneyAtRisk: '9,65 млн ₽',
    blocker: 'ЭТрН ждёт подписи грузополучателя',
    ownerRole: 'грузополучатель',
    priority: 'stop',
    slaLabel: 'блокирует приёмку',
    requiredAction: 'грузополучатель подписывает ЭТрН в СБИС / Saby',
    safeNextAction: 'открыть логистику и уточнить статус подписи',
    whyNotExecutable: 'пилотный контур — подпись ЭТрН требует действия грузополучателя, не оператора',
    href: '/platform-v7/logistics',
  },
  {
    id: 'OQ-003',
    entityType: 'document',
    entityId: 'DL-9106 / протокол качества',
    moneyAtRisk: '9,65 млн ₽',
    blocker: 'протокол качества не получен от лаборатории',
    ownerRole: 'лаборатория',
    priority: 'wait',
    slaLabel: 'ожидание результата',
    requiredAction: 'лаборатория ФГБУ ЦОК АПК выдаёт протокол качества',
    safeNextAction: 'проверить статус заявки в элеваторе',
    whyNotExecutable: 'пилотный контур ожидает внешнего лабораторного события — оператор не может ускорить выдачу',
    href: '/platform-v7/elevator',
  },
  {
    id: 'OQ-004',
    entityType: 'deal',
    entityId: 'DL-9102',
    moneyAtRisk: '624 тыс. ₽',
    blocker: 'отклонение веса при приёмке — спорная часть не урегулирована',
    ownerRole: 'оператор',
    priority: 'stop',
    slaLabel: 'спор требует решения',
    requiredAction: 'оператор инициирует проверку акта расхождения и фиксирует решение',
    safeNextAction: 'открыть карточку сделки и запустить процедуру урегулирования спора',
    whyNotExecutable: 'пилотный контур — урегулирование спора требует ручной проверки документов и решения ответственного',
    href: '/platform-v7/deals/DL-9102/clean',
  },
];

export function getQueueItemsByPriority(priority: QueuePriority): readonly OperatorQueueItem[] {
  return OPERATOR_QUEUE_ITEMS.filter((item) => item.priority === priority);
}

export function getTotalMoneyAtRiskCount(): number {
  return OPERATOR_QUEUE_ITEMS.length;
}

export function getStopCount(): number {
  return OPERATOR_QUEUE_ITEMS.filter((item) => item.priority === 'stop').length;
}
