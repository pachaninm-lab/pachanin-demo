import { describe, expect, it } from 'vitest';
import { MARKET_PRICE_RECORDS, MARKET_ROUTE_QUOTES } from '@/lib/platform-v7/market-entry-foundation';
import { buildMarketIntentDraft } from '@/lib/platform-v7/market-entry-intent';
import { clearMarketIntents, readMarketIntents, saveMarketIntent, type MarketIntentStorageLike } from '@/lib/platform-v7/market-entry-store';

function memoryStorage(): MarketIntentStorageLike {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

describe('market entry intent storage', () => {
  it('saves, reads and clears validated intents', () => {
    const storage = memoryStorage();
    const draft = buildMarketIntentDraft('sell', '220', MARKET_PRICE_RECORDS[0], MARKET_ROUTE_QUOTES[0]);
    expect(draft).not.toBeNull();

    const saved = saveMarketIntent(storage, draft!);
    expect(saved).toHaveLength(1);
    expect(readMarketIntents(storage)).toHaveLength(1);

    clearMarketIntents(storage);
    expect(readMarketIntents(storage)).toHaveLength(0);
  });

  it('ignores corrupted storage payloads', () => {
    const storage = memoryStorage();
    storage.setItem('platform-v7.market-entry.intents.v1', 'not-json');
    expect(readMarketIntents(storage)).toEqual([]);
  });

  it('returns the current draft when browser storage write fails', () => {
    const draft = buildMarketIntentDraft('buy', '100', MARKET_PRICE_RECORDS[0], MARKET_ROUTE_QUOTES[0]);
    const broken: MarketIntentStorageLike = { getItem: () => null, setItem: () => { throw new Error('blocked'); }, removeItem: () => { throw new Error('blocked'); } };
    expect(saveMarketIntent(broken, draft!)).toHaveLength(1);
    expect(() => clearMarketIntents(broken)).not.toThrow();
  });
});
