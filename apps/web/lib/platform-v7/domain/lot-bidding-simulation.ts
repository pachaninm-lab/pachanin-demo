import { auctions, lots, type LotItem, type ReadinessState } from '@/lib/v7r/esia-fgis-data';
import { selectRuntimeDealByLotId } from '@/lib/domain/selectors';

export type LotBidStatus = 'leader' | 'outbid' | 'winner' | 'blocked';
export type AuctionState = 'blocked_by_gate' | 'open' | 'selection_ready' | 'deal_created';
export type AuctionRoleKey = 'seller' | 'buyer' | 'operator' | 'compliance' | 'bank' | 'logistics' | 'elevator' | 'lab' | 'surveyor' | 'arbitrator';

export interface LotBid {
  id: string;
  buyerId: string;
  buyer: string;
  pricePerTon: number;
  volumeTons: number;
  payment: string;
  logistics: string;
  submittedAt: string;
  score: number;
  status: LotBidStatus;
  nextStep: string;
}

export interface AuctionRoleClosure {
  role: AuctionRoleKey;
  label: string;
  route: string;
  sees: string;
  action: string;
  next: string;
  closed: boolean;
}

export interface AuctionAuditStep {
  time: string;
  actor: string;
  action: string;
  result: string;
}

export interface LotBiddingSimulation {
  lot: LotItem;
  auctionId: string;
  auctionState: AuctionState;
  auctionStateLabel: string;
  bids: LotBid[];
  winnerBidId: string | null;
  resultingDealId: string | null;
  resultingDealTitle: string | null;
  chain: string[];
  sharedViewHash: string;
  bestPricePerTon: number | null;
  bestTotalRub: number | null;
  gateState: ReadinessState;
  gateLabel: string;
  roleClosures: AuctionRoleClosure[];
  auditTrail: AuctionAuditStep[];
}

const fallbackDealByLot: Record<string, string> = {
  'LOT-2403': 'DL-9106',
  'LOT-2404': 'DL-9112',
  'LOT-2405': 'DL-9113',
  'LOT-2408': 'DL-9116',
  'LOT-2409': 'DL-9117',
  'LOT-2414': 'DL-9120',
};

function basePrice(lot: LotItem): number {
  if (lot.grain.includes('Пшеница 3')) return 28900;
  if (lot.grain.includes('Пшеница 4')) return 30000;
  if (lot.grain.includes('Подсолнечник')) return 33000;
  if (lot.grain.includes('Кукуруза')) return 31000;
  if (lot.grain.includes('Ячмень')) return 19000;
  if (lot.grain.includes('Рапс')) return 24000;
  return 21000;
}

function gateLabel(state: ReadinessState) {
  if (state === 'PASS') return 'Допуск чистый';
  if (state === 'REVIEW') return 'Нужна проверка';
  return 'Торг остановлен';
}

function auctionStateLabel(state: AuctionState) {
  if (state === 'deal_created') return 'Победитель выбран, сделка создана';
  if (state === 'selection_ready') return 'Можно выбрать победителя';
  if (state === 'open') return 'Идёт сбор ставок';
  return 'Торг заблокирован допуском';
}

function auctionState(lot: LotItem, dealId: string | null): AuctionState {
  if (lot.readiness.state !== 'PASS') return 'blocked_by_gate';
  if (dealId) return 'deal_created';
  return 'selection_ready';
}

function auctionIdByLotId(lotId: string) {
  return auctions.find((auction) => auction.lotId === lotId)?.id ?? `AUC-${lotId.replace('LOT-', '')}`;
}

