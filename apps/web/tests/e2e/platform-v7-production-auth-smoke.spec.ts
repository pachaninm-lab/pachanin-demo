import { expect, test, type Page } from '@playwright/test';

const publicRoutes = [
  { path: '/platform-v7', text: 'Прозрачная Цена' },
  { path: '/platform-v7/how-it-works', text: 'Прозрачная Цена' },
  { path: '/platform-v7/login', text: 'Войти' },
] as const;

const protectedRoutes = [
  // All 13 canonical cabinet roots, including the organization employee.
  '/platform-v7/operator',
  '/platform-v7/buyer',
  '/platform-v7/seller',
  '/platform-v7/logistics',
  '/platform-v7/driver/field',
  '/platform-v7/surveyor',
  '/platform-v7/elevator',
  '/platform-v7/lab',
  '/platform-v7/bank',
  '/platform-v7/profile',
  '/platform-v7/arbitrator',
  '/platform-v7/compliance',
  '/platform-v7/executive',
  // Keep the existing critical workspace checks alongside cabinet roots.
  '/platform-v7/control-tower',
  '/platform-v7/deals',
  '/platform-v7/bank/release-safety',
] as const;

async function assertNoHorizontalOverflow(page: Page, label: string) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, `${label} should not overflow horizontally`).toBeLessThanOrEqual(8);
}

async function assertNoBrokenVisibleImages(page: Page, label: string) {
  for (const image of await page.locator('img:visible').all()) {
    // CSS-visible lazy images may still be offscreen after DOMContentLoaded.
    // Bring each one into view and require its actual decoded dimensions.
    await image.scrollIntoViewIfNeeded();
    await expect
      .poll(
        () => image.evaluate((element) =>
          element instanceof HTMLImageElement
          && element.complete
          && element.naturalWidth > 0
          && element.naturalHeight > 0),
        { message: `${label} should load ${await image.getAttribute('src')}`, timeout: 15_000 },
      )
      .toBe(true);
  }
}

test.describe('platform-v7 production public and authentication boundary', () => {
  for (const route of publicRoutes) {
    test(`${route.path} is publicly reachable`, async ({ page }) => {
      const response = await page.goto(route.path, { waitUntil: 'domcontentloaded' });
      expect(response?.ok(), `${route.path} should return a successful response`).toBeTruthy();
      await expect(page.locator('body')).toContainText(route.text, { timeout: 15_000 });
      await expect(page.locator('body')).not.toContainText('Ошибка страницы');
      await expect(page.locator('header').first()).toBeVisible();
      await assertNoHorizontalOverflow(page, route.path);
      await assertNoBrokenVisibleImages(page, route.path);
    });
  }

  for (const protectedPath of protectedRoutes) {
    test(`${protectedPath} rejects client-only role claims`, async ({ page, baseURL }) => {
      if (!baseURL) throw new Error('PLAYWRIGHT_BASE_URL is required for production auth smoke');

      // Seed forged client claims before the first request. The server must still
      // require a verified session and preserve the requested route for login.
      await page.context().addCookies([
        {
          name: 'pc-role',
          value: 'operator',
          url: baseURL,
          sameSite: 'Lax',
        },
      ]);
      await page.addInitScript(() => {
        window.sessionStorage.setItem('pc-v7-active-role', 'operator');
      });

      await page.goto(protectedPath, { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(/\/platform-v7\/login(?:\?|$)/, { timeout: 15_000 });

      const finalUrl = new URL(page.url());
      expect(finalUrl.pathname).toBe('/platform-v7/login');
      expect(finalUrl.searchParams.get('next')).toBe(protectedPath);
      await expect(page.getByRole('heading', { level: 1, name: 'Вход в платформу', exact: true })).toBeVisible();
      await expect(page.getByRole('textbox', { name: 'Адрес электронной почты', exact: true })).toBeVisible();
      await expect(page.locator('#pc-auth-password')).toBeVisible();
      await expect(page.locator('#pc-auth-password')).toHaveAttribute('type', 'password');
      await expect(page.getByRole('button', { name: 'Войти', exact: true })).toBeVisible();
      await expect(page.locator('body')).not.toContainText('Ошибка страницы');
      await assertNoHorizontalOverflow(page, `${protectedPath} authentication redirect`);
    });
  }
});
