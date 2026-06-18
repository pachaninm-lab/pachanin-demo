import { expect, test } from '@playwright/test';

const redirectCases = [
  { role: 'driver', from: '/platform-v7/bank', to: /\/platform-v7\/driver\/field/ },
  { role: 'seller', from: '/platform-v7/buyer', to: /\/platform-v7\/seller/ },
  { role: 'bank', from: '/platform-v7/driver/field', to: /\/platform-v7\/bank\/clean/ },
  { role: 'lab', from: '/platform-v7/disputes', to: /\/platform-v7\/lab/ },
  { role: 'buyer', from: '/platform-v7/roles', to: /\/platform-v7\/buyer/ },
] as const;

const allowedCases = [
  { role: 'operator', path: '/platform-v7/deals', expected: /\/platform-v7\/deals/ },
  { role: 'executive', path: '/platform-v7/bank', expected: /\/platform-v7\/bank/ },
  { role: 'bank', path: '/platform-v7/bank/factoring', expected: /\/platform-v7\/bank\/factoring/ },
] as const;

async function setRole(page: any, role: string) {
  await page.addInitScript((value: string) => {
    window.sessionStorage.setItem('pc-v7-active-role', value);
    document.cookie = `pc-role=${value}; Path=/; SameSite=Lax`;
  }, role);
}

test.describe('platform-v7 role redirect smoke', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true });

  for (const item of redirectCases) {
    test(`${item.role} is redirected away from ${item.from}`, async ({ page }) => {
      await setRole(page, item.role);
      await page.goto(item.from, { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(item.to, { timeout: 15000 });
      await expect(page.locator('body')).not.toContainText('Ошибка страницы');
    });
  }

  for (const item of allowedCases) {
    test(`${item.role} can stay on ${item.path}`, async ({ page }) => {
      await setRole(page, item.role);
      const response = await page.goto(item.path, { waitUntil: 'domcontentloaded' });
      expect(response?.ok(), `${item.path} should return ok response`).toBeTruthy();
      await expect(page).toHaveURL(item.expected, { timeout: 15000 });
      await expect(page.locator('body')).not.toContainText('Ошибка страницы');
    });
  }
});
