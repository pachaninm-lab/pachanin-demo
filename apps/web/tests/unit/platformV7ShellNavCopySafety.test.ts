import { describe, expect, it } from 'vitest';
import { PLATFORM_V7_NAV_BY_ROLE } from '@/lib/platform-v7/shellRoutes';

const forbiddenClaims = [
  'production ready',
  'fully live',
  'live integration completed',
  'guaranteed payment',
  'no risk',
  'all integrations completed',
];

describe('platform-v7 shell nav copy safety', () => {
  it('keeps shell nav labels free of forbidden maturity claims', () => {
    for (const items of Object.values(PLATFORM_V7_NAV_BY_ROLE)) {
      for (const item of items) {
        const label = item.label.toLowerCase();

        for (const claim of forbiddenClaims) {
          expect(label).not.toContain(claim);
        }
      }
    }
  });
});
