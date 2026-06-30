import { describe, expect, it } from 'vitest';
import { MARKET_PRICE_RECORDS, MARKET_ROUTE_QUOTES } from '@/lib/platform-v7/market-entry-foundation';
import { buildMarketIntentDraft } from '@/lib/platform-v7/market-entry-intent';
import { convertMarketIntentToLotDraft, convertMarketIntentToRfqDraft } from '@/lib/platform-v7/market-entry-conversion';

describe('market entry conversion adapter', () => {
  it('converts sell intent into lot draft', () => {
    const intent = buildMarketIntentDraft('sell', '220', MARKET_PRICE_RECORDS[0], MARKET_ROUTE_QUOTES[0]);
    const lot = convertMarketIntentToLotDraft(intent!);
    expect(lot?.grain).toBe('Пшеница 4 класса');
    expect(lot?.volumeTons).toBe(220);
    expect(lot?.pricePerTon).toBe(14290);
    expect(convertMarketIntentToRfqDraft(intent!)).toBeNull();
  });

  it('converts buy intent into RFQ draft', () => {
    const intent = buildMarketIntentDraft('buy', '100', MARKET_PRICE_RECORDS[0], MARKET_ROUTE_QUOTES[0]);
    const rfq = convertMarketIntentToRfqDraft(intent!);
    expect(rfq?.crop).toBe('Пшеница 4 класса');
    expect(rfq?.volumeTons).toBe(100);
    expect(rfq?.deliveredPricePerTon).toBe(21163);
    expect(convertMarketIntentToLotDraft(intent!)).toBeNull();
  });
});
