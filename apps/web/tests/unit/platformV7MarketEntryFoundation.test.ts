import { describe, expect, it } from 'vitest';
import { deliveredMarketPrice, marketLogisticsCostPerTon, MARKET_PRICE_RECORDS, MARKET_ROUTE_QUOTES } from '@/lib/platform-v7/market-entry-foundation';

describe('market entry', () => {
  it('calculates delivered price', () => {
    expect(marketLogisticsCostPerTon(MARKET_ROUTE_QUOTES[0])).toBe(6873);
    expect(deliveredMarketPrice(MARKET_PRICE_RECORDS[0], MARKET_ROUTE_QUOTES[0])).toBe(21163);
  });
});
