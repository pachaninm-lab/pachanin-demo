import { expect, test } from '@playwright/test';

const FIELD_HEADER_ROUTES = [
  { route: '/platform-v7/driver/field', label: 'Водитель' },
  { route: '/platform-v7/elevator', label: 'Элеватор' },
  { route: '/platform-v7/lab', label: 'Лаборатория' },
  { route: '/platform-v7/surveyor', label: 'Сюрвейер' },
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

test.describe('platform-v7 field mobile header labels', () => {
  for (const config of FIELD_HEADER_ROUTES) {
    test(`${config.route} keeps field mobile header read-only`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      const response = await page.goto(config.route, { waitUntil: 'networkidle' });
      expect(response?.ok(), `${config.route} should return 2xx`).toBeTruthy();

      await expect(page.locator('.pc-v4-header')).toHaveCount(1);
      await expect(page.locator('.pc-v4-brand')).toBeVisible();
      await expect(page.locator('[data-role-header-label="true"]')).toContainText(config.label);
      await expect(page.locator('[data-role-header-switcher="true"]')).toHaveCount(0);
      await expect(page.locator('.pc-v4-drawer')).toBeHidden();
      await expect(page.locator('.pc-v4-top > button.pc-v4-iconbtn').first()).toBeHidden();

      const visibleIconCount = await page.locator('.pc-v4-actions .pc-v4-iconbtn:visible').count();
      expect(visibleIconCount).toBeLessThanOrEqual(3);
      await assertNoHorizontalOverflow(page, config.route);
      await assertGlobalForbiddenClaims(page, config.route);
    });
  }
});
