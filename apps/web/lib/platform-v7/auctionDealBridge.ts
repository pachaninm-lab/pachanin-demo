import { FGIS_AUCTION_STATE, kgToTons, type FgisLotSnapshot } from './fgisAuctionEngine';
import type { PlatformV7RouteIconKey } from './platformV7RouteIcons';

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
  fgisLotNumber: string;
  sdizNumber: string;
  ownerInn: string;
  ownerName: string;
  culture: string;
  className: string;
  region: string;
  basis: string;
  storagePlace: string;
  volumeTons: number;
  availableWeightKg: number;
  startPriceRubPerTon: number;
  stage: AuctionStage;
  bids: AuctionBid[];
};

export type AuctionNextAction = {
  label: string;
  href: string;
  owner: string;
  iconKey: PlatformV7RouteIconKey;
  resultLabel: string;
};

export type AuctionDealBasis = {
  dealId: string;
  winner: AuctionBid;
  winnerBidId: string;
  lotNumber: string;
  sdizNumber: string;
  ownerInn: string;
  sellerName: string;
  buyerName: string;
  culture: string;
  className: string;
  region: string;
  storagePlace: string;
  priceRubPerTon: number;
  volumeTons: number;
  availableWeightKg: number;
  amountRub: number;
  deliveryTerms: string;
  journalLocks: Array<{ label: string; owner: string }>;
  readinessReasons: string[];
  nextRoutes: AuctionNextAction[];
};

export type AuctionDealBasisGuard = {
  key: string;
  label: string;
  status: 'ok' | 'block';
  owner: string;
};

export type AuctionDealBridge = {
  lot: AuctionLot;
  winnerBid?: AuctionBid;
  dealBasis?: AuctionDealBasis;
  nextActions: AuctionNextAction[];
  controls: string[];
  risks: string[];
};

function buildLotFromFgis(fgisLot: FgisLotSnapshot): AuctionLot {
  return {
    id: 'LOT-2607-014',
    fgisLotNumber: fgisLot.lotNumber,
    sdizNumber: fgisLot.sdizNumber ?? '',
    ownerInn: fgisLot.ownerInn,
    ownerName: fgisLot.ownerName,
    culture: fgisLot.culture,
    className: fgisLot.className,
    region: fgisLot.region,
    basis: 'CPT элеватор',
    storagePlace: fgisLot.elevatorName,
    volumeTons: kgToTons(fgisLot.availableWeightKg),
    availableWeightKg: fgisLot.availableWeightKg,
    startPriceRubPerTon: 12400,
    stage: 'deal_basis_ready',
    bids: [
      { id: 'BID-001', buyerName: 'Покупатель А', priceRubPerTon: 12550, volumeTons: kgToTons(fgisLot.availableWeightKg), placedAt: '10:14' },
      { id: 'BID-002', buyerName: 'Покупатель Б', priceRubPerTon: 12630, volumeTons: kgToTons(fgisLot.availableWeightKg), placedAt: '10:19', isWinner: true },
      { id: 'BID-003', buyerName: 'Покупатель В', priceRubPerTon: 12610, volumeTons: kgToTons(fgisLot.availableWeightKg), placedAt: '10:22' },
    ],
  };
}

const lot = buildLotFromFgis(FGIS_AUCTION_STATE.lot);
const winnerBid = lot.bids.find((bid) => bid.isWinner);

