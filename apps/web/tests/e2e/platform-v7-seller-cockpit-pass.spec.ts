import { expect, test } from '@playwright/test';

const ROUTE = '/platform-v7/seller';

test.describe('platform-v7 seller cockpit entry', () => {
  test('shows seller blocker, bank boundary, and next document action on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const response = await page.goto(ROUTE, { waitUntil: 'networkidle' });

    expect(response?.ok(), 'seller route should load').toBeTruthy();
    await expect(page.getByTestId('platform-v7-seller-execution-cockpit')).toBeVisible();
    await expect(page.locator('body')).toContainText('Продавец · партия → лот → документы → деньги');
    await expect(page.locator('body')).toContainText('Блокер / причина');
    await expect(page.locator('body')).toContainText('СДИЗ и ЭТрН не закрыты');
    await expect(page.locator('body')).toContainText('резерв');
    await expect(page.locator('body')).toContainText('не выплата');
    await expect(page.locator('body')).toContainText('Банк не получает основание');
    await expect(page.locator('body')).toContainText('Закрыть СДИЗ');
    await expect(page.locator('body')).not.toContainText(/платформа гарантирует оплату|платформа сама выпускает деньги|production-ready|fully live|fully integrated/i);
  });
});
