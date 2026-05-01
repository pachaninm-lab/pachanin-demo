import { expect, test } from '@playwright/test';

const stableCases = [
  { name: 'driver-390-light', route: '/platform-v7/driver', width: 390, height: 844, colorScheme: 'light' as const },
  { name: 'trip-390-light', route: '/platform-v7/logistics/trips/TR-2041', width: 390, height: 844, colorScheme: 'light' as const },
  { name: 'bank-390-dark', route: '/platform-v7/bank/release-safety', width: 390, height: 844, colorScheme: 'dark' as const },
  { name: 'bids-768-light', route: '/platform-v7/lots/LOT-2403/bids', width: 768, height: 1024, colorScheme: 'light' as const },
] as const;

test.describe('platform-v7 pixel baseline smoke', () => {
  for (const item of stableCases) {
    test(`${item.name} has a stable visual baseline`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: item.colorScheme, reducedMotion: 'reduce' });
      await page.setViewportSize({ width: item.width, height: item.height });

      const response = await page.goto(item.route, { waitUntil: 'networkidle' });
      expect(response?.ok(), `${item.route} should render`).toBeTruthy();
      await expect(page.locator('body')).toBeVisible();

      await page.addStyleTag({
        content: `
          *, *::before, *::after {
            animation-duration: 0s !important;
            animation-delay: 0s !important;
            transition-duration: 0s !important;
            transition-delay: 0s !important;
            caret-color: transparent !important;
          }
        `,
      });

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${item.name} should not overflow horizontally`).toBeLessThanOrEqual(1);

      await expect(page).toHaveScreenshot(`${item.name}.png`, {
        fullPage: true,
        maxDiffPixelRatio: 0.035,
        animations: 'disabled',
      });
    });
  }
});
