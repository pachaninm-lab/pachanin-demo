import { expect, test } from '@playwright/test';

const ROUTE = '/platform-v7/seller';

test.describe('platform-v7 seller cockpit entry', () => {
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
    await expect(page.locator('body')).toContainText('ждёт основание');
    await expect(page.locator('body')).toContainText('Закрыть СДИЗ и ЭТрН');
    await expect(page.locator('body')).not.toContainText(/платформа гарантирует оплату|платформа сама выпускает деньги|production-ready|fully live|fully integrated/i);
  });
});
