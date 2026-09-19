import { describe, expect, it } from 'vitest';
import { platformV7QuickJumpItems } from '@/lib/platform-v7/shellQuickJump';
import { PLATFORM_V7_DEALS_ROUTE, PLATFORM_V7_DISPUTES_ROUTE } from '@/lib/platform-v7/routes';

describe('platform-v7 quick jump deep link scope', () => {
  it('keeps deal deep links inside the platform v7 deals route', () => {
    const dealLinks = platformV7QuickJumpItems().filter((item) => item.group === 'Сделки');

    expect(dealLinks.length).toBeGreaterThan(0);
    for (const item of dealLinks) {
      expect(item.href.startsWith(`${PLATFORM_V7_DEALS_ROUTE}/`)).toBe(true);
      expect(item.href.includes('/platform-v4')).toBe(false);
      expect(item.href.includes('/platform-v9')).toBe(false);
    }
  });

  it('keeps dispute deep links inside the platform v7 disputes route', () => {
    const disputeLinks = platformV7QuickJumpItems().filter((item) => item.group === 'Споры');

    expect(disputeLinks.length).toBeGreaterThan(0);
    for (const item of disputeLinks) {
      expect(item.href.startsWith(`${PLATFORM_V7_DISPUTES_ROUTE}/`)).toBe(true);
      expect(item.href.includes('/platform-v4')).toBe(false);
      expect(item.href.includes('/platform-v9')).toBe(false);
    }
  });
});
