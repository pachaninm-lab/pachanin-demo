import type { SupportAuditEvent, SupportCase, SupportInternalNote, SupportMessage } from './support-types';

export const SUPPORT_CASES: SupportCase[] = [
  { id: 'SC-9103', title: 'Выпуск денег остановлен из-за незакрытой приёмки', description: 'По сделке есть сумма к выпуску, но не закрыты вес и качество.', status: 'assigned_operator', priority: 'P0', category: 'money', requesterRole: 'seller', relatedEntityType: 'deal', relatedEntityId: 'DL-9103', dealId: 'DL-9103', lotId: 'LOT-9103', tripId: 'TR-9103', moneyAtRiskRub: 12840000, blocker: 'Не подтверждены вес и качество после разгрузки', owner: 'Оператор сделки', nextAction: 'Оператор сверяет приёмку, лабораторию и документный пакет.', slaDueAt: '2026-05-05T11:00:00.000Z', createdAt: '2026-05-05T08:24:00.000Z', updatedAt: '2026-05-05T08:46:00.000Z' },
  { id: 'SC-9114', title: 'Документный пакет требует проверки', description: 'Не хватает подтверждения по СДИЗ и транспортной накладной.', status: 'assigned_bank', priority: 'P1', category: 'documents', requesterRole: 'buyer', relatedEntityType: 'document', relatedEntityId: 'DOC-9114', dealId: 'DL-9114', lotId: 'LOT-9114', tripId: 'TR-9114', moneyAtRiskRub: 6460000, blocker: 'СДИЗ и ЭДО не совпадают по партии', owner: 'Банковый контур', nextAction: 'Сверить СДИЗ, ЭДО и основание удержания.', slaDueAt: '2026-05-05T16:30:00.000Z', createdAt: '2026-05-05T08:00:00.000Z', updatedAt: '2026-05-05T08:35:00.000Z' },
  { id: 'SC-9120', title: 'Рейс требует проверки отклонения маршрута', description: 'Маршрут и время разгрузки требуют сверки с оператором.', status: 'assigned_logistics', priority: 'P1', category: 'logistics', requesterRole: 'logistics', relatedEntityType: 'trip', relatedEntityId: 'TR-9120', dealId: 'DL-9120', lotId: 'LOT-9120', tripId: 'TR-9120', moneyAtRiskRub: 3840000, blocker: 'Отклонение маршрута до подтверждения разгрузки', owner: 'Логистика', nextAction: 'Диспетчер сверяет маршрут, геометку и фото разгрузки.', slaDueAt: '2026-05-05T14:20:00.000Z', createdAt: '2026-05-05T07:12:00.000Z', updatedAt: '2026-05-05T07:58:00.000Z' },
  { id: 'SC-9128', title: 'Нужен доступ к карточке сделки', description: 'Пользователь видит лот, но не видит сделку после принятия ставки.', status: 'waiting_user', priority: 'P2', category: 'access', requesterRole: 'buyer', relatedEntityType: 'deal', relatedEntityId: 'DL-9128', dealId: 'DL-9128', lotId: 'LOT-9128', moneyAtRiskRub: 0, blocker: 'Нет подтверждения роли пользователя в сделке', owner: 'Доступ', nextAction: 'Пользователь должен прислать роль, компанию и ID сделки.', slaDueAt: '2026-05-06T09:00:00.000Z', createdAt: '2026-05-05T06:30:00.000Z', updatedAt: '2026-05-05T07:05:00.000Z' },
];

export const SUPPORT_MESSAGES: SupportMessage[] = [
  { id: 'SM-9103-1', caseId: 'SC-9103', author: 'Продавец', body: 'Деньги стоят, приёмка не закрыта.', createdAt: '2026-05-05T08:24:00.000Z', public: true },
  { id: 'SM-9103-2', caseId: 'SC-9103', author: 'Оператор поддержки', body: 'Обращение принято. Проверяются вес, качество и документы.', createdAt: '2026-05-05T08:46:00.000Z', public: true },
  { id: 'SM-9114-1', caseId: 'SC-9114', author: 'Покупатель', body: 'В документах есть расхождение по партии.', createdAt: '2026-05-05T08:00:00.000Z', public: true },
  { id: 'SM-9120-1', caseId: 'SC-9120', author: 'Логист', body: 'Рейс пришёл с отклонением маршрута. Нужна проверка.', createdAt: '2026-05-05T07:12:00.000Z', public: true },
];

export const SUPPORT_INTERNAL_NOTES: SupportInternalNote[] = [
  { id: 'SIN-9103-1', caseId: 'SC-9103', author: 'Оператор сделки', body: 'Проверить приёмку, лабораторию и открытые споры.', createdAt: '2026-05-05T08:40:00.000Z' },
  { id: 'SIN-9114-1', caseId: 'SC-9114', author: 'Банковый контур', body: 'Сверить СДИЗ, ЭДО и основание удержания.', createdAt: '2026-05-05T08:30:00.000Z' },
];

export const SUPPORT_AUDIT_EVENTS: SupportAuditEvent[] = [
  { id: 'SAE-9103-1', caseId: 'SC-9103', actor: 'Продавец', action: 'created', description: 'Создано обращение по сделке DL-9103.', createdAt: '2026-05-05T08:24:00.000Z' },
  { id: 'SAE-9103-2', caseId: 'SC-9103', actor: 'Оператор сделки', action: 'accepted', description: 'Обращение принято в работу.', before: 'created', after: 'assigned_operator', createdAt: '2026-05-05T08:46:00.000Z' },
  { id: 'SAE-9114-1', caseId: 'SC-9114', actor: 'Оператор сделки', action: 'owner_changed', description: 'Обращение передано в банковский контур.', before: 'Оператор сделки', after: 'Банковый контур', createdAt: '2026-05-05T08:35:00.000Z' },
  { id: 'SAE-9120-1', caseId: 'SC-9120', actor: 'Логистика', action: 'created', description: 'Создано обращение по рейсу TR-9120.', createdAt: '2026-05-05T07:12:00.000Z' },
];
