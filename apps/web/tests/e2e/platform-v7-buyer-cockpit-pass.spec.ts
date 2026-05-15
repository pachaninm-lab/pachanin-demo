import { expect, test } from '@playwright/test';

const ROUTE = '/platform-v7/buyer';

test.describe('platform-v7 buyer cockpit entry', () => {
  test('shows buyer reserve blocker, bank boundary, and next action on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const response = await page.goto(ROUTE, { waitUntil: 'networkidle' });

    expect(response?.ok(), 'buyer route should load').toBeTruthy();
    await expect(page.getByTestId('platform-v7-buyer-execution-cockpit')).toBeVisible();
    await expect(page.locator('body')).toContainText('Покупатель · RFQ → оффер → резерв → логистика');
    await expect(page.locator('body')).toContainText('Подтвердить резерв и условия, чтобы сделка пошла в исполнение');
    await expect(page.locator('body')).toContainText('Блокер / причина');
    await expect(page.locator('body')).toContainText('Резерв ещё не подтверждён банком');
    await expect(page.locator('body')).toContainText('Сделка не переходит к логистике до банковского статуса');
    await expect(page.locator('body')).toContainText('9,65 млн ₽');
    await expect(page.locator('body')).toContainText('624 тыс. ₽');
    await expect(page.locator('body')).toContainText('Запросить подтверждение резерва');
    await expect(page.locator('body')).not.toContainText(/платформа гарантирует оплату|платформа сама выпускает деньги|production-ready|fully live|fully integrated/i);
  });
});
