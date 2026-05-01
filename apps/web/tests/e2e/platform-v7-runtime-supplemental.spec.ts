import { expect, test } from '@playwright/test';

const routes = [
  '/platform-v7/lots/LOT-2403/bids',
  '/platform-v7/deals/DL-9116',
  '/platform-v7/bank/release-safety',
];

test.describe('platform-v7 supplemental runtime gates', () => {
  for (const route of routes) {
    test(`${route} renders cleanly with keyboard entry`, async ({ page }) => {
      const consoleErrors: string[] = [];
      const pageErrors: string[] = [];

      page.on('console', (message) => {
        if (message.type() === 'error') consoleErrors.push(message.text());
      });
      page.on('pageerror', (error) => pageErrors.push(error.message));

      await page.setViewportSize({ width: 390, height: 844 });
      const response = await page.goto(route, { waitUntil: 'networkidle' });
      expect(response?.ok(), `${route} should return ok response`).toBeTruthy();
      await expect(page.locator('body')).toBeVisible();

      await page.keyboard.press('Tab');
      const active = await page.evaluate(() => {
        const element = document.activeElement as HTMLElement | null;
        if (!element || element === document.body || element === document.documentElement) return null;
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName,
          text: (element.textContent ?? '').trim().slice(0, 80),
          width: rect.width,
          height: rect.height,
        };
      });

      expect(active, `${route} should expose first keyboard focus target`).not.toBeNull();
      if (active) {
        expect(active.width, `${route} focused target width`).toBeGreaterThanOrEqual(1);
        expect(active.height, `${route} focused target height`).toBeGreaterThanOrEqual(1);
      }

      expect(consoleErrors, `${route} should not emit console errors`).toEqual([]);
      expect(pageErrors, `${route} should not emit page runtime errors`).toEqual([]);
    });
  }
});
