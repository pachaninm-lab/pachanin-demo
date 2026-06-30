import { describe, expect, it } from 'vitest';
import { deliveredMarketPrice, marketGate, marketLogisticsCostPerTon, marketReadinessScore, MARKET_PRICE_RECORDS, MARKET_ROUTE_QUOTES } from '@/lib/platform-v7/market-entry-foundation';

describe('market entry', () => {
  it('calculates delivered price', () => {
    expect(marketLogisticsCostPerTon(MARKET_ROUTE_QUOTES[0])).toBe(6873);
    expect(deliveredMarketPrice(MARKET_PRICE_RECORDS[0], MARKET_ROUTE_QUOTES[0])).toBe(21163);
  });

  it('keeps launch checks before execution', () => {
    const gate = marketGate(MARKET_PRICE_RECORDS[0], MARKET_ROUTE_QUOTES[0]);
    expect(gate.map((item) => item.id)).toEqual(['price', 'party', 'logistics', 'counterparty', 'documents', 'money']);
    expect(marketReadinessScore(gate)).toBeGreaterThan(40);
    expect(marketReadinessScore(gate)).toBeLessThan(80);
  });
});
