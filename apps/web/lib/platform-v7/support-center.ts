export type SupportCaseStatus =
  | 'created'
  | 'accepted'
  | 'waiting_user'
  | 'waiting_external'
  | 'assigned_operator'
  | 'assigned_bank'
  | 'assigned_logistics'
  | 'resolved'
  | 'closed'
  | 'escalated';

export type SupportCasePriority = 'P0' | 'P1' | 'P2' | 'P3';

export type SupportCaseCategory =
  | 'money'
  | 'documents'
  | 'logistics'
  | 'acceptance'
  | 'quality'
  | 'dispute'
  | 'access'
  | 'integration'
  | 'other';

export type SupportRequesterRole =
  | 'seller'
  | 'buyer'
  | 'logistics'
  | 'driver'
  | 'bank'
  | 'operator'
  | 'lab'
  | 'elevator'
  | 'surveyor';

export type SupportRelatedEntityType = 'deal' | 'lot' | 'trip' | 'document' | 'payment' | 'dispute' | 'user';

export type SupportMessage = {
  id: string;
  author: string;
  role: SupportRequesterRole | 'support';
  body: string;
  createdAt: string;
  internal?: boolean;
};

export type SupportInternalNote = {
  id: string;
  author: string;
  body: string;
  createdAt: string;
};

export type SupportAuditEvent = {
  id: string;
  actor: string;
  action: string;
  createdAt: string;
  before?: string;
  after?: string;
};

export type SupportCase = {
  id: string;
  title: string;
  description: string;
  status: SupportCaseStatus;
  priority: SupportCasePriority;
  category: SupportCaseCategory;
  requesterRole: SupportRequesterRole;
  relatedEntityType: SupportRelatedEntityType;
  relatedEntityId: string;
  dealId?: string;
  lotId?: string;
  tripId?: string;
  moneyAtRiskRub?: number;
  blocker?: string;
  owner?: string;
  nextAction?: string;
  slaDueAt: string;
  createdAt: string;
  updatedAt: string;
  messages: SupportMessage[];
  internalNotes: SupportInternalNote[];
  auditEvents: SupportAuditEvent[];
};

export const supportStatusLabel: Record<SupportCaseStatus, string> = {
  created: 'Создано',
  accepted: 'Принято в работу',
  waiting_user: 'Ждём действие пользователя',
  waiting_external: 'Ждём внешнюю сторону',
  assigned_operator: 'Передано оператору',
  assigned_bank: 'Передано банку',
  assigned_logistics: 'Передано логистике',
  resolved: 'Решено',
  closed: 'Закрыто',
  escalated: 'Эскалировано',
};

export const supportPriorityLabel: Record<SupportCasePriority, string> = {
  P0: 'P0 · сделка заблокирована',
  P1: 'P1 · высокий риск',
  P2: 'P2 · рабочий вопрос',
  P3: 'P3 · справка',
};

export const supportCategoryLabel: Record<SupportCaseCategory, string> = {
  money: 'Деньги',
  documents: 'Документы',
  logistics: 'Логистика',
  acceptance: 'Приёмка',
  quality: 'Качество',
  dispute: 'Спор',
  access: 'Доступ',
  integration: 'Интеграция',
  other: 'Другое',
};

export const supportRoleLabel: Record<SupportRequesterRole, string> = {
  seller: 'Продавец',
  buyer: 'Покупатель',
  logistics: 'Логистика',
  driver: 'Водитель',
  bank: 'Банк',
  operator: 'Оператор',
  lab: 'Лаборатория',
  elevator: 'Элеватор',
  surveyor: 'Сюрвейер',
};

export const supportEntityLabel: Record<SupportRelatedEntityType, string> = {
  deal: 'Сделка',
  lot: 'Лот',
  trip: 'Рейс',
  document: 'Документ',
  payment: 'Деньги',
  dispute: 'Спор',
  user: 'Пользователь',
};

