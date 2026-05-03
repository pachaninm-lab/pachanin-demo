import { expect, test } from '@playwright/test';

const routes = [
  { path: '/platform-v7', text: /Прозрачная Цена/i },
  { path: '/platform-v7/control-tower', text: /Центр управления/i },
  { path: '/platform-v7/driver', text: /Полевой экран водителя/i },
  { path: '/platform-v7/deals/DL-9102/clean', text: /Карточка сделки · пилотный контур/i },
  { path: '/platform-v7/bank/release-safety', text: /Проверка безопасности выпуска денег/i },
] as const;

const forbiddenVisibleCopy = [
  'Controlled pilot',
  'Control Tower',
  'callbacks',
  'evidence-first',
  'sandbox dispatch',
  'Action handoff',
  'domain-core',
  'runtime',
  'legacy',
  'mock',
  'debug',
];

test.describe('platform-v7 visual smoke', () => {
  test.use({ viewport: { width: 1440, height: 1000 } });

  for (const route of routes) {
    test(`${route.path} renders clean desktop shell`, async ({ page }) => {
      const response = await page.goto(route.path, { waitUntil: 'domcontentloaded' });
      expect(response?.ok(), `${route.path} should return ok response`).toBeTruthy();

      await expect(page.locator('body')).toContainText(route.text, { timeout: 15000 });
      await expect(page.locator('header').first()).toBeVisible();

      for (const copy of forbiddenVisibleCopy) {
        await expect(page.getByText(copy, { exact: false }), `${route.path} should not show ${copy}`).toHaveCount(0);
      }

      const layout = await page.evaluate(() => {
        const root = document.documentElement;
        return {
          horizontalOverflow: root.scrollWidth - root.clientWidth,
          headings: document.querySelectorAll('h1, h2').length,
          controls: document.querySelectorAll('a, button').length,
        };
      });

      expect(layout.horizontalOverflow, `${route.path} should not overflow horizontally`).toBeLessThanOrEqual(4);
      expect(layout.headings, `${route.path} should expose a clear visual hierarchy`).toBeGreaterThan(0);
      expect(layout.controls, `${route.path} should expose usable controls`).toBeGreaterThan(0);

      const brokenImages = await page.locator('img:visible').evaluateAll((images) =>
        images
          .filter((img) => img instanceof HTMLImageElement)
          .filter((img) => !img.complete || img.naturalWidth === 0 || img.naturalHeight === 0)
          .map((img) => ({ src: img.getAttribute('src'), alt: img.getAttribute('alt') }))
      );

      expect(brokenImages, `${route.path} should not have broken visible images`).toEqual([]);
    });
  }
});
