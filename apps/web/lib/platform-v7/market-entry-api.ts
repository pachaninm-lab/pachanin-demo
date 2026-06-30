import { MARKET_PRICE_RECORDS, MARKET_ROUTE_QUOTES, type MarketSide } from './market-entry-foundation';
import { buildMarketIntentDraft, type MarketIntentDraft } from './market-entry-intent';

export type MarketIntentApiStatus = 'accepted_preintegration' | 'rejected';
export type MarketIntentApiDurableStatus = 'not_wired' | 'not_attempted';

export interface MarketIntentApiInput {
  readonly side: MarketSide;
  readonly volume: string;
  readonly sourcePriceId: string;
  readonly routeId: string;
}

export interface MarketIntentApiResult {
  readonly status: MarketIntentApiStatus;
  readonly draft: MarketIntentDraft | null;
  readonly message: string;
  readonly durableStatus: MarketIntentApiDurableStatus;
}

export function parseMarketIntentApiInput(value: unknown): MarketIntentApiInput | null {
  if (!value || typeof value !== 'object') return null;
  const input = value as Partial<MarketIntentApiInput>;
  if (input.side !== 'sell' && input.side !== 'buy') return null;
  if (typeof input.volume !== 'string') return null;
  if (typeof input.sourcePriceId !== 'string') return null;
  if (typeof input.routeId !== 'string') return null;
  return { side: input.side, volume: input.volume, sourcePriceId: input.sourcePriceId, routeId: input.routeId };
}

export function buildMarketIntentApiResult(value: unknown): MarketIntentApiResult {
  const input = parseMarketIntentApiInput(value);
  if (!input) return { status: 'rejected', draft: null, message: 'Некорректный запрос намерения.', durableStatus: 'not_attempted' };
  const price = MARKET_PRICE_RECORDS.find((item) => item.id === input.sourcePriceId);
  const route = MARKET_ROUTE_QUOTES.find((item) => item.id === input.routeId);
  if (!price || !route) return { status: 'rejected', draft: null, message: 'Источник цены или маршрут не найден.', durableStatus: 'not_attempted' };
  const draft = buildMarketIntentDraft(input.side, input.volume, price, route);
  if (!draft) return { status: 'rejected', draft: null, message: 'Объём должен быть больше нуля.', durableStatus: 'not_attempted' };
  return { status: 'accepted_preintegration', draft, message: 'Намерение принято в предынтеграционный контур. Для федерального режима требуется durable storage.', durableStatus: 'not_wired' };
}
