import { expect, test } from '@playwright/test';

const CONTROL_HEADER_ROUTES = ['/platform-v7/bank', '/platform-v7/arbitrator', '/platform-v7/compliance'] as const;
const EXPECTED_CONTROL_LABELS = ['Банк', 'Арбитр', 'Комплаенс'] as const;
const FORBIDDEN_CONTROL_LABELS = [
  'Продавец',
  'Покупатель',
  'Логистика',
  'Водитель',
  'Сюрвейер',
  'Элеватор',
  'Лаборатория',
  'Оператор',
  'Руководитель',
] as const;

const GLOBAL_FORBIDDEN_CLAIMS = [
  'production-ready',
  'fully live',
  'fully integrated',
  'нет аналогов',
  'без рисков',
  'гарантирует оплату',
] as const;

async function assertNoHorizontalOverflow(page: import('@playwright/test').Page, route: string) {
  const overflow = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    body: document.body.scrollWidth - document.body.clientWidth,
  }));
  expect(overflow.document, `${route} should not overflow document horizontally`).toBeLessThanOrEqual(4);
  expect(overflow.body, `${route} should not overflow body horizontally`).toBeLessThanOrEqual(4);
}

async function assertGlobalForbiddenClaims(page: import('@playwright/test').Page, route: string) {
  const text = (await page.locator('body').innerText()).toLowerCase();
  for (const copy of GLOBAL_FORBIDDEN_CLAIMS) {
    expect(text, `${route} should not expose over-claiming copy: ${copy}`).not.toContain(copy.toLowerCase());
  }
}

test.describe('platform-v7 control mobile header role boundaries', () => {
  for (const route of CONTROL_HEADER_ROUTES) {
    test(`${route} exposes only control roles in mobile header selector`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      const response = await page.goto(route, { waitUntil: 'networkidle' });
      expect(response?.ok(), `${route} should return 2xx`).toBeTruthy();

      await expect(page.locator('.pc-v4-header')).toHaveCount(1);
      await expect(page.locator('.pc-v4-brand')).toBeVisible();
      await expect(page.locator('[data-role-header-label="true"]')).toHaveCount(0);
      await expect(page.locator('.pc-v4-drawer')).toBeHidden();
      await expect(page.locator('.pc-v4-top > button.pc-v4-iconbtn').first()).toBeHidden();

      const switcher = page.locator('[data-role-header-switcher="true"]');
      await expect(switcher, `${route} should expose exactly one portal role selector`).toHaveCount(1);
      await expect(switcher).toBeVisible();

      const labels = (await switcher.locator('option').allTextContents()).map((item) => item.trim());
      expect(labels).toEqual([...EXPECTED_CONTROL_LABELS]);
      for (const forbiddenLabel of FORBIDDEN_CONTROL_LABELS) {
        expect(labels, `${route} should not expose ${forbiddenLabel} in role selector`).not.toContain(forbiddenLabel);
      }

      await assertNoHorizontalOverflow(page, route);
      await assertGlobalForbiddenClaims(page, route);
    });
  }
});