export const platformV7SupportCases: SupportCase[] = [
  {
    id: 'SUP-2406-001',
    title: 'СДИЗ не оформлен, выпуск денег остановлен',
    description: 'По сделке DL-9106 отсутствует СДИЗ. Условия выплаты не закрыты, продавец ожидает следующий шаг.',
    status: 'assigned_operator',
    priority: 'P0',
    category: 'documents',
    requesterRole: 'seller',
    relatedEntityType: 'deal',
    relatedEntityId: 'DL-9106',
    dealId: 'DL-9106',
    lotId: 'LOT-2403',
    tripId: 'TR-77-014',
    moneyAtRiskRub: 18420000,
    blocker: 'СДИЗ не оформлен',
    owner: 'Оператор документов',
    nextAction: 'Проверить СДИЗ, назначить ответственного и вернуть статус в Deal 360',
    slaDueAt: '2026-05-05T09:30:00.000Z',
    createdAt: '2026-05-05T06:10:00.000Z',
    updatedAt: '2026-05-05T06:28:00.000Z',
    messages: [
      { id: 'MSG-1', author: 'Продавец', role: 'seller', body: 'Выплата остановлена, в документах указан СДИЗ. Нужно понять, кто закрывает шаг.', createdAt: '2026-05-05T06:10:00.000Z' },
      { id: 'MSG-2', author: 'Поддержка', role: 'support', body: 'Обращение принято. Проверяем связку ФГИС, Deal 360 и ответственного по документам.', createdAt: '2026-05-05T06:18:00.000Z' },
    ],
    internalNotes: [
      { id: 'NOTE-1', author: 'Оператор', body: 'Проверить, не висит ли СДИЗ на стороне продавца. Не обещать выпуск денег до закрытия пакета.', createdAt: '2026-05-05T06:22:00.000Z' },
    ],
    auditEvents: [
      { id: 'AUD-1', actor: 'Система', action: 'Обращение создано из сделки DL-9106', createdAt: '2026-05-05T06:10:00.000Z' },
      { id: 'AUD-2', actor: 'Поддержка', action: 'Назначен владелец: Оператор документов', before: 'created', after: 'assigned_operator', createdAt: '2026-05-05T06:18:00.000Z' },
    ],
  },
  {
    id: 'SUP-2406-002',
    title: 'Водитель не может подтвердить фото пломбы',
    description: 'В рейсе TR-77-014 фото пломбы не попало в очередь событий. Нужно проверить полевой контур и не потерять доказательство.',
    status: 'assigned_logistics',
    priority: 'P1',
    category: 'logistics',
    requesterRole: 'driver',
    relatedEntityType: 'trip',
    relatedEntityId: 'TR-77-014',
    dealId: 'DL-9106',
    lotId: 'LOT-2403',
    tripId: 'TR-77-014',
    moneyAtRiskRub: 18420000,
    blocker: 'Нет фото пломбы в доказательном пакете',
    owner: 'Диспетчер логистики',
    nextAction: 'Проверить локальную очередь водителя и добавить событие в рейс',
    slaDueAt: '2026-05-05T10:15:00.000Z',
    createdAt: '2026-05-05T06:20:00.000Z',
    updatedAt: '2026-05-05T06:31:00.000Z',
    messages: [
      { id: 'MSG-3', author: 'Водитель', role: 'driver', body: 'Фото сделал, но в рейсе его не вижу.', createdAt: '2026-05-05T06:20:00.000Z' },
      { id: 'MSG-4', author: 'Поддержка', role: 'support', body: 'Проверяем очередь событий. До подтверждения фото рейс не закрываем.', createdAt: '2026-05-05T06:31:00.000Z' },
    ],
    internalNotes: [
      { id: 'NOTE-2', author: 'Логистика', body: 'Нужна сверка local queue и trip timeline.', createdAt: '2026-05-05T06:34:00.000Z' },
    ],
    auditEvents: [
      { id: 'AUD-3', actor: 'Система', action: 'Обращение создано из рейса TR-77-014', createdAt: '2026-05-05T06:20:00.000Z' },
      { id: 'AUD-4', actor: 'Поддержка', action: 'Передано логистике', before: 'created', after: 'assigned_logistics', createdAt: '2026-05-05T06:31:00.000Z' },
    ],
  },
  {
    id: 'SUP-2406-003',
    title: 'Покупатель не видит основание удержания',
    description: 'Покупатель просит показать, почему часть суммы удержана до закрытия качества и документов.',
    status: 'waiting_external',
    priority: 'P1',
    category: 'money',
    requesterRole: 'buyer',
    relatedEntityType: 'payment',
    relatedEntityId: 'PAY-DL-9106',
    dealId: 'DL-9106',
    lotId: 'LOT-2403',
    tripId: 'TR-77-014',
    moneyAtRiskRub: 1250000,
    blocker: 'Не подтверждён протокол качества',
    owner: 'Лаборатория',
    nextAction: 'Получить протокол качества и обновить расчётный лист',
    slaDueAt: '2026-05-05T12:00:00.000Z',
    createdAt: '2026-05-05T06:24:00.000Z',
    updatedAt: '2026-05-05T06:40:00.000Z',
    messages: [
      { id: 'MSG-5', author: 'Покупатель', role: 'buyer', body: 'Нужно увидеть основание удержания по качеству.', createdAt: '2026-05-05T06:24:00.000Z' },
      { id: 'MSG-6', author: 'Поддержка', role: 'support', body: 'Запрос передан лаборатории. Удержание не снимается без протокола.', createdAt: '2026-05-05T06:40:00.000Z' },
    ],
    internalNotes: [
      { id: 'NOTE-3', author: 'Оператор', body: 'Проверить связь протокола с расчётным листом. Не раскрывать покупателю лишние данные продавца.', createdAt: '2026-05-05T06:41:00.000Z' },
    ],
    auditEvents: [
      { id: 'AUD-5', actor: 'Система', action: 'Обращение создано из денежного блока сделки', createdAt: '2026-05-05T06:24:00.000Z' },
      { id: 'AUD-6', actor: 'Поддержка', action: 'Ожидается внешняя сторона: лаборатория', before: 'created', after: 'waiting_external', createdAt: '2026-05-05T06:40:00.000Z' },
    ],
  },
  {
    id: 'SUP-2406-004',
    title: 'Нужен доступ сотруднику к документам сделки',
    description: 'У сотрудника покупателя нет доступа к документам DL-9106. Требуется проверить роль и допуск.',
    status: 'waiting_user',
    priority: 'P2',
    category: 'access',
    requesterRole: 'buyer',
    relatedEntityType: 'user',
    relatedEntityId: 'USR-BUYER-DOCS-2',
    dealId: 'DL-9106',
    lotId: 'LOT-2403',
    moneyAtRiskRub: 0,
    blocker: 'Не подтверждён допуск сотрудника',
    owner: 'Покупатель',
    nextAction: 'Подтвердить сотрудника и роль доступа',
    slaDueAt: '2026-05-06T06:30:00.000Z',
    createdAt: '2026-05-05T06:30:00.000Z',
    updatedAt: '2026-05-05T06:45:00.000Z',
    messages: [
      { id: 'MSG-7', author: 'Покупатель', role: 'buyer', body: 'Добавьте доступ сотруднику к документам.', createdAt: '2026-05-05T06:30:00.000Z' },
      { id: 'MSG-8', author: 'Поддержка', role: 'support', body: 'Нужна роль сотрудника и подтверждение полномочий.', createdAt: '2026-05-05T06:45:00.000Z' },
    ],
    internalNotes: [
      { id: 'NOTE-4', author: 'Комплаенс', body: 'Не выдавать доступ к банковому блоку без отдельного допуска.', createdAt: '2026-05-05T06:46:00.000Z' },
    ],
    auditEvents: [
      { id: 'AUD-7', actor: 'Система', action: 'Обращение создано из доступа', createdAt: '2026-05-05T06:30:00.000Z' },
      { id: 'AUD-8', actor: 'Поддержка', action: 'Запрошено действие пользователя', before: 'created', after: 'waiting_user', createdAt: '2026-05-05T06:45:00.000Z' },
    ],
  },
];

