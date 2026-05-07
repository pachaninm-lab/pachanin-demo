import { expect, test } from '@playwright/test';

const ROUTE_MAP = [
  { route: '/platform-v7', label: 'home' },
  { route: '/platform-v7/roles', label: 'roles' },
  { route: '/platform-v7/seller', label: 'seller' },
  { route: '/platform-v7/buyer', label: 'buyer' },
  { route: '/platform-v7/logistics', label: 'logistics' },
  { route: '/platform-v7/driver/field', label: 'driver-field' },
  { route: '/platform-v7/elevator', label: 'elevator' },
  { route: '/platform-v7/lab', label: 'lab' },
  { route: '/platform-v7/bank', label: 'bank' },
  { route: '/platform-v7/bank/release-safety', label: 'bank-release-safety' },
  { route: '/platform-v7/control-tower', label: 'control-tower' },
  { route: '/platform-v7/disputes', label: 'disputes' },
  { route: '/platform-v7/operator', label: 'operator' },
  { route: '/platform-v7/investor', label: 'investor' },
  { route: '/platform-v7/support', label: 'support' },
  { route: '/platform-v7/support/new', label: 'support-new' },
  { route: '/platform-v7/support/operator', label: 'support-operator' },
  { route: '/platform-v7/deals/grain-release', label: 'grain-release' },
] as const;

const CRASH_TEXT = /404|500|Application error|Unhandled Runtime Error|This page could not be found/i;
const CLAIM_TEXT = /production-ready|fully live|fully integrated|нет аналогов|без рисков|гарантирует оплату/i;

async function assertStableRoute(page: import('@playwright/test').Page, route: string) {
  const response = await page.goto(route, { waitUntil: 'networkidle' });
  expect(response?.ok(), `${route} should return a successful response`).toBeTruthy();
  await expect(page.locator('body'), `${route} should render body`).toBeVisible();
  await expect(page.locator('body'), `${route} should not render crash text`).not.toContainText(CRASH_TEXT);
  await expect(page.locator('body'), `${route} should avoid over-claiming text`).not.toContainText(CLAIM_TEXT);

  const bodyText = await page.locator('body').innerText();
  expect(bodyText.trim().length, `${route} should not render an empty screen`).toBeGreaterThan(40);

  const overflow = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    body: document.body.scrollWidth - document.body.clientWidth,
  }));
  expect(overflow.document, `${route} should not overflow document horizontally`).toBeLessThanOrEqual(4);
  expect(overflow.body, `${route} should not overflow body horizontally`).toBeLessThanOrEqual(4);
}

test.describe('platform-v7 final route map smoke gate', () => {
  for (const item of ROUTE_MAP) {
    test(`${item.label} route renders cleanly on mobile`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await assertStableRoute(page, item.route);
    });
  }

  test('all mapped routes render cleanly on desktop in one pass', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    for (const item of ROUTE_MAP) {
      await assertStableRoute(page, item.route);
    }
  });
});