function buildBids(lot: LotItem, preferredBuyer: string | null): LotBid[] {
  const price = basePrice(lot);
  const blocked = lot.readiness.state !== 'PASS';
  const winnerBuyer = preferredBuyer ?? 'АО «АгроТрейд»';

  return [
    {
      id: `${lot.id}-BID-01`,
      buyerId: 'BUYER-01',
      buyer: winnerBuyer,
      pricePerTon: price + 350,
      volumeTons: lot.volumeTons,
      payment: 'резерв денег через банк',
      logistics: 'платформенная логистика',
      submittedAt: '10:12',
      score: 97,
      status: blocked ? 'blocked' : 'winner',
      nextStep: blocked ? 'Ждёт снятия стоп-фактора по лоту' : 'Переходит в сделку и резерв денег',
    },
    {
      id: `${lot.id}-BID-02`,
      buyerId: 'BUYER-02',
      buyer: preferredBuyer === 'ООО «ЗерноИнвест»' ? 'АО «АгроТрейд»' : 'ООО «ЗерноИнвест»',
      pricePerTon: price,
      volumeTons: lot.volumeTons,
      payment: 'частичная предоплата 30%',
      logistics: 'самовывоз покупателя',
      submittedAt: '10:07',
      score: 84,
      status: blocked ? 'blocked' : 'outbid',
      nextStep: blocked ? 'Ставка заморожена до проверки допуска' : 'Может повысить цену или уточнить условия',
    },
    {
      id: `${lot.id}-BID-03`,
      buyerId: 'BUYER-03',
      buyer: preferredBuyer === 'ГК «Экспортёр Юг»' ? 'ООО «ЗерноИнвест»' : 'ГК «Экспортёр Юг»',
      pricePerTon: price - 250,
      volumeTons: Math.max(Math.round(lot.volumeTons * 0.75), 1),
      payment: 'постоплата после приёмки',
      logistics: 'заявка перевозчику после выбора',
      submittedAt: '09:58',
      score: 76,
      status: blocked ? 'blocked' : 'outbid',
      nextStep: blocked ? 'Нет движения до снятия блокера' : 'Может изменить объём, цену или схему оплаты',
    },
  ];
}

function roleClosures(lot: LotItem, auctionId: string, dealId: string | null, gateState: ReadinessState): AuctionRoleClosure[] {
  const dealRoute = dealId ? `/platform-v7/deals/${dealId}` : `/platform-v7/lots/${lot.id}`;
  const blocked = gateState !== 'PASS';

  return [
    {
      role: 'seller',
      label: 'Продавец',
      route: `/platform-v7/lots/${lot.id}`,
      sees: 'свой лот, все ставки, допуск, победителя и переход в сделку',
      action: blocked ? 'закрывает документы или допуск' : 'подтверждает победителя',
      next: blocked ? 'вернуть лот в торг' : dealRoute,
      closed: true,
    },
    {
      role: 'buyer',
      label: 'Покупатель',
      route: `/platform-v7/buyer?auction=${auctionId}`,
      sees: 'тот же торговый экран: лот, ставки, лидер, статус своей заявки и сделку',
      action: blocked ? 'ждёт допуска или меняет условия заявки' : 'подтверждает резерв денег',
      next: blocked ? `/platform-v7/lots/${lot.id}` : dealRoute,
      closed: true,
    },
    {
      role: 'operator',
      label: 'Оператор',
      route: '/platform-v7/control-tower',
      sees: 'единый auction-state, блокеры, связку лот → ставка → сделка',
      action: blocked ? 'снимает причину остановки' : 'контролирует переход в исполнение',
      next: dealRoute,
      closed: true,
    },
    {
      role: 'compliance',
      label: 'Комплаенс',
      route: '/platform-v7/compliance',
      sees: 'ESIA/ФГИС-допуск, участника и риск обхода сделки',
      action: blocked ? 'проверяет участника и источник партии' : 'фиксирует чистый gate',
      next: `/platform-v7/lots/${lot.id}`,
      closed: true,
    },
    {
      role: 'bank',
      label: 'Банк',
      route: dealRoute,
      sees: 'выбранную ставку, сумму резерва и основание для движения денег',
      action: blocked ? 'не резервирует деньги' : 'подтверждает резерв и будущий выпуск',
      next: dealRoute,
      closed: true,
    },
    {
      role: 'logistics',
      label: 'Логистика',
      route: '/platform-v7/logistics',
      sees: 'победившую сделку без лишних банковских деталей',
      action: blocked ? 'не получает заявку' : 'создаёт перевозку и рейс',
      next: '/platform-v7/logistics',
      closed: true,
    },
    {
      role: 'elevator',
      label: 'Элеватор',
      route: '/platform-v7/elevator',
      sees: 'рейс, приёмку, вес и отклонения',
      action: blocked ? 'ждёт рейс' : 'фиксирует въезд, вес и приёмку',
      next: '/platform-v7/elevator',
      closed: true,
    },
    {
      role: 'lab',
      label: 'Лаборатория',
      route: '/platform-v7/lab',
      sees: 'пробу, качество и протокол как доказательство',
      action: blocked ? 'ждёт пробу' : 'подтверждает качество или открывает отклонение',
      next: '/platform-v7/lab',
      closed: true,
    },
    {
      role: 'surveyor',
      label: 'Сюрвейер',
      route: '/platform-v7/surveyor',
      sees: 'проверку факта погрузки, пломбы, фото и отклонения',
      action: blocked ? 'ждёт назначения' : 'добавляет независимое подтверждение',
      next: '/platform-v7/surveyor',
      closed: true,
    },
    {
      role: 'arbitrator',
      label: 'Арбитр',
      route: '/platform-v7/arbitrator',
      sees: 'доказательства, спор и основание удержания денег',
      action: blocked ? 'не вмешивается до сделки' : 'включается только при споре',
      next: '/platform-v7/arbitrator',
      closed: true,
    },
  ];
}

