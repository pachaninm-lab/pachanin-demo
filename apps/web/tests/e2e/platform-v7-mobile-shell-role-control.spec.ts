import { expect, test } from '@playwright/test';

const SHELL_ROLE_ROUTES = ['/platform-v7/control-tower', '/platform-v7/executive'] as const;

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

test.describe('platform-v7 mobile shell role control', () => {
  for (const route of SHELL_ROLE_ROUTES) {
    test(`${route} keeps one shell role control on mobile`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      const response = await page.goto(route, { waitUntil: 'networkidle' });
      expect(response?.ok(), `${route} should return 2xx`).toBeTruthy();

      await expect(page.locator('.pc-v4-header')).toHaveCount(1);
      await expect(page.locator('.pc-v4-brand')).toBeVisible();
      await expect(page.locator('.pc-v4-select')).toBeVisible();
      await expect(page.locator('[data-role-header-switcher="true"]')).toHaveCount(0);
      await expect(page.locator('[data-role-header-label="true"]')).toHaveCount(0);

      const visibleIconCount = await page.locator('.pc-v4-actions .pc-v4-iconbtn:visible').count();
      expect(visibleIconCount).toBeLessThanOrEqual(3);
      await assertNoHorizontalOverflow(page, route);
      await assertGlobalForbiddenClaims(page, route);
    });
  }
});