const dealBasis: AuctionDealBasis | undefined = winnerBid
  ? {
      dealId: 'DL-2607-014',
      winner: winnerBid,
      winnerBidId: winnerBid.id,
      lotNumber: lot.fgisLotNumber,
      sdizNumber: lot.sdizNumber,
      ownerInn: lot.ownerInn,
      sellerName: lot.ownerName,
      buyerName: winnerBid.buyerName,
      culture: lot.culture,
      className: lot.className,
      region: lot.region,
      storagePlace: lot.storagePlace,
      priceRubPerTon: winnerBid.priceRubPerTon,
      volumeTons: winnerBid.volumeTons,
      availableWeightKg: lot.availableWeightKg,
      amountRub: winnerBid.priceRubPerTon * winnerBid.volumeTons,
      deliveryTerms: `${lot.basis}; приёмка и документы фиксируются до банковской проверки`,
      journalLocks: [
        { label: 'победившая ставка и цена', owner: 'Оператор' },
        { label: 'ФГИС-лот, СДИЗ и владелец партии', owner: 'Комплаенс' },
        { label: 'покупатель, объём и сумма сделки', owner: 'Оператор' },
        { label: 'основание для рейса и последующей приёмки', owner: 'Логистика' },
      ],
      readinessReasons: [
        'есть победитель с зафиксированной ставкой',
        'лот ФГИС и СДИЗ сохранены в основании сделки',
        'объём сделки не превышает доступную массу партии',
        'следующий этап ведёт в рейс, а не в самостоятельный платёж',
      ],
      nextRoutes: [
        { label: 'Назначить рейс', href: '/platform-v7/deal-logistics', owner: 'Логистика', iconKey: 'logistics', resultLabel: 'создать рейс из основания сделки' },
        { label: 'Открыть документы', href: '/platform-v7/deal-documents-basis', owner: 'Оператор', iconKey: 'documents', resultLabel: 'проверить договор, СДИЗ, вес, качество и УПД' },
        { label: 'Открыть спор', href: '/platform-v7/disputes', owner: 'Арбитр', iconKey: 'dispute', resultLabel: 'связать спор со сделкой и доказательствами' },
        { label: 'Вернуться к ставкам', href: '/platform-v7/auction/bids', owner: 'Оператор', iconKey: 'auction', resultLabel: 'сверить журнал ставок' },
      ],
    }
  : undefined;

export const AUCTION_DEAL_BRIDGE: AuctionDealBridge = {
  lot,
  winnerBid,
  dealBasis,
  nextActions: dealBasis?.nextRoutes ?? [
    { label: 'Вернуться к ставкам', href: '/platform-v7/auction/bids', owner: 'Оператор', iconKey: 'auction', resultLabel: 'выбрать победителя' },
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

export const AUCTION_DEAL_BASIS = dealBasis;

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
  return AUCTION_DEAL_BASIS?.amountRub ?? 0;
}

export function guardAuctionDealBasisReady(basis: AuctionDealBasis | undefined = AUCTION_DEAL_BASIS): AuctionDealBasisGuard[] {
  const availableTons = basis ? kgToTons(basis.availableWeightKg) : 0;
  const routes = basis?.nextRoutes ?? [];

  return [
    { key: 'winner', label: 'deal-basis contains winner', status: basis?.winner ? 'ok' : 'block', owner: 'Оператор' },
    { key: 'lotNumber', label: 'deal-basis contains lotNumber', status: basis?.lotNumber ? 'ok' : 'block', owner: 'Комплаенс' },
    { key: 'sdizNumber', label: 'deal-basis contains sdizNumber', status: basis?.sdizNumber ? 'ok' : 'block', owner: 'Комплаенс' },
    { key: 'priceRubPerTon', label: 'deal-basis contains priceRubPerTon', status: basis && basis.priceRubPerTon > 0 ? 'ok' : 'block', owner: 'Оператор' },
    { key: 'deal-logistics', label: 'deal-basis contains /platform-v7/deal-logistics', status: routes.some((route) => route.href === '/platform-v7/deal-logistics') ? 'ok' : 'block', owner: 'Логистика' },
    { key: 'route-icons', label: 'deal-basis contains route icons', status: routes.every((route) => Boolean(route.iconKey)) && routes.length > 0 ? 'ok' : 'block', owner: 'UX' },
    { key: 'winner-price-match', label: 'ставка победителя совпадает с основанием сделки', status: basis && basis.priceRubPerTon === basis.winner.priceRubPerTon ? 'ok' : 'block', owner: 'Оператор' },
    { key: 'volume-within-available', label: 'объём не превышает доступную массу', status: basis && basis.volumeTons <= availableTons ? 'ok' : 'block', owner: 'Комплаенс' },
  ];
}

export function isAuctionDealBasisReady(basis: AuctionDealBasis | undefined = AUCTION_DEAL_BASIS) {
  return guardAuctionDealBasisReady(basis).every((item) => item.status === 'ok');
}
