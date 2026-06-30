export type MarketEntryStatus = 'ready' | 'partial' | 'source_required' | 'blocked';
export type MarketSide = 'sell' | 'buy';
export type MarketBasis = 'EXW' | 'FCA' | 'CPT';

export interface MarketEntryFlowStep {
  readonly title: string;
  readonly text: string;
}

export interface MarketPriceRecord {
  readonly id: string;
  readonly crop: string;
  readonly region: string;
  readonly basis: MarketBasis;
  readonly pricePerTon: number;
  readonly weeklyDeltaPerTon: number;
  readonly sourceName: string;
  readonly sourceUrl: string;
  readonly observedAt: string;
  readonly status: MarketEntryStatus;
}

export interface MarketRouteQuote {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly distanceKm: number;
  readonly ratePerKm: number;
  readonly loadingCost: number;
  readonly idleCost: number;
  readonly payloadTons: number;
  readonly status: MarketEntryStatus;
}

export interface MarketGateItem {
  readonly id: string;
  readonly label: string;
  readonly status: MarketEntryStatus;
  readonly note: string;
}

export const MARKET_ENTRY_FLOW: readonly MarketEntryFlowStep[] = [
  { title: 'Цена', text: 'Источник, дата, культура, регион и базис фиксируются до заявки.' },
  { title: 'Заявка', text: 'Сторона формирует намерение с объемом, качеством и сроком.' },
  { title: 'Предложение', text: 'Условия сравниваются по цене, логистике, оплате, документам и риску.' },
  { title: 'Проверка', text: 'Контрагент, документы и деньги проходят предсделочный контроль.' },
  { title: 'Сделка', text: 'Только проверенное основание переходит в контур исполнения.' },
  { title: 'Исполнение', text: 'Рейс, приемка, качество, документы, деньги, спор и доказательства остаются внутри процесса.' },
] as const;

export const MARKET_PRICE_RECORDS: readonly MarketPriceRecord[] = [
  { id: 'wheat-4-prozerno-2026-06-05', crop: 'Пшеница 4 класса', region: 'Россия', basis: 'EXW', pricePerTon: 14290, weeklyDeltaPerTon: -125, sourceName: 'ПроЗерно', sourceUrl: 'https://prozerno.ru/', observedAt: '2026-06-05', status: 'source_required' },
  { id: 'feed-barley-prozerno-2026-06-05', crop: 'Фуражный ячмень', region: 'Россия', basis: 'EXW', pricePerTon: 14080, weeklyDeltaPerTon: -265, sourceName: 'ПроЗерно', sourceUrl: 'https://prozerno.ru/', observedAt: '2026-06-05', status: 'source_required' },
  { id: 'sunflower-prozerno-2026-06-05', crop: 'Подсолнечник', region: 'Россия', basis: 'EXW', pricePerTon: 43135, weeklyDeltaPerTon: -90, sourceName: 'ПроЗерно', sourceUrl: 'https://prozerno.ru/', observedAt: '2026-06-05', status: 'source_required' },
] as const;

export const MARKET_ROUTE_QUOTES: readonly MarketRouteQuote[] = [
  { id: 'tambov-novo-auto', from: 'Тамбовская область', to: 'Новороссийск', distanceKm: 1080, ratePerKm: 115, loadingCost: 18000, idleCost: 9000, payloadTons: 22, status: 'partial' },
  { id: 'voronezh-rostov-auto', from: 'Воронежская область', to: 'Ростов-на-Дону', distanceKm: 560, ratePerKm: 105, loadingCost: 15000, idleCost: 6000, payloadTons: 22, status: 'partial' },
] as const;

export function marketEntryStatusLabel(status: MarketEntryStatus): string {
  if (status === 'ready') return 'готово';
  if (status === 'partial') return 'частично';
  if (status === 'source_required') return 'нужен источник';
  return 'стоп';
}

export function marketLogisticsCost(route: MarketRouteQuote): number {
  return route.distanceKm * route.ratePerKm + route.loadingCost + route.idleCost;
}

export function marketLogisticsCostPerTon(route: MarketRouteQuote): number {
  return Math.round(marketLogisticsCost(route) / route.payloadTons);
}

export function deliveredMarketPrice(price: MarketPriceRecord, route: MarketRouteQuote): number {
  return price.pricePerTon + marketLogisticsCostPerTon(route);
}

export function marketGate(price: MarketPriceRecord, route: MarketRouteQuote): readonly MarketGateItem[] {
  return [
    { id: 'price', label: 'Цена и базис', status: price.status, note: price.status === 'ready' ? 'источник подтвержден' : 'нужна регулярная сверка источника' },
    { id: 'party', label: 'Параметры партии', status: 'ready', note: 'культура, объем, базис и направление заполнены' },
    { id: 'logistics', label: 'Логистика', status: route.status, note: 'расчет есть, ставка требует подтверждения перед сделкой' },
    { id: 'counterparty', label: 'Контрагент', status: 'source_required', note: 'нужна карточка доверия и проверка документов' },
    { id: 'documents', label: 'Документы', status: 'partial', note: 'передаются в execution-контур как блокеры допуска' },
    { id: 'money', label: 'Деньги', status: 'partial', note: 'банк видит основание, но автосписания нет' },
  ] as const;
}

export function marketReadinessScore(items: readonly MarketGateItem[]): number {
  const weights: Record<MarketEntryStatus, number> = { ready: 1, partial: 0.55, source_required: 0.25, blocked: 0 };
  const value = items.reduce((sum, item) => sum + weights[item.status], 0) / items.length;
  return Math.round(value * 100);
}

export function marketIntentTargetHref(side: MarketSide): string {
  return side === 'sell' ? '/platform-v7/lots/create' : '/platform-v7/buyer/rfq/new';
}

export function marketIntentActionLabel(side: MarketSide): string {
  return side === 'sell' ? 'Создать лот продавца' : 'Создать RFQ покупателя';
}
