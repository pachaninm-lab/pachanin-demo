import { expect, test } from '@playwright/test';

const ROUTE = '/platform-v7/roles';

test.describe('platform-v7 role cockpit selector', () => {
  test('renders roles as focus blocker action cards on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const response = await page.goto(ROUTE, { waitUntil: 'networkidle' });

    expect(response?.ok(), 'roles route should load').toBeTruthy();
    await expect(page.locator('[data-platform-v7-role-cockpit-selector="true"]')).toBeVisible();
    await expect(page.locator('body')).toContainText('Ролевой пульт сделки');
    await expect(page.locator('body')).toContainText('главный блокер');
    await expect(page.locator('body')).toContainText('следующее действие');
    await expect(page.locator('body')).toContainText('single-action');
    await expect(page.locator('body')).toContainText('Водитель');
    await expect(page.locator('body')).toContainText('Элеватор');
    await expect(page.locator('body')).toContainText('Лаборатория');
    await expect(page.locator('body')).not.toContainText(/production-ready|fully live|fully integrated|платформа гарантирует оплату/i);
  });
});
