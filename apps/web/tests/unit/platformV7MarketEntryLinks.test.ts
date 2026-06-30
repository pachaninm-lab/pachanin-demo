import { describe, expect, it } from 'vitest';
import { MARKET_ENTRY_LINKS } from '@/lib/platform-v7/market-entry-links';

describe('market entry links', () => {
  it('points to existing pre-deal and execution surfaces', () => {
    expect(MARKET_ENTRY_LINKS.marketRfq).toBe('/platform-v7/market-rfq');
    expect(MARKET_ENTRY_LINKS.lotsCreate).toBe('/platform-v7/lots/create');
    expect(MARKET_ENTRY_LINKS.buyerRfqNew).toBe('/platform-v7/buyer/rfq/new');
    expect(MARKET_ENTRY_LINKS.bank).toBe('/platform-v7/bank');
  });
});
