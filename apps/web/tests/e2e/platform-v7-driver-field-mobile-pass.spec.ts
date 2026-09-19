import { expect, test } from '@playwright/test';

const ROUTE = '/platform-v7/driver/field';

test.describe('platform-v7 driver field mobile shell', () => {
  test('keeps driver field focused on one trip and one action', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const response = await page.goto(ROUTE, { waitUntil: 'networkidle' });

    expect(response?.ok(), 'driver field route should load').toBeTruthy();
    await expect(page.locator('[data-platform-v7-driver-mobile-pass="true"]')).toBeVisible();
    await expect(page.locator('body')).toContainText('Водитель · один рейс · одно действие');
    await expect(page.locator('body')).toContainText('field mode');
    await expect(page.locator('body')).toContainText('Подтвердить следующее действие по рейсу');
    await expect(page.locator('body')).toContainText('только свой рейс');
    await expect(page.locator('body')).toContainText(/Связь|очередь/i);
    await expect(page.locator('body')).not.toContainText(/банк|инвестор|деньги под риском|другие сделки|Money Gate/i);
  });
});
