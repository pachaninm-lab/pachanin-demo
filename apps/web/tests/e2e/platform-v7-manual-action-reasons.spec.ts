import { expect, test } from '@playwright/test';

test.describe('platform-v7 manual action reasons', () => {
  test('renders on Control Tower and keeps mobile layout stable', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const response = await page.goto('/platform-v7/control-tower', { waitUntil: 'networkidle' });

    expect(response?.ok()).toBeTruthy();
    await expect(page.getByTestId('platform-v7-manual-action-reasons')).toBeVisible();
    await expect(page.getByText('Нельзя менять сделку без причины')).toBeVisible();
    await expect(page.getByText('Ручное действие остановлено: нужна причина.')).toBeVisible();
    await expect(page.getByText('Ручное действие зафиксировано.')).toBeVisible();
    await expect(page.getByText('Причина: не указана')).toBeVisible();
    await expect(page.getByText('Причина: Не хватает транспортного пакета')).toBeVisible();

    const overflowX = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflowX, '/platform-v7/control-tower should not have horizontal overflow at 390px').toBe(false);
  });
});
