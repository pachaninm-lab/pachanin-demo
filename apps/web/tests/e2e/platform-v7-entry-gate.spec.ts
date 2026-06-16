import { expect, test } from '@playwright/test';

const publicRoutes = [
  '/platform-v7',
  '/platform-v7/open',
  '/platform-v7/login',
  '/platform-v7/register',
  '/platform-v7/role-preview',
] as const;

const cabinetRoutes = [
  '/platform-v7/seller',
  '/platform-v7/buyer',
  '/platform-v7/logistics',
  '/platform-v7/driver/field',
  '/platform-v7/elevator',
  '/platform-v7/lab',
  '/platform-v7/surveyor',
  '/platform-v7/bank/clean',
  '/platform-v7/control-tower',
  '/platform-v7/deals',
  '/platform-v7/disputes',
] as const;

test.describe('platform-v7 entry gate', () => {
  for (const route of publicRoutes) {
    test(`${route} is publicly reachable`, async ({ page }) => {
      const response = await page.goto(route, { waitUntil: 'networkidle' });
      expect(response?.ok(), `${route} should be public`).toBeTruthy();
      expect(page.url()).toContain(route);
    });
  }

  for (const route of cabinetRoutes) {
    test(`${route} redirects to public entry before entry cookie`, async ({ page }) => {
      await page.context().clearCookies();
      const response = await page.goto(route, { waitUntil: 'networkidle' });
      expect(response?.ok(), `${route} should resolve through entry`).toBeTruthy();
      expect(new URL(page.url()).pathname).toBe('/platform-v7');
    });
  }

  test('cabinet routes are reachable after visiting the public entry', async ({ page }) => {
    await page.goto('/platform-v7', { waitUntil: 'networkidle' });
    await page.goto('/platform-v7/bank/clean', { waitUntil: 'networkidle' });
    expect(new URL(page.url()).pathname).toBe('/platform-v7/bank/clean');
  });
});
