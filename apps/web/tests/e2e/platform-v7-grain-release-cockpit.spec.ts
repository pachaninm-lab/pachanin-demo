import { expect, test } from '@playwright/test';

const ROUTE = '/platform-v7/deals/grain-release';

test.describe('platform-v7 grain release cockpit', () => {
  test('renders the release cockpit with money, documents, inspector, and honest bank wording', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const response = await page.goto(ROUTE, { waitUntil: 'networkidle' });

    expect(response?.ok(), 'grain release route should load').toBeTruthy();
    await expect(page.locator('[data-platform-v7-grain-release-cockpit="true"]')).toBeVisible();
    await expect(page.locator('body')).toContainText('Money Gate');
    await expect(page.locator('body')).toContainText('Smart Inspector');
    await expect(page.locator('body')).toContainText('Execution Rail');
    await expect(page.locator('body')).toContainText('Document Control');
    await expect(page.locator('body')).toContainText(/ожидает подтверждения банка|основание банка|банковского подтверждения/i);
    await expect(page.locator('body')).not.toContainText(/платформа гарантирует оплату|платформа сама выпускает деньги|fully live|production-ready/i);
  });
});
