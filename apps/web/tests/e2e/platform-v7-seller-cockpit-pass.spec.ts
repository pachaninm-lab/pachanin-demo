import { expect, test } from '@playwright/test';

const ROUTE = '/platform-v7/seller';

test.describe('platform-v7 seller cockpit entry', () => {
  test.beforeEach(async ({ page, context }) => {
    // Enter as the seller role: pass the platform entry gate (middleware cookie)
    // and the in-app single-entry guard (sessionStorage active role).
    await context.addCookies([
      { name: 'pc_v7_entry_seen', value: 'true', url: 'http://localhost:3000' },
      { name: 'pc-role', value: 'seller', url: 'http://localhost:3000' },
    ]);
    await page.addInitScript(() => window.sessionStorage.setItem('pc-v7-active-role', 'seller'));
  });

  test('shows seller blocker, bank boundary, and next document action on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const response = await page.goto(ROUTE, { waitUntil: 'networkidle' });

    expect(response?.ok(), 'seller route should load').toBeTruthy();
    await expect(page.locator('[data-platform-v7-seller-cockpit-pass="true"]')).toBeVisible();
    await expect(page.locator('body')).toContainText('Кабинет продавца · сделка → документы → деньги');
    await expect(page.locator('body')).toContainText('главный блокер');
    await expect(page.locator('body')).toContainText('СДИЗ и ЭТрН не закрыты');
    await expect(page.locator('body')).toContainText('резерв');
    await expect(page.locator('body')).toContainText('не выплата');
    await expect(page.locator('body')).toContainText('на проверке банка');
    await expect(page.locator('body')).toContainText('Закрыть документы, чтобы передать основание банку');
    await expect(page.locator('body')).not.toContainText(/платформа гарантирует оплату|платформа сама выпускает деньги|production-ready|fully live|fully integrated/i);
  });
});