function auditTrail(lot: LotItem, dealId: string | null): AuctionAuditStep[] {
  const blocked = lot.readiness.state !== 'PASS';
  return [
    { time: '09:40', actor: 'Продавец', action: 'Лот опубликован', result: `${lot.id} доступен в торговом контуре` },
    { time: '09:58', actor: 'Покупатель', action: 'Первая ставка подана', result: blocked ? 'ставка ждёт допуска' : 'ставка принята в торг' },
    { time: '10:07', actor: 'Покупатель', action: 'Конкурентная ставка подана', result: blocked ? 'ставка заморожена' : 'цена обновлена' },
    { time: '10:12', actor: 'Покупатель', action: 'Лучшая ставка подана', result: blocked ? 'ждёт gate' : 'выбран лидер' },
    { time: '10:18', actor: 'Оператор', action: 'Проверка допуска', result: gateLabel(lot.readiness.state) },
    { time: '10:24', actor: 'Система', action: 'Связка сделки', result: dealId ? `${lot.id} → ${dealId}` : 'сделка не создана' },
  ];
}

export function rankLotBids(bids: readonly LotBid[]): LotBid[] {
  return [...bids].sort((a, b) => b.pricePerTon - a.pricePerTon || b.score - a.score);
}

export function resolveLotIdByAuctionId(auctionId: string): string | null {
  const explicit = auctions.find((item) => item.id === auctionId);
  if (explicit) return explicit.lotId;
  if (auctionId.startsWith('AUC-')) return `LOT-${auctionId.replace('AUC-', '')}`;
  return null;
}

export function selectLotBiddingSimulation(lotId: string): LotBiddingSimulation | null {
  const lot = lots.find((item) => item.id === lotId);
  if (!lot) return null;

  const linkedDeal = selectRuntimeDealByLotId(lot.id);
  const resultingDealId = linkedDeal?.id ?? fallbackDealByLot[lot.id] ?? null;
  const preferredBuyer = linkedDeal?.buyer.name ?? null;
  const bids = rankLotBids(buildBids(lot, preferredBuyer));
  const winnerBid = lot.readiness.state === 'PASS' ? bids.find((bid) => bid.status === 'winner') ?? bids[0] : null;
  const auctionId = auctionIdByLotId(lot.id);
  const state = auctionState(lot, resultingDealId);
  const bestPricePerTon = winnerBid?.pricePerTon ?? null;
  const bestTotalRub = winnerBid ? winnerBid.pricePerTon * winnerBid.volumeTons : null;

  return {
    lot,
    auctionId,
    auctionState: state,
    auctionStateLabel: auctionStateLabel(state),
    bids,
    winnerBidId: winnerBid?.id ?? null,
    resultingDealId,
    resultingDealTitle: linkedDeal ? `${linkedDeal.id} · ${linkedDeal.grain}` : resultingDealId,
    chain: ['Лот', 'Ставки', 'Победитель', 'Сделка', 'Логистика', 'Приёмка', 'Документы', 'Деньги'],
    sharedViewHash: `${lot.id}:${auctionId}:${bids.map((bid) => `${bid.id}:${bid.pricePerTon}:${bid.status}`).join('|')}:${resultingDealId ?? 'NO_DEAL'}`,
    bestPricePerTon,
    bestTotalRub,
    gateState: lot.readiness.state,
    gateLabel: gateLabel(lot.readiness.state),
    roleClosures: roleClosures(lot, auctionId, resultingDealId, lot.readiness.state),
    auditTrail: auditTrail(lot, resultingDealId),
  };
}

export function selectWinningLotBid(simulation: LotBiddingSimulation): LotBid | null {
  if (!simulation.winnerBidId) return null;
  return simulation.bids.find((bid) => bid.id === simulation.winnerBidId) ?? null;
}
