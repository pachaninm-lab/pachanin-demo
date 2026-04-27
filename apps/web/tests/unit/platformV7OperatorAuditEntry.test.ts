import { describe, expect, it } from 'vitest';
import { PLATFORM_V7_ROUTES } from '@/lib/platform-v7/routes';

describe('platform-v7 operator audit entry contract', () => {
  it('releaseSafety route is stable', () => {
    expect(PLATFORM_V7_ROUTES.releaseSafety).toBe('/platform-v7/bank/release-safety');
  });

  it('all five operator-facing nav routes are stable', () => {
    expect(PLATFORM_V7_ROUTES.bank).toBe('/platform-v7/bank');
    expect(PLATFORM_V7_ROUTES.operator).toBe('/platform-v7/operator');
    expect(PLATFORM_V7_ROUTES.controlTower).toBe('/platform-v7/control-tower');
    expect(PLATFORM_V7_ROUTES.marketRfq).toBe('/platform-v7/market-rfq');
    expect(PLATFORM_V7_ROUTES.releaseSafety).toBe('/platform-v7/bank/release-safety');
  });
});
