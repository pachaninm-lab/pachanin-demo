import { expect, test } from '@playwright/test';

const routes = [
  { path: '/platform-v7/driver', text: 'Полевой экран водителя' },
  { path: '/platform-v7/elevator', text: 'Приёмка как доказательство сделки' },
  { path: '/platform-v7/lab', text: 'Лаборатория как доказательство качества' },
  { path: '/platform-v7/surveyor', text: 'Независимая фиксация на площадке' },
  { path: '/platform-v7/deals/DL-9102/clean', text: 'Карточка сделки · пилотный контур' },
  { path: '/platform-v7/bank/release-safety', text: 'Проверка безопасности выпуска денег' },
] as const;

test.describe('platform-v7 mobile smoke', () => {
  test.use({ viewport: { width: 375, height: 812 }, isMobile: true });

  for (const route of routes) {
    test(`${route.path} renders at 375px without horizontal overflow`, async ({ page }) => {
      const response = await page.goto(route.path, { waitUntil: 'domcontentloaded' });
      expect(response?.ok(), `${route.path} should return ok response`).toBeTruthy();

      await expect(page.locator('body')).toContainText(route.text, { timeout: 15000 });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

      expect(overflow, `${route.path} should not overflow horizontally`).toBeLessThanOrEqual(8);
    });
  }
});
