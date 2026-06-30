import type { MarketPriceRecord, MarketRouteQuote, MarketSide } from './market-entry-foundation';
import { deliveredMarketPrice } from './market-entry-foundation';

export type MarketIntentStatus = 'draft' | 'requires_gate';

export interface MarketIntentDraft {
  readonly id: string;
  readonly idempotencyKey: string;
  readonly side: MarketSide;
  readonly crop: string;
  readonly volumeTons: number;
  readonly sourcePriceId: string;
  readonly routeId: string;
  readonly sourcePricePerTon: number;
  readonly deliveredPricePerTon: number;
  readonly status: MarketIntentStatus;
}

export function parseIntentVolume(value: string): number {
  const parsed = Number(value.replace(',', '.'));
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return parsed;
}

export function marketIntentIdempotencyKey(side: MarketSide, volumeTons: number, price: MarketPriceRecord, route: MarketRouteQuote): string {
  return `market-intent:${side}:${price.id}:${route.id}:${volumeTons}`;
}

export function buildMarketIntentDraft(side: MarketSide, volumeInput: string, price: MarketPriceRecord, route: MarketRouteQuote): MarketIntentDraft | null {
  const volumeTons = parseIntentVolume(volumeInput);
  if (volumeTons <= 0) return null;
  const idempotencyKey = marketIntentIdempotencyKey(side, volumeTons, price, route);
  return {
    id: idempotencyKey,
    idempotencyKey,
    side,
    crop: price.crop,
    volumeTons,
    sourcePriceId: price.id,
    routeId: route.id,
    sourcePricePerTon: price.pricePerTon,
    deliveredPricePerTon: deliveredMarketPrice(price, route),
    status: 'requires_gate',
  };
}