export function formatSupportRub(value = 0): string {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(value) + ' ₽';
}

export function getSupportCase(caseId: string): SupportCase | undefined {
  return platformV7SupportCases.find((item) => item.id === caseId);
}

export function getSupportOpenCases(): SupportCase[] {
  return platformV7SupportCases.filter((item) => !['resolved', 'closed'].includes(item.status));
}

export function getSupportCasesByPriority(priority: SupportCasePriority): SupportCase[] {
  return platformV7SupportCases.filter((item) => item.priority === priority);
}

export function getSupportMoneyAtRisk(): number {
  return platformV7SupportCases.reduce((sum, item) => sum + (item.moneyAtRiskRub ?? 0), 0);
}

export function getSupportSlaMinutesLeft(caseItem: SupportCase, nowIso = '2026-05-05T06:50:00.000Z'): number {
  const diffMs = new Date(caseItem.slaDueAt).getTime() - new Date(nowIso).getTime();
  return Math.ceil(diffMs / 60000);
}

export function getSupportSlaLabel(caseItem: SupportCase): string {
  const minutes = getSupportSlaMinutesLeft(caseItem);
  if (minutes <= 0) return 'SLA нарушен';
  if (minutes < 60) return `${minutes} мин`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest > 0 ? `${hours} ч ${rest} мин` : `${hours} ч`;
}

export function getSupportPriorityRank(priority: SupportCasePriority): number {
  return { P0: 0, P1: 1, P2: 2, P3: 3 }[priority];
}

export function getOperatorSupportQueue(): SupportCase[] {
  return [...getSupportOpenCases()].sort((a, b) => {
    const priorityDelta = getSupportPriorityRank(a.priority) - getSupportPriorityRank(b.priority);
    if (priorityDelta !== 0) return priorityDelta;
    return getSupportSlaMinutesLeft(a) - getSupportSlaMinutesLeft(b);
  });
}

export const supportCreateDefaults = {
  categories: Object.keys(supportCategoryLabel) as SupportCaseCategory[],
  relatedEntities: Object.keys(supportEntityLabel) as SupportRelatedEntityType[],
  requesterRoles: Object.keys(supportRoleLabel) as SupportRequesterRole[],
};
