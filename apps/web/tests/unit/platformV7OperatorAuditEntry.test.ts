import {
  PLATFORM_V7_BANK_ROUTE,
  PLATFORM_V7_CONTROL_TOWER_ROUTE,
  PLATFORM_V7_MARKET_RFQ_ROUTE,
  PLATFORM_V7_OPERATOR_ROUTE,
  PLATFORM_V7_RELEASE_SAFETY_ROUTE,
} from '@/lib/platform-v7/routes';

describe('platform-v7 operator audit route contract', () => {
  it('keeps release-safety route stable', () => {
    expect(PLATFORM_V7_RELEASE_SAFETY_ROUTE).toBe('/platform-v7/bank/release-safety');
  });

  it('keeps operator-facing navigation routes stable', () => {
    expect(PLATFORM_V7_BANK_ROUTE).toBe('/platform-v7/bank');
    expect(PLATFORM_V7_OPERATOR_ROUTE).toBe('/platform-v7/operator');
    expect(PLATFORM_V7_CONTROL_TOWER_ROUTE).toBe('/platform-v7/control-tower');
    expect(PLATFORM_V7_MARKET_RFQ_ROUTE).toBe('/platform-v7/market-rfq');
    expect(PLATFORM_V7_RELEASE_SAFETY_ROUTE).toBe('/platform-v7/bank/release-safety');
  });
});
