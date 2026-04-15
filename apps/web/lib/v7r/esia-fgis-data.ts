export type SourceType = 'MANUAL' | 'FGIS';
export type ConnectorType = 'ESIA' | 'FGIS';
export type ReadinessState = 'PASS' | 'FAIL' | 'REVIEW';
export type ConnectionState = 'connected' | 'disconnected' | 'degraded' | 'sandbox';
export type QueueState = 'pending' | 'processing' | 'failed' | 'done';

export interface BlockerItem {
  id: string;
  title: string;
  reasonCode: string;
  detail: string;
  impact: string;
}

export interface ConnectorStatus {
  type: ConnectorType;
  connectionState: ConnectionState;
  lastSyncAt: string | null;
  pending: number;
  errorText?: string;
  modeLabel: string;
}

export interface LotReadiness {
  state: ReadinessState;
  blockers: BlockerItem[];
  nextStep: string | null;
  nextOwner: string | null;
}

export interface LotItem {
  id: string;
  title: string;
  grain: string;
  volumeTons: number;
  sourceType: SourceType;
  readiness: LotReadiness;
  sourceReference: string | null;
}

export interface AuctionItem {
  id: string;
  title: string;
  lotId: string;
  winnerLabel: string;
  gate: LotReadiness;
}

export interface DealItem {
  id: string;
  title: string;
  sourceType: SourceType;
  sourceReference: string | null;
  readiness: LotReadiness;
  queueState: QueueState;
  nextStep: string | null;
  nextOwner: string | null;
  lastSyncAt: string | null;
  connectorStatus: Record<ConnectorType, ConnectorStatus>;
}

export interface QueueEntry {
  id: string;
  connectorType: ConnectorType;
  objectType: 'lot' | 'deal' | 'party';
  objectId: string;
  queueState: QueueState;
  reasonCodes: string[];
  updatedAt: string;
  owner: string;
}

export interface RoleReadinessCard {
  id: string;
  title: string;
  role: string;
  readinessState: ReadinessState;
  blockerSummary: string;
  nextRail: string;
  href: string;
}

const sharedDocsBlocker: BlockerItem = {
  id: 'bl-docs',
  title: 'Не хватает пакета документов',
  reasonCode: 'DOCS_MISSING',
  detail: 'Нет подписанного акта приёмки и протокола качества.',
  impact: 'Выпуск денег и перевод сделки в расчёт заблокирован.',
};

const sharedEsiaBlocker: BlockerItem = {
  id: 'bl-esia',
  title: 'Нет подтверждённой ESIA-связки',
  reasonCode: 'ESIA_LINK_MISSING',
  detail: 'Контур участника не прошёл связку учётной записи.',
  impact: 'Нельзя считать контур готовым для синхронизации.',
};

const sharedFgisBlocker: BlockerItem = {
  id: 'bl-fgis',
  title: 'ФГИС-объект не прошёл проверку',
  reasonCode: 'FGIS_GATE_FAIL',
  detail: 'Партия в ФГИС не подтверждена по источнику и качеству.',
  impact: 'Импорт партии, выбор победителя и выпуск денег заблокированы.',
};

export const connectors: ConnectorStatus[] = [
  {
    type: 'ESIA',
    connectionState: 'degraded',
    lastSyncAt: '2026-04-15 10:42',
    pending: 3,
    errorText: 'Есть 2 участника без повторной авторизации.',
    modeLabel: 'SANDBOX',
  },
  {
    type: 'FGIS',
    connectionState: 'sandbox',
    lastSyncAt: '2026-04-15 10:55',
    pending: 7,
    errorText: 'Контур синка работает как симуляция до боевого подключения.',
    modeLabel: 'SANDBOX',
  },
];

export const lots: LotItem[] = [
  {
    id: 'LOT-2401',
    title: 'Пшеница 4 кл. / Тамбов',
    grain: 'Пшеница 4 кл.',
    volumeTons: 240,
    sourceType: 'FGIS',
    sourceReference: 'FGIS-PARTY-88421',
    readiness: {
      state: 'FAIL',
      blockers: [sharedFgisBlocker],
      nextStep: 'Перепроверить источник партии и статус допуска в ФГИС.',
      nextOwner: 'Оператор',
    },
  },
  {
    id: 'LOT-2402',
    title: 'Кукуруза / Моршанск',
    grain: 'Кукуруза',
    volumeTons: 300,
    sourceType: 'MANUAL',
    sourceReference: null,
    readiness: {
      state: 'REVIEW',
      blockers: [sharedDocsBlocker],
      nextStep: 'Догрузить акт и протокол качества.',
      nextOwner: 'Продавец',
    },
  },
  {
    id: 'LOT-2403',
    title: 'Ячмень / Рассказово',
    grain: 'Ячмень',
    volumeTons: 180,
    sourceType: 'FGIS',
    sourceReference: 'FGIS-PARTY-88117',
    readiness: {
      state: 'PASS',
      blockers: [],
      nextStep: 'Можно запускать торг и переходить к выбору победителя.',
      nextOwner: 'Покупатель',
    },
  },
];

