export type DealStatus =
  | 'draft'
  | 'contract_signed'
  | 'payment_reserved'
  | 'loading_scheduled'
  | 'loading_started'
  | 'loading_done'
  | 'in_transit'
  | 'arrived'
  | 'unloading_started'
  | 'unloading_done'
  | 'quality_check'
  | 'quality_approved'
  | 'quality_disputed'
  | 'docs_complete'
  | 'release_requested'
  | 'release_approved'
  | 'closed';

export interface DealEvent {
  ts: string;
  actor: string;
  action: string;
  type: 'success' | 'info' | 'danger';
}

export interface RouteEvent {
  time: string;
  event: string;
  gps?: string;
  driver?: string;
}

export interface Deal {
  id: string;
  grain: string;
  quantity: number;
  unit: string;
  seller: { name: string };
  buyer: { name: string };
  status: DealStatus;
  reservedAmount: number;
  holdAmount: number;
  riskScore: number;
  slaDeadline: string | null;
  blockers: string[];
  dispute?: { id: string };
  pricePerTon?: number;
  totalAmount?: number;
  releaseAmount?: number;
  route?: RouteEvent[];
  events?: DealEvent[];
  lotId?: string;
  routeId?: string;
  routeState?: string;
  routeEta?: string;
}

export interface Dispute {
  id: string;
  dealId: string;
  type: string;
  title: string;
  reasonCode: string;
  holdAmount: number;
  slaDaysLeft: number;
  ballAt: 'seller' | 'buyer' | 'lab' | 'arbitrator';
  status: 'open' | 'resolved';
  evidence: { total: number; uploaded: number };
  description: string;
}

export interface AuditEntry {
  ts: string;
  actor: string;
  action: string;
  type: string;
  object?: string;
}

export interface CallbackItem {
  id: string;
  type: string;
  dealId: string;
  status: 'ok' | 'pending' | 'mismatch';
  note: string;
  daysOpen?: number;
  amountRub?: number;
}

export interface RfqItem {
  id: string;
  grain: string;
  volume: number;
  region: string;
  price: number;
  quality: string;
  payment: string;
}

export const DEALS: Deal[] = [
  { id: 'DL-9102', grain: 'Пшеница 4 кл.', quantity: 200.3, unit: 'т', seller: { name: 'Агро-Юг ООО' }, buyer: { name: 'Агрохолдинг СК' }, status: 'quality_disputed', reservedAmount: 6240000, holdAmount: 624000, riskScore: 92, slaDeadline: '2026-04-19', blockers: ['dispute', 'docs'], dispute: { id: 'DK-2024-89' }, pricePerTon: 14800, totalAmount: 2964440, releaseAmount: 4368000, lotId: 'LOT-2401', routeId: 'ТМБ-14', routeState: 'Прибыл · расхождение по качеству', routeEta: '14:28',
    route: [
      { time: '08:42', event: 'Выезд с хозяйства', gps: '52.7213, 41.4525', driver: 'Ковалёв А.С.' },
      { time: '11:17', event: 'Въезд на элеватор Черноземный', gps: '51.2934, 37.2185' },
      { time: '11:34', event: 'Взвешивание: 200.3 т (отклонение 0.15%)' }
    ],
    events: [
      { ts: '2026-04-01T09:00:00Z', actor: 'Оператор', action: 'Контракт подписан', type: 'success' },
      { ts: '2026-04-01T14:22:00Z', actor: 'Банк Сбер', action: 'Резерв 6.24 млн ₽ подтверждён', type: 'success' },
      { ts: '2026-04-03T08:15:00Z', actor: 'Водитель Ковалёв', action: 'Выезд с хозяйства', type: 'info' },
      { ts: '2026-04-03T11:34:00Z', actor: 'Элеватор Черноземный', action: 'Взвешивание 200.3 т', type: 'info' },
      { ts: '2026-04-03T16:05:00Z', actor: 'Лаб. ЦентрГрейн', action: 'Влажность 16.2% — расхождение, спор открыт', type: 'danger' }
    ]
  },
  { id: 'DL-9103', grain: 'Кукуруза 3 кл.', quantity: 150, unit: 'т', seller: { name: 'КФХ Петров' }, buyer: { name: 'ЗАО МелькомбинатЮг' }, status: 'in_transit', reservedAmount: 3150000, holdAmount: 0, riskScore: 22, slaDeadline: '2026-04-25', blockers: [], lotId: 'LOT-2402', routeId: 'КРС-03', routeState: 'На приёмке', routeEta: 'сейчас' },
  { id: 'DL-9104', grain: 'Ячмень 2 кл.', quantity: 80, unit: 'т', seller: { name: 'ИП Сидоров' }, buyer: { name: 'Пивзавод Тамбов' }, status: 'docs_complete', reservedAmount: 1520000, holdAmount: 0, riskScore: 15, slaDeadline: '2026-04-22', blockers: ['bank_confirm'] },
  { id: 'DL-9105', grain: 'Подсолнечник', quantity: 120, unit: 'т', seller: { name: 'АО СолнцеАгро' }, buyer: { name: 'МаслоПресс ООО' }, status: 'loading_started', reservedAmount: 4320000, holdAmount: 0, riskScore: 35, slaDeadline: '2026-04-24', blockers: [] },
  { id: 'DL-9106', grain: 'Пшеница 3 кл.', quantity: 500, unit: 'т', seller: { name: 'ГК АгроСтарт' }, buyer: { name: 'Экспортёр Юг' }, status: 'payment_reserved', reservedAmount: 14500000, holdAmount: 0, riskScore: 18, slaDeadline: '2026-04-30', blockers: [], lotId: 'LOT-2403', routeId: 'ВРЖ-08', routeState: 'Ожидание погрузки', routeEta: '16:10' },
  { id: 'DL-9107', grain: 'Кукуруза 1 кл.', quantity: 200, unit: 'т', seller: { name: 'ФХ Воронцов' }, buyer: { name: 'КомбикормЦентр' }, status: 'closed', reservedAmount: 0, holdAmount: 0, riskScore: 0, slaDeadline: null, blockers: [] },
  { id: 'DL-9108', grain: 'Ячмень 3 кл.', quantity: 60, unit: 'т', seller: { name: 'ИП Краснов' }, buyer: { name: 'Агрохолдинг СК' }, status: 'quality_check', reservedAmount: 1020000, holdAmount: 0, riskScore: 48, slaDeadline: '2026-04-21', blockers: ['lab_result'] },
  { id: 'DL-9109', grain: 'Пшеница 4 кл.', quantity: 350, unit: 'т', seller: { name: 'КФХ Мирный' }, buyer: { name: 'ЗерноТрейд ООО' }, status: 'release_requested', reservedAmount: 10500000, holdAmount: 0, riskScore: 12, slaDeadline: '2026-04-20', blockers: [] },
  { id: 'DL-9110', grain: 'Кукуруза 3 кл.', quantity: 180, unit: 'т', seller: { name: 'ООО НивА' }, buyer: { name: 'Агрохолдинг СК' }, status: 'quality_disputed', reservedAmount: 3240000, holdAmount: 512000, riskScore: 78, slaDeadline: '2026-04-26', blockers: ['dispute'], dispute: { id: 'DK-2024-91' }, pricePerTon: 18000, totalAmount: 3240000, releaseAmount: 2268000 },
  { id: 'DL-9111', grain: 'Ячмень 2 кл.', quantity: 120, unit: 'т', seller: { name: 'ООО Поле Юг' }, buyer: { name: 'Пивзавод Центр' }, status: 'contract_signed', reservedAmount: 2100000, holdAmount: 0, riskScore: 16, slaDeadline: '2026-04-28', blockers: ['reserve'] }
];

