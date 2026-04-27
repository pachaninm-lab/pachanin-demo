import { describe, expect, it } from 'vitest';
import { PLATFORM_V7_MARKET_RFQ_ROUTE } from '@/lib/platform-v7/market-rfq-route';
import { PLATFORM_V7_COMMAND_SECTION_ITEMS } from '@/lib/platform-v7/command';

describe('platform-v7 market-rfq route contract', () => {
  it('route string is stable', () => {
    expect(PLATFORM_V7_MARKET_RFQ_ROUTE).toBe('/platform-v7/market-rfq');
  });

  it('command entry points to market-rfq route', () => {
    const item = PLATFORM_V7_COMMAND_SECTION_ITEMS.find((i) => i.id === 'sec-market-rfq');
    expect(item).toBeDefined();
    expect(item?.href).toBe(PLATFORM_V7_MARKET_RFQ_ROUTE);
  });
});
