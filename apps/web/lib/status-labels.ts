/** 
 * Русские названия всех статусов и терминов платформы.
 * Используется на всех страницах для единообразной локализации.
 */

export const DEAL_STATUS: Record<string, string> = {
  DRAFT: 'Черновик',
  AWAITING_SIGN: 'На подписании',
  SIGNED: 'Подписан',
  PREPAYMENT_RESERVED: 'Предоплата зарезервирована',
  LOADING: 'Погрузка',
  IN_TRANSIT: 'В пути',
  ARRIVED: 'Прибыл',
  QUALITY_CHECK: 'Проверка качества',
  ACCEPTED: 'Принято',
  FINAL_PAYMENT: 'Ожидание оплаты',
  SETTLED: 'Расчёт завершён',
  CLOSED: 'Закрыта',
  DISPUTE_OPEN: 'Спор открыт',
  EXPERTISE: 'Экспертиза',
  ARBITRATION_DECISION: 'Решение арбитра',
  CANCELLATION: 'Отмена',
  PARTIAL_SETTLEMENT: 'Частичный расчёт',
};

export const SHIPMENT_STATUS: Record<string, string> = {
  CREATED: 'Создан',
  ASSIGNED: 'Назначен',
  DRIVER_CONFIRMED: 'Водитель подтвердил',
  AT_LOADING: 'На погрузке',
  LOADED: 'Погружен',
  IN_TRANSIT: 'В пути',
  ROUTE_DEVIATION_ALERT: 'Отклонение маршрута',
  AT_UNLOADING: 'Прибыл на выгрузку',
  UNLOADED: 'Выгружен',
  CONFIRMED: 'Подтверждён',
  CANCELLED: 'Отменён',
  DRIVER_ACCEPTED: 'Водитель принял',
  LOADING: 'Погрузка',
  ARRIVED: 'Прибыл',
  UNLOADING: 'Выгрузка',
  COMPLETED: 'Завершён'
};

export const LOT_STATUS: Record<string, string> = {
  DRAFT: 'Черновик',
  MODERATION: 'На модерации',
  PUBLISHED: 'Опубликован',
  AUCTION_ACTIVE: 'Торги открыты',
  AUCTION_FINISHED: 'Торги завершены',
  DEAL_CREATED: 'Сделка создана',
  CANCELLED: 'Отменён',
  REJECTED: 'Отклонён',
  ACTIVE: 'Активен',
  EXPIRED: 'Истёк',
  MATCHED: 'Совпадение',
  CLOSED: 'Закрыт',
};

export const DISPUTE_TYPE: Record<string, string> = {
  quality: 'Качество',
  weight: 'Вес',
  delay: 'Простой',
  payment: 'Оплата',
  damage: 'Повреждение',
};

export const ROLE_LABEL: Record<string, string> = {
  seller: 'Продавец',
  buyer: 'Покупатель',
  logistics: 'Логист',
  driver: 'Водитель',
  lab: 'Лаборатория',
  elevator: 'Элеватор',
  operator: 'Оператор',
  executive: 'Руководитель',
  finance: 'Бухгалтер',
};

export const PAGE_TITLE: Record<string, string> = {
  'deals': 'Сделки',
  'driver-mobile': 'Режим водителя',
  'dispatch-center': 'Диспетчерский центр',
  'anti-fraud': 'Антифрод',
  'runtime-ops': 'Операционный центр',
  'pilot-mode': 'Режим пилота',
  'purchase-requests': 'Запросы на покупку',
  'market-news': 'Новости рынка',
  'reputation-control': 'Управление репутацией',
  'export-1c': 'Экспорт в 1С',
};

export function dealStatus(s: string): string { return DEAL_STATUS[s] || s; }
export function shipmentStatus(s: string): string { return SHIPMENT_STATUS[s] || s; }
export function lotStatus(s: string): string { return LOT_STATUS[s] || s; }
export function roleName(r: string): string { return ROLE_LABEL[r] || r; }
export function pageTitle(slug: string): string { return PAGE_TITLE[slug] || slug; }
