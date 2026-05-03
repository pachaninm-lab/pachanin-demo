import { expect, test } from '@playwright/test';

const routes = [
  { path: '/platform-v7', text: 'Прозрачная Цена' },
  { path: '/platform-v7/control-tower', text: 'Центр управления' },
  { path: '/platform-v7/driver', text: 'Полевой экран водителя' },
  { path: '/platform-v7/elevator', text: 'Приёмка как доказательство сделки' },
  { path: '/platform-v7/lab', text: 'Лаборатория как доказательство качества' },
  { path: '/platform-v7/surveyor', text: 'Независимая фиксация на площадке' },
  { path: '/platform-v7/deals/DL-9102/clean', text: 'Карточка сделки · пилотный контур' },
  { path: '/platform-v7/bank/release-safety', text: 'Проверка безопасности выпуска денег' },
] as const;

const staleMobileCopy = [
  ['Controlled', 'pilot'].join(' '),
  ['Control', 'Tower'].join(' '),
  ['call', 'backs'].join(''),
  ['evidence', 'first'].join('-'),
  ['sandbox', 'dispatch'].join(' '),
  ['Action', 'handoff'].join(' '),
  ['domain', 'core'].join('-'),
  ['run', 'time'].join(''),
  ['leg', 'acy'].join(''),
  ['mo', 'ck'].join(''),
  ['de', 'bug'].join(''),
] as const;

test.describe('platform-v7 mobile smoke', () => {
  test.use({ viewport: { width: 375, height: 812 }, isMobile: true });

  for (const route of routes) {
    test(`${route.path} renders at 375px without horizontal overflow`, async ({ page }) => {
      const response = await page.goto(route.path, { waitUntil: 'domcontentloaded' });
      expect(response?.ok(), `${route.path} should return ok response`).toBeTruthy();

      await expect(page.locator('body')).toContainText(route.text, { timeout: 15000 });

      for (const copy of staleMobileCopy) {
        await expect(page.getByText(copy, { exact: false }), `${route.path} should not show stale mobile copy`).toHaveCount(0);
      }

      const pageShape = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        headings: document.querySelectorAll('h1, h2').length,
        controls: document.querySelectorAll('a, button').length,
      }));

      expect(pageShape.overflow, `${route.path} should not overflow horizontally`).toBeLessThanOrEqual(8);
      expect(pageShape.headings, `${route.path} should keep a usable mobile hierarchy`).toBeGreaterThan(0);
      expect(pageShape.controls, `${route.path} should keep reachable mobile controls`).toBeGreaterThan(0);
    });
  }
});
