import { expect, test } from '@playwright/test';

const ROUTE = '/platform-v7/buyer';

test.describe('platform-v7 buyer cockpit entry', () => {
  test.beforeEach(async ({ page, context }) => {
    // Enter as the buyer role: pass the platform entry gate (middleware cookie)
    // and the in-app single-entry guard (sessionStorage active role).
    await context.addCookies([
      { name: 'pc_v7_entry_seen', value: 'true', url: 'http://localhost:3000' },
      { name: 'pc-role', value: 'buyer', url: 'http://localhost:3000' },
    ]);
    await page.addInitScript(() => window.sessionStorage.setItem('pc-v7-active-role', 'buyer'));
  });

  test('shows buyer reserve blocker, bank boundary, and next action on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const response = await page.goto(ROUTE, { waitUntil: 'networkidle' });

    expect(response?.ok(), 'buyer route should load').toBeTruthy();
    await expect(page.locator('[data-platform-v7-buyer-cockpit-pass="true"]')).toBeVisible();
    await expect(page.locator('body')).toContainText('Кабинет покупателя · запрос → резерв → логистика');
    await expect(page.locator('body')).toContainText('Подтвердить резерв');
    await expect(page.locator('body')).toContainText('чтобы сделка пошла в исполнение');
    await expect(page.locator('body')).toContainText('главный блокер');
    await expect(page.locator('body')).toContainText('резерв ждёт подтверждение банка');
    await expect(page.locator('body')).toContainText('логистика не стартует до статуса банка');
    await expect(page.locator('body')).toContainText('9,65 млн ₽');
    await expect(page.locator('body')).toContainText('ждёт банк');
    await expect(page.locator('body')).toContainText('624 тыс. ₽');
    await expect(page.locator('body')).toContainText('Запросить подтверждение резерва');
    await expect(page.locator('body')).not.toContainText(/платформа гарантирует оплату|платформа сама выпускает деньги|production-ready|fully live|fully integrated/i);
  });
});
