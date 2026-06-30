import { describe, expect, it } from 'vitest';
import { MARKET_PRICE_RECORDS, MARKET_ROUTE_QUOTES } from '@/lib/platform-v7/market-entry-foundation';
import { buildMarketIntentDraft } from '@/lib/platform-v7/market-entry-intent';
import { convertMarketIntentToLotDraft, convertMarketIntentToRfqDraft } from '@/lib/platform-v7/market-entry-conversion';
import { readMarketLotHandoff, readMarketRfqHandoff, saveMarketLotHandoff, saveMarketRfqHandoff, type MarketHandoffStorageLike } from '@/lib/platform-v7/market-entry-handoff';

function memoryStorage(): MarketHandoffStorageLike {
  const values = new Map<string, string>();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
}

describe('market entry handoff storage', () => {
  it('stores sell intent as lot handoff', () => {
    const storage = memoryStorage();
    const intent = buildMarketIntentDraft('sell', '220', MARKET_PRICE_RECORDS[0], MARKET_ROUTE_QUOTES[0]);
    const lot = convertMarketIntentToLotDraft(intent!);
    saveMarketLotHandoff(storage, lot!);
    expect(readMarketLotHandoff(storage)?.volumeTons).toBe(220);
  });

  it('stores buy intent as RFQ handoff', () => {
    const storage = memoryStorage();
    const intent = buildMarketIntentDraft('buy', '100', MARKET_PRICE_RECORDS[0], MARKET_ROUTE_QUOTES[0]);
    const rfq = convertMarketIntentToRfqDraft(intent!);
    saveMarketRfqHandoff(storage, rfq!);
    expect(readMarketRfqHandoff(storage)?.deliveredPricePerTon).toBe(21163);
  });
});
