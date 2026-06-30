import { describe, expect, it } from 'vitest';
import { deliveredMarketPrice, marketGate, marketLogisticsCost, marketLogisticsCostPerTon, marketReadinessScore, MARKET_PRICE_RECORDS, MARKET_ROUTE_QUOTES } from '@/lib/platform-v7/market-entry-data';

describe('market entry data model', () => {
  it('calculates logistics cost and delivered price', () => {
    const price = MARKET_PRICE_RECORDS[0];
    const route = MARKET_ROUTE_QUOTES[0];

    expect(marketLogisticsCost(route)).toBe(151200);
    expect(marketLogisticsCostPerTon(route)).toBe(6873);
    expect(deliveredMarketPrice(price, route)).toBe(21163);
  });

  it('keeps launch gate before execution', () => {
    const gate = marketGate(MARKET_PRICE_RECORDS[0], MARKET_ROUTE_QUOTES[0]);

    expect(gate.map((item) => item.id)).toEqual(['price', 'party', 'logistics', 'counterparty', 'documents', 'money']);
    expect(marketReadinessScore(gate)).toBeGreaterThan(40);
    expect(marketReadinessScore(gate)).toBeLessThan(80);
  });
});
