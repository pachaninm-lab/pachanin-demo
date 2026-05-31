import { expect, test } from '@playwright/test';

const routeSmokeCases = [
  {
    route: '/platform-v7/bank',
    visibleCopy: 'Деньги выпускаются только после доказанных условий',
  },
  {
    route: '/platform-v7/documents',
    visibleCopy: 'Неполный пакет документов должен сразу останавливать деньги',
  },
] as const;

const fatalRenderCopy = /404|500|Application error|Unhandled Runtime Error|This page could not be found/i;
const inflatedClaimCopy = /production-ready|fully live|fully integrated|платформа гарантирует оплату|платформа сама выпускает деньги|банк подключён|ФГИС подключён|ЭДО подключён/i;

test.describe('platform-v7 route smoke qa', () => {
  for (const item of routeSmokeCases) {
    test(`${item.route} renders stable route control copy`, async ({ page }) => {
      const response = await page.goto(item.route, { waitUntil: 'networkidle' });

      expect(response?.ok(), `${item.route} should return 2xx`).toBeTruthy();
      await expect(page.locator('body'), `${item.route} should render visible content`).toBeVisible();
      await expect(page.locator('body'), `${item.route} should not show fatal route copy`).not.toContainText(fatalRenderCopy);
      await expect(page.locator('body'), `${item.route} should not show inflated maturity or guarantee copy`).not.toContainText(inflatedClaimCopy);
      await expect(page.getByText(item.visibleCopy, { exact: false }), `${item.route} should expose route control copy`).toBeVisible();
    });
  }
});
