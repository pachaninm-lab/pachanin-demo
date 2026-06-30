import type { MarketIntentDraft } from './market-entry-intent';

export interface MarketLotDraft {
  readonly sourceIntentId: string;
  readonly grain: string;
  readonly volumeTons: number;
  readonly pricePerTon: number;
  readonly basis: 'EXW';
  readonly docsReady: false;
}

export interface MarketRfqDraft {
  readonly sourceIntentId: string;
  readonly crop: string;
  readonly volumeTons: number;
  readonly targetPricePerTon: number;
  readonly deliveredPricePerTon: number;
  readonly status: 'draft';
}

export function convertMarketIntentToLotDraft(intent: MarketIntentDraft): MarketLotDraft | null {
  if (intent.side !== 'sell') return null;
  return {
    sourceIntentId: intent.id,
    grain: intent.crop,
    volumeTons: intent.volumeTons,
    pricePerTon: intent.sourcePricePerTon,
    basis: 'EXW',
    docsReady: false,
  };
}

export function convertMarketIntentToRfqDraft(intent: MarketIntentDraft): MarketRfqDraft | null {
  if (intent.side !== 'buy') return null;
  return {
    sourceIntentId: intent.id,
    crop: intent.crop,
    volumeTons: intent.volumeTons,
    targetPricePerTon: intent.sourcePricePerTon,
    deliveredPricePerTon: intent.deliveredPricePerTon,
    status: 'draft',
  };
}
