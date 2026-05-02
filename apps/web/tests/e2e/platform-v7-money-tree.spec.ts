import { expect, test } from '@playwright/test';

test.describe('platform-v7 MoneyTree strip', () => {
  test('renders on bank page and keeps mobile layout stable', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const response = await page.goto('/platform-v7/bank', { waitUntil: 'networkidle' });

    expect(response?.ok()).toBeTruthy();
    await expect(page.getByTestId('platform-v7-money-tree-strip')).toBeVisible();
    await expect(page.getByText('Всего в резерве', { exact: false })).toBeVisible();
    await expect(page.getByText('К выпуску')).toBeVisible();
    await expect(page.getByText('Удержано')).toBeVisible();
    await expect(page.getByText('Заблокировано спором')).toBeVisible();
    await expect(page.getByText('Суммы сходятся')).toBeVisible();

    const overflowX = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflowX, '/platform-v7/bank should not have horizontal overflow at 390px').toBe(false);
  });
});
