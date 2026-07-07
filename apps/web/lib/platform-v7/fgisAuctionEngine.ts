export type FgisSourceKind = 'fgis_lot' | 'fgis_sdiz' | 'manual_review';
export type FgisImportStatus = 'not_connected' | 'requested' | 'matched' | 'requires_review' | 'rejected';
export type AuctionAdmissionStatus = 'blocked' | 'review_required' | 'admitted';
export type AuctionRunStatus = 'not_opened' | 'open' | 'closed' | 'winner_locked' | 'deal_basis_ready';

export type FgisLotSnapshot = {
  source: FgisSourceKind;
  importStatus: FgisImportStatus;
  lotNumber: string;
  sdizNumber?: string;
  ownerInn: string;
  ownerName: string;
  culture: string;
  className: string;
  purpose: string;
  region: string;
  elevatorName: string;
  availableWeightKg: number;
  lockedWeightKg: number;
  quality: Array<{ label: string; value: string }>;
  documents: Array<{ label: string; status: 'ok' | 'required' | 'review' }>;
};

export type AuctionBuyerGate = {
  buyerId: string;
  buyerName: string;
  admission: 'ok' | 'review' | 'blocked';
  limitRub: number;
  reason?: string;
};

export type AuctionGateCheck = {
  key: string;
  label: string;
  status: 'ok' | 'review' | 'block';
  owner: string;
};

export type AuctionBidRule = {
  key: string;
  label: string;
};

export type FgisAuctionState = {
  lot: FgisLotSnapshot;
  admission: AuctionAdmissionStatus;
  runStatus: AuctionRunStatus;
  checks: AuctionGateCheck[];
  buyers: AuctionBuyerGate[];
  bidRules: AuctionBidRule[];
  nextRoutes: Array<{ label: string; href: string; owner: string }>;
};

export const FGIS_AUCTION_STATE: FgisAuctionState = {
  lot: {
    source: 'fgis_lot',
    importStatus: 'matched',
    lotNumber: 'FGIS-LOT-2607-014',
    sdizNumber: 'SDIZ-2607-5512',
    ownerInn: '6829000000',
    ownerName: 'ООО «АгроПоставка»',
    culture: 'Пшеница',
    className: '4 класс',
    purpose: 'реализация',
    region: 'Тамбовская область',
    elevatorName: 'Элеватор №17',
    availableWeightKg: 520000,
    lockedWeightKg: 0,
    quality: [
      { label: 'Влажность', value: '13,8%' },
      { label: 'Клейковина', value: '21%' },
      { label: 'Сорная примесь', value: '2,0%' },
      { label: 'Зараженность', value: 'не выявлена' },
    ],
    documents: [
      { label: 'Партия ФГИС', status: 'ok' },
      { label: 'СДИЗ', status: 'ok' },
      { label: 'Качество', status: 'review' },
      { label: 'Договор поставки', status: 'required' },
    ],
  },
  admission: 'review_required',
  runStatus: 'not_opened',
  checks: [
    { key: 'fgis-match', label: 'лот найден в ФГИС и совпадает с владельцем', status: 'ok', owner: 'Комплаенс' },
    { key: 'weight-free', label: 'доступная масса не заблокирована другой сделкой', status: 'ok', owner: 'Оператор' },
    { key: 'sdiz-present', label: 'СДИЗ привязан к партии', status: 'ok', owner: 'Комплаенс' },
    { key: 'quality-review', label: 'показатели качества требуют подтверждения перед торгами', status: 'review', owner: 'Лаборатория' },
    { key: 'bank-basis', label: 'банковское основание появится только после победителя и сделки', status: 'review', owner: 'Банк' },
  ],
  buyers: [
    { buyerId: 'buyer-1', buyerName: 'Покупатель А', admission: 'ok', limitRub: 8600000 },
    { buyerId: 'buyer-2', buyerName: 'Покупатель Б', admission: 'review', limitRub: 7400000, reason: 'нужна проверка полномочий' },
    { buyerId: 'buyer-3', buyerName: 'Покупатель В', admission: 'blocked', limitRub: 0, reason: 'нет допуска к закупке' },
  ],
  bidRules: [
    { key: 'admitted-buyer-only', label: 'ставку делает только покупатель с допуском' },
    { key: 'volume-lock', label: 'объём ставки не может превышать доступную массу партии' },
    { key: 'journal-fixed', label: 'ставка фиксируется в журнале и не удаляется задним числом' },
    { key: 'no-direct-contact', label: 'контакт сторон после цены остаётся внутри платформы' },
    { key: 'winner-to-deal', label: 'победитель создаёт основание сделки, а не платёж' },
  ],
  nextRoutes: [
    { label: 'Импорт ФГИС', href: '/platform-v7/auction/import', owner: 'Оператор' },
    { label: 'Допуск к торгам', href: '/platform-v7/auction/admission', owner: 'Комплаенс' },
    { label: 'Окно ставок', href: '/platform-v7/auction/bids', owner: 'Покупатель' },
    { label: 'Основание сделки', href: '/platform-v7/auction/deal-basis', owner: 'Оператор' },
  ],
};

export function kgToTons(value: number) {
  return value / 1000;
}

export function canOpenAuction(state: FgisAuctionState) {
  return state.checks.every((check) => check.status !== 'block') && state.checks.filter((check) => check.status === 'review').length === 0;
}

export function admissionLabel(status: AuctionAdmissionStatus) {
  if (status === 'admitted') return 'допущен к торгам';
  if (status === 'review_required') return 'требует проверки';
  return 'заблокирован';
}

export function importStatusLabel(status: FgisImportStatus) {
  switch (status) {
    case 'matched': return 'лот сверен';
    case 'requested': return 'запрос отправлен';
    case 'requires_review': return 'требует проверки';
    case 'rejected': return 'отклонён';
    default: return 'ожидает подключения';
  }
}