export const auctions: AuctionItem[] = [
  {
    id: 'AUC-2401',
    title: 'Торг по LOT-2401',
    lotId: 'LOT-2401',
    winnerLabel: 'ООО «ЗерноИнвест»',
    gate: {
      state: 'FAIL',
      blockers: [sharedFgisBlocker],
      nextStep: 'Починить FGIS-gate до выбора победителя.',
      nextOwner: 'Оператор',
    },
  },
  {
    id: 'AUC-2402',
    title: 'Торг по LOT-2403',
    lotId: 'LOT-2403',
    winnerLabel: 'АО «АгроТрейд»',
    gate: {
      state: 'REVIEW',
      blockers: [sharedDocsBlocker],
      nextStep: 'Подтвердить ручную проверку перед выбором победителя.',
      nextOwner: 'Оператор',
    },
  },
];

export const deals: DealItem[] = [
  {
    id: 'DL-2401',
    title: 'Сделка по пшенице / Тамбов',
    sourceType: 'FGIS',
    sourceReference: 'FGIS-PARTY-88421',
    readiness: {
      state: 'FAIL',
      blockers: [sharedFgisBlocker, sharedEsiaBlocker],
      nextStep: 'Закрыть ESIA-связку и перепроверить объект партии.',
      nextOwner: 'Комплаенс',
    },
    queueState: 'failed',
    nextStep: 'Вручную перезапустить ingestion по партии.',
    nextOwner: 'Оператор',
    lastSyncAt: '2026-04-15 10:31',
    connectorStatus: {
      ESIA: connectors[0],
      FGIS: connectors[1],
    },
  },
  {
    id: 'DL-2402',
    title: 'Сделка по кукурузе / Моршанск',
    sourceType: 'MANUAL',
    sourceReference: null,
    readiness: {
      state: 'REVIEW',
      blockers: [sharedDocsBlocker],
      nextStep: 'Дозагрузить акт приёмки и после этого запросить выпуск денег.',
      nextOwner: 'Продавец',
    },
    queueState: 'processing',
    nextStep: 'Дождаться завершения банковой проверки.',
    nextOwner: 'Банк',
    lastSyncAt: '2026-04-15 10:57',
    connectorStatus: {
      ESIA: connectors[0],
      FGIS: connectors[1],
    },
  },
];

export const queueEntries: QueueEntry[] = [
  {
    id: 'Q-1001',
    connectorType: 'FGIS',
    objectType: 'lot',
    objectId: 'LOT-2401',
    queueState: 'failed',
    reasonCodes: ['FGIS_GATE_FAIL', 'SOURCE_REFERENCE_MISMATCH'],
    updatedAt: '2026-04-15 10:31',
    owner: 'Оператор',
  },
  {
    id: 'Q-1002',
    connectorType: 'ESIA',
    objectType: 'party',
    objectId: 'SELLER-18',
    queueState: 'pending',
    reasonCodes: ['ESIA_REAUTH_REQUIRED'],
    updatedAt: '2026-04-15 10:42',
    owner: 'Комплаенс',
  },
  {
    id: 'Q-1003',
    connectorType: 'FGIS',
    objectType: 'deal',
    objectId: 'DL-2402',
    queueState: 'processing',
    reasonCodes: ['DOCS_AWAITING'],
    updatedAt: '2026-04-15 10:57',
    owner: 'Банк',
  },
];

export const roleReadinessCards: RoleReadinessCard[] = [
  {
    id: 'RR-operator',
    title: 'Оператор',
    role: 'operator',
    readinessState: 'FAIL',
    blockerSummary: '3 элемента очереди требуют ручного разбора.',
    nextRail: 'Открыть очередь ESIA/ФГИС и снять blocker по LOT-2401.',
    href: '/platform-v7/operator-cockpit/queues',
  },
  {
    id: 'RR-buyer',
    title: 'Покупатель',
    role: 'buyer',
    readinessState: 'REVIEW',
    blockerSummary: 'Есть сделки с ручной FGIS-проверкой перед выбором победителя.',
    nextRail: 'Открыть торг AUC-2402 и принять ручное решение.',
    href: '/platform-v7/auctions/AUC-2402',
  },
  {
    id: 'RR-seller',
    title: 'Продавец',
    role: 'seller',
    readinessState: 'FAIL',
    blockerSummary: 'Не хватает пакета документов для выпуска денег.',
    nextRail: 'Открыть создание/импорт лота и увидеть blocker reasons.',
    href: '/platform-v7/lots/create',
  },
  {
    id: 'RR-bank',
    title: 'Банк',
    role: 'bank',
    readinessState: 'REVIEW',
    blockerSummary: 'Есть сделки с pending ingestion и ручным выпуском.',
    nextRail: 'Открыть deal DL-2402 и проверить readiness section.',
    href: '/platform-v7/deals/DL-2402',
  },
];

export function getAuctionById(id: string) {
  return auctions.find((item) => item.id === id) ?? null;
}

export function getDealById(id: string) {
  return deals.find((item) => item.id === id) ?? null;
}

export function getReadinessTone(state: ReadinessState): 'success' | 'warning' | 'danger' {
  if (state === 'PASS') return 'success';
  if (state === 'REVIEW') return 'warning';
  return 'danger';
}

export function getConnectionTone(state: ConnectionState): 'success' | 'warning' | 'danger' | 'neutral' {
  if (state === 'connected') return 'success';
  if (state === 'degraded') return 'warning';
  if (state === 'disconnected') return 'danger';
  return 'neutral';
}

export function getQueueTone(state: QueueState): 'success' | 'warning' | 'danger' | 'neutral' {
  if (state === 'done') return 'success';
  if (state === 'processing' || state === 'pending') return 'warning';
  if (state === 'failed') return 'danger';
  return 'neutral';
}
