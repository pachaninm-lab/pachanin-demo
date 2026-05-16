import { expect, test } from '@playwright/test';

const ROUTES = [
  '/platform-v7/status',
  '/platform-v7/investor',
  '/platform-v7/bank/release-safety',
  '/platform-v7/deals/grain-release',
  '/platform-v7/disputes',
  '/platform-v7/support/operator',
] as const;

const BLOCKED_COPY = /production-ready|fully live|fully integrated|нет аналогов|без рисков|гарантирует оплату/i;
const CRASH_COPY = /404|500|Application error|Unhandled Runtime Error|This page could not be found/i;

async function bodyText(page: import('@playwright/test').Page) {
  return page.locator('body').innerText();
}

async function assertRouteClean(page: import('@playwright/test').Page, route: string) {
  const response = await page.goto(route, { waitUntil: 'networkidle' });
  expect(response?.ok(), `${route} should return successful response`).toBeTruthy();
  await expect(page.locator('body')).not.toContainText(CRASH_COPY);
  await expect(page.locator('body')).not.toContainText(BLOCKED_COPY);

  const text = await bodyText(page);
  expect(text.trim().length, `${route} should render useful content`).toBeGreaterThan(80);
}

test.describe('platform-v7 final execution positioning check', () => {
  for (const route of ROUTES) {
    test(`${route} renders without crash or overclaim`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await assertRouteClean(page, route);
    });
  }

  test('status and investor routes keep honest external-boundary wording', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    await assertRouteClean(page, '/platform-v7/status');
    await expect(page.locator('body')).toContainText(/Рабочий контур|ручн|внешн/i);

    await assertRouteClean(page, '/platform-v7/investor');
    await expect(page.locator('body')).toContainText(/проверочн|сценарн|внешн/i);
  });

  test('bank route keeps release as check flow rather than direct payment action', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await assertRouteClean(page, '/platform-v7/bank/release-safety');

    const text = await bodyText(page);
    expect(text).toContain('Банковская проверка выплаты');
    expect(text).toContain('Закрыть условия');
    expect(text).toContain('Запрос к банку');
    expect(text).not.toMatch(/выпустить сейчас|прямой выпуск/i);
  });

  test('dispute and support routes keep evidence and operator control visible', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    await assertRouteClean(page, '/platform-v7/disputes');
    await expect(page.locator('body')).toContainText(/доказательств|доказательного пакета|спор/i);

    await assertRouteClean(page, '/platform-v7/support/operator');
    await expect(page.locator('body')).toContainText(/срок|оператор|обращ/i);
  });
});
