import { expect, test } from '@playwright/test';

test.describe('platform-v7 EvidencePack', () => {
  test('renders on disputes page and keeps mobile layout stable', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const response = await page.goto('/platform-v7/disputes', { waitUntil: 'networkidle' });

    expect(response?.ok()).toBeTruthy();
    await expect(page.getByTestId('platform-v7-evidence-pack')).toBeVisible();
    await expect(page.getByText('Фото')).toBeVisible();
    await expect(page.getByText('GPS')).toBeVisible();
    await expect(page.getByText('Вес')).toBeVisible();
    await expect(page.getByText('Пломба')).toBeVisible();
    await expect(page.getByText('Лаборатория')).toBeVisible();
    await expect(page.getByText('Журнал действий')).toBeVisible();

    const overflowX = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflowX, '/platform-v7/disputes should not have horizontal overflow at 390px').toBe(false);
  });
});
