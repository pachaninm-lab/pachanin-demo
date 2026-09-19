import { expect, test, type Page } from '@playwright/test';

const publicRoutes = [
  { path: '/platform-v7', text: 'Прозрачная Цена' },
  { path: '/platform-v7/how-it-works', text: 'Прозрачная Цена' },
  { path: '/platform-v7/login', text: 'Войти' },
] as const;

const protectedRoutes = [
  '/platform-v7/control-tower',
  '/platform-v7/driver/field',
  '/platform-v7/elevator',
  '/platform-v7/lab',
  '/platform-v7/surveyor',
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
  const brokenImages = await page.locator('img:visible').evaluateAll((images) =>
    images
      .filter((image) => image instanceof HTMLImageElement)
      .filter((image) => !image.complete || image.naturalWidth === 0 || image.naturalHeight === 0)
      .map((image) => ({ src: image.getAttribute('src'), alt: image.getAttribute('alt') })),
  );

  expect(brokenImages, `${label} should not have broken visible images`).toEqual([]);
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
      await expect(page.getByRole('heading', { name: 'Войти' })).toBeVisible();
      await expect(page.locator('body')).not.toContainText('Ошибка страницы');
      await assertNoHorizontalOverflow(page, `${protectedPath} authentication redirect`);
    });
  }
});
