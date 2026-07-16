import { expect, test } from '@playwright/test';

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
  '/platform-v7/deals/DL-9102/clean',
  '/platform-v7/bank/release-safety',
] as const;

async function assertNoHorizontalOverflow(page: any, label: string) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, `${label} should not overflow horizontally`).toBeLessThanOrEqual(8);
}

async function assertNoBrokenVisibleImages(page: any, label: string) {
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
    test(`${protectedPath} rejects client-only role claims`, async ({ page }) => {
      await page.addInitScript(() => {
        window.sessionStorage.setItem('pc-v7-active-role', 'operator');
        document.cookie = 'pc-role=operator; Path=/; SameSite=Lax';
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
