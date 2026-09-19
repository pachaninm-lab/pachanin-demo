import { expect, test } from '@playwright/test';

const dealIdentityRoutes = [
  {
    route: '/platform-v7/deals/DL-9102/clean',
    heading: 'Карточка сделки',
    stableCopy: 'DL-9102',
  },
  {
    route: '/platform-v7/deals/DL-9106/audit',
    stableCopy: 'DL-9106',
  },
  {
    route: '/platform-v7/deals/DL-9106/money',
    stableCopy: 'DL-9106',
  },
] as const;

const fatalRenderCopy = /404|500|Application error|Unhandled Runtime Error|This page could not be found/i;
const forbiddenMaturityCopy = /production-ready|fully live|fully integrated|банк подключён|ФГИС подключён|ЭДО подключён|платформа гарантирует оплату|платформа сама выпускает деньги/i;

test.describe('platform-v7 deal identity smoke', () => {
  for (const item of dealIdentityRoutes) {
    test(`${item.route} renders stable deal identity`, async ({ page }) => {
      const response = await page.goto(item.route, { waitUntil: 'networkidle' });

      expect(response?.ok(), `${item.route} should return 2xx`).toBeTruthy();
      await expect(page.locator('body'), `${item.route} should render body content`).toBeVisible();
      await expect(page.locator('body'), `${item.route} should not show fatal route copy`).not.toContainText(fatalRenderCopy);
      await expect(page.locator('body'), `${item.route} should not show fake maturity copy`).not.toContainText(forbiddenMaturityCopy);
      await expect(page.getByText(item.stableCopy, { exact: false }), `${item.route} should expose stable deal identity`).toBeVisible();

      if ('heading' in item) {
        await expect(page.getByRole('heading', { name: item.heading })).toBeVisible();
      }
    });
  }
});
