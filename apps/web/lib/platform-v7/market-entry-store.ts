import type { MarketIntentDraft } from './market-entry-intent';

export const MARKET_INTENT_STORAGE_KEY = 'platform-v7.market-entry.intents.v1';

export interface MarketIntentStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function readMarketIntents(storage: MarketIntentStorageLike | null | undefined): readonly MarketIntentDraft[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(MARKET_INTENT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isMarketIntentDraft);
  } catch {
    return [];
  }
}

export function saveMarketIntent(storage: MarketIntentStorageLike | null | undefined, draft: MarketIntentDraft): readonly MarketIntentDraft[] {
  if (!storage) return [draft];
  const next = [draft, ...readMarketIntents(storage).filter((item) => item.id !== draft.id)].slice(0, 20);
  storage.setItem(MARKET_INTENT_STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function clearMarketIntents(storage: MarketIntentStorageLike | null | undefined): void {
  storage?.removeItem(MARKET_INTENT_STORAGE_KEY);
}

function isMarketIntentDraft(value: unknown): value is MarketIntentDraft {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<MarketIntentDraft>;
  return typeof item.id === 'string' && (item.side === 'sell' || item.side === 'buy') && typeof item.crop === 'string' && typeof item.volumeTons === 'number' && typeof item.sourcePricePerTon === 'number' && typeof item.deliveredPricePerTon === 'number' && item.status === 'requires_gate';
}
