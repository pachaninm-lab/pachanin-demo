import { expect, test } from '@playwright/test';

test.describe('platform-v7 action feedback strip', () => {
  test('renders on bank page and keeps mobile layout stable', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const response = await page.goto('/platform-v7/bank', { waitUntil: 'networkidle' });

    expect(response?.ok()).toBeTruthy();
    await expect(page.getByTestId('platform-v7-action-feedback-strip')).toBeVisible();
    await expect(page.getByText('Результат действия и следующий шаг')).toBeVisible();
    await expect(page.getByText('Проверить документы')).toBeVisible();
    await expect(page.getByText('Отправить на ручную проверку')).toBeVisible();
    await expect(page.getByText('Проверить доказательства')).toBeVisible();

    const overflowX = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflowX, '/platform-v7/bank should not have horizontal overflow at 390px').toBe(false);
  });
});
