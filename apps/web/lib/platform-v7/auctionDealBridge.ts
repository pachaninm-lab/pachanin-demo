export type AuctionStage =
  | 'lot_draft'
  | 'lot_admitted'
  | 'bidding_window'
  | 'winner_locked'
  | 'deal_basis_ready'
  | 'deal_created';

export type AuctionBid = {
  id: string;
  buyerName: string;
  priceRubPerTon: number;
  volumeTons: number;
  placedAt: string;
  isWinner?: boolean;
};

export type AuctionLot = {
  id: string;
  culture: string;
  className: string;
  region: string;
  basis: string;
  volumeTons: number;
  startPriceRubPerTon: number;
  stage: AuctionStage;
  bids: AuctionBid[];
};

export type AuctionDealBridge = {
  lot: AuctionLot;
  winnerBid?: AuctionBid;
  nextActions: Array<{ label: string; href: string; owner: string }>;
  controls: string[];
  risks: string[];
};

const lot: AuctionLot = {
  id: 'LOT-2607-014',
  culture: 'Пшеница',
  className: '4 класс',
  region: 'Тамбовская область',
  basis: 'CPT элеватор',
  volumeTons: 520,
  startPriceRubPerTon: 12400,
  stage: 'deal_basis_ready',
  bids: [
    { id: 'BID-001', buyerName: 'Покупатель А', priceRubPerTon: 12550, volumeTons: 520, placedAt: '10:14' },
    { id: 'BID-002', buyerName: 'Покупатель Б', priceRubPerTon: 12630, volumeTons: 520, placedAt: '10:19', isWinner: true },
    { id: 'BID-003', buyerName: 'Покупатель В', priceRubPerTon: 12610, volumeTons: 520, placedAt: '10:22' },
  ],
};

const winnerBid = lot.bids.find((bid) => bid.isWinner);

export const AUCTION_DEAL_BRIDGE: AuctionDealBridge = {
  lot,
  winnerBid,
  nextActions: [
    { label: 'Создать сделку', href: '/platform-v7/deals', owner: 'Оператор' },
    { label: 'Проверить допуск', href: '/platform-v7/compliance', owner: 'Комплаенс' },
    { label: 'Запустить рейсы', href: '/platform-v7/logistics', owner: 'Логистика' },
    { label: 'Подготовить документы', href: '/platform-v7/documents', owner: 'Оператор' },
    { label: 'Основание банка', href: '/platform-v7/bank', owner: 'Банк' },
  ],
  controls: [
    'ставка после фиксации не отменяется интерфейсом',
    'победитель не создаёт деньги сам по себе — только основание сделки',
    'логистика запускается после связки лот → победитель → сделка',
    'спор открывается из фактов приёмки, качества или документов',
  ],
  risks: [
    'обход платформы после выявления цены',
    'ставка без проверенного допуска покупателя',
    'разрыв цены и логистики',
    'нет доказательств по качеству и весу',
  ],
};

export function auctionStageLabel(stage: AuctionStage) {
  switch (stage) {
    case 'lot_draft': return 'Черновик лота';
    case 'lot_admitted': return 'Лот допущен';
    case 'bidding_window': return 'Окно ставок';
    case 'winner_locked': return 'Победитель зафиксирован';
    case 'deal_basis_ready': return 'Основание сделки готово';
    case 'deal_created': return 'Сделка создана';
    default: return 'Статус не определён';
  }
}

export function auctionDealAmountRub() {
  if (!winnerBid) return 0;
  return winnerBid.priceRubPerTon * winnerBid.volumeTons;
}
