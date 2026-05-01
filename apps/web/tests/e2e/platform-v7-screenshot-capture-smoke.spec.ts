import { expect, test } from '@playwright/test';

const cases = [
  { name: 'lots-mobile-light', route: '/platform-v7/lots', width: 390, height: 844, colorScheme: 'light' as const },
  { name: 'buyer-mobile-light', route: '/platform-v7/buyer', width: 390, height: 844, colorScheme: 'light' as const },
  { name: 'driver-mobile-light', route: '/platform-v7/driver', width: 390, height: 844, colorScheme: 'light' as const },
  { name: 'bank-mobile-light', route: '/platform-v7/bank/release-safety', width: 390, height: 844, colorScheme: 'light' as const },
  { name: 'deal-desktop-light', route: '/platform-v7/deals/DL-9116', width: 1366, height: 900, colorScheme: 'light' as const },
  { name: 'bids-desktop-light', route: '/platform-v7/lots/LOT-2403/bids', width: 1366, height: 900, colorScheme: 'light' as const },
  { name: 'lots-mobile-dark', route: '/platform-v7/lots', width: 390, height: 844, colorScheme: 'dark' as const },
  { name: 'bank-mobile-dark', route: '/platform-v7/bank/release-safety', width: 390, height: 844, colorScheme: 'dark' as const },
] as const;

test.describe('platform-v7 screenshot capture smoke gates', () => {
  for (const item of cases) {
    test(`${item.name} captures a rendered screenshot`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: item.colorScheme });
      await page.setViewportSize({ width: item.width, height: item.height });

      const response = await page.goto(item.route, { waitUntil: 'networkidle' });
      expect(response?.ok(), `${item.route} should return ok response`).toBeTruthy();
      await expect(page.locator('body')).toBeVisible();

      const textLength = await page.locator('body').innerText().then((text) => text.trim().length);
      expect(textLength, `${item.route} should render meaningful text`).toBeGreaterThan(80);

      const screenshot = await page.screenshot({ fullPage: true });
      expect(screenshot.byteLength, `${item.name} screenshot should not be empty`).toBeGreaterThan(10_000);
    });
  }
});