export const DISPUTES: Dispute[] = [
  { id: 'DK-2024-89', dealId: 'DL-9102', type: 'quality_mismatch', title: 'Расхождение по влажности', reasonCode: 'MOISTURE_DEVIATION', holdAmount: 624000, slaDaysLeft: 6, ballAt: 'seller', status: 'open', evidence: { total: 5, uploaded: 4 }, description: 'Нужно загрузить заключение эксперта и закрыть спор по качеству.' },
  { id: 'DK-2024-91', dealId: 'DL-9110', type: 'weight_mismatch', title: 'Расхождение по весу', reasonCode: 'WEIGHT_DEVIATION', holdAmount: 512000, slaDaysLeft: 13, ballAt: 'lab', status: 'open', evidence: { total: 4, uploaded: 2 }, description: 'Нужно сверить лабораторный протокол и данные элеватора.' }
];

export const CALLBACKS: CallbackItem[] = [
  { id: 'CB-441', type: 'Reserve', dealId: 'DL-9103', status: 'ok', note: 'Резерв подтверждён' },
  { id: 'CB-442', type: 'Mismatch', dealId: 'DL-9102', status: 'mismatch', note: 'Расхождение протеина 0.8% между ФГИС и ЛАБ-2847', daysOpen: 4 },
  { id: 'CB-443', type: 'Release', dealId: 'DL-9109', status: 'pending', note: 'Ожидает ручной проверки банка', daysOpen: 1 }
];

export const AUDIT_LOG: AuditEntry[] = [
  { ts: '2026-04-12T09:15:22Z', actor: 'Оператор', action: 'Контракт подписан', type: 'success', object: 'DL-9102' },
  { ts: '2026-04-12T10:05:01Z', actor: 'Банк Сбер', action: 'Резерв подтверждён', type: 'success', object: 'DL-9102' },
  { ts: '2026-04-12T11:00:00Z', actor: 'Система', action: 'SLA alert', type: 'warning', object: 'DK-2024-89' },
  { ts: '2026-04-12T12:15:30Z', actor: 'Покупатель', action: 'Запрос release заблокирован', type: 'danger', object: 'DL-9102' },
  { ts: '2026-04-12T13:45:00Z', actor: 'Лаборатория ЦентрГрейн', action: 'Лабораторный анализ завершён', type: 'warning', object: 'QC-DL-9102' }
];

export const RFQ_LIST: RfqItem[] = [
  { id: 'RFQ-1001', grain: 'Пшеница 4 кл.', volume: 500, region: 'Тамбовская обл.', price: 14800, quality: 'ГОСТ / влажность ≤14%', payment: 'Сбер / резерв' },
  { id: 'RFQ-1002', grain: 'Кукуруза 3 кл.', volume: 300, region: 'Воронежская обл.', price: 15600, quality: 'Протеин ≥8%', payment: 'Предоплата 30%' },
  { id: 'RFQ-1003', grain: 'Ячмень 2 кл.', volume: 120, region: 'Курская обл.', price: 12400, quality: 'Сорная примесь ≤2%', payment: 'Сбер / выпуск по этапам' }
];

export const NOTIFICATIONS = [
  { id: 'N-1', text: 'DL-9102: расхождение по влажности — спор открыт', href: '/platform-v7/disputes/DK-2024-89' },
  { id: 'N-2', text: 'CB-442: требует ручной проверки банка', href: '/platform-v7/bank' },
  { id: 'N-3', text: 'DL-9108: лабораторный анализ завершён', href: '/platform-v7/deals/DL-9108' }
];

export function getDealById(id: string) {
  return DEALS.find((deal) => deal.id === id);
}

export function getDisputeById(id: string) {
  return DISPUTES.find((dispute) => dispute.id === id);
}
