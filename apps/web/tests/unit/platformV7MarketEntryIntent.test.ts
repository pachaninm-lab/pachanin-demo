import { describe, expect, it } from 'vitest';
import { MARKET_PRICE_RECORDS, MARKET_ROUTE_QUOTES } from '@/lib/platform-v7/market-entry-foundation';
import { buildMarketIntentDraft, parseIntentVolume } from '@/lib/platform-v7/market-entry-intent';

describe('market entry intent validation', () => {
  it('parses valid volume and rejects invalid input', () => {
    expect(parseIntentVolume('220')).toBe(220);
    expect(parseIntentVolume('10,5')).toBe(10.5);
    expect(parseIntentVolume('0')).toBe(0);
    expect(parseIntentVolume('abc')).toBe(0);
  });

  it('builds draft only after valid volume', () => {
    const draft = buildMarketIntentDraft('sell', '220', MARKET_PRICE_RECORDS[0], MARKET_ROUTE_QUOTES[0]);
    expect(draft?.status).toBe('requires_gate');
    expect(draft?.deliveredPricePerTon).toBe(21163);
    expect(buildMarketIntentDraft('buy', '0', MARKET_PRICE_RECORDS[0], MARKET_ROUTE_QUOTES[0])).toBeNull();
  });
});
