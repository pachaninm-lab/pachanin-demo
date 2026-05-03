import { lots, type LotItem } from '@/lib/v7r/esia-fgis-data';
import { selectRuntimeDealByLotId } from '@/lib/domain/selectors';

export type LotBidStatus = 'leader' | 'outbid' | 'winner' | 'blocked';

export interface LotBid {
  id: string;
  buyer: string;
  pricePerTon: number;
  volumeTons: number;
  payment: string;
  logistics: string;
  submittedAt: string;
  score: number;
  status: LotBidStatus;
}

export interface LotBiddingSimulation {
  lot: LotItem;
  bids: LotBid[];
  winnerBidId: string | null;
  resultingDealId: string | null;
  chain: string[];
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

function buildBids(lot: LotItem): LotBid[] {
  const price = basePrice(lot);
  const blocked = lot.readiness.state !== 'PASS';

  return [
    {
      id: `${lot.id}-BID-01`,
      buyer: 'АО «АгроТрейд»',
      pricePerTon: price,
      volumeTons: lot.volumeTons,
      payment: 'резерв денег через банк',
      logistics: 'платформенная логистика',
      submittedAt: '10:12',
      score: 92,
      status: blocked ? 'blocked' : 'winner',
    },
    {
      id: `${lot.id}-BID-02`,
      buyer: 'ООО «ЗерноИнвест»',
      pricePerTon: price - 250,
      volumeTons: lot.volumeTons,
      payment: 'частичная предоплата 30%',
      logistics: 'самовывоз покупателя',
      submittedAt: '10:07',
      score: 84,
      status: blocked ? 'blocked' : 'outbid',
    },
    {
      id: `${lot.id}-BID-03`,
      buyer: 'ГК «Экспортёр Юг»',
      pricePerTon: price - 400,
      volumeTons: Math.max(Math.round(lot.volumeTons * 0.75), 1),
      payment: 'постоплата после приёмки',
      logistics: 'заявка перевозчику после выбора',
      submittedAt: '09:58',
      score: 76,
      status: blocked ? 'blocked' : 'outbid',
    },
  ];
}

export function rankLotBids(bids: readonly LotBid[]): LotBid[] {
  return [...bids].sort((a, b) => b.pricePerTon - a.pricePerTon || b.score - a.score);
}

export function selectLotBiddingSimulation(lotId: string): LotBiddingSimulation | null {
  const lot = lots.find((item) => item.id === lotId);
  if (!lot) return null;

  const linkedDeal = selectRuntimeDealByLotId(lot.id);
  const resultingDealId = linkedDeal?.id ?? fallbackDealByLot[lot.id] ?? null;
  const bids = rankLotBids(buildBids(lot));
  const winnerBid = lot.readiness.state === 'PASS' ? bids.find((bid) => bid.status === 'winner') ?? bids[0] : null;

  return {
    lot,
    bids,
    winnerBidId: winnerBid?.id ?? null,
    resultingDealId,
    chain: ['Лот', 'Ставки', 'Победитель', 'Сделка', 'Логистика', 'Приёмка', 'Документы', 'Деньги'],
  };
}

export function selectWinningLotBid(simulation: LotBiddingSimulation): LotBid | null {
  if (!simulation.winnerBidId) return null;
  return simulation.bids.find((bid) => bid.id === simulation.winnerBidId) ?? null;
}
