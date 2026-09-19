import { expect, test } from '@playwright/test';

test.describe('platform-v7 test mode systems panel', () => {
  test('renders on connectors page and keeps external systems in test mode', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const response = await page.goto('/platform-v7/connectors', { waitUntil: 'networkidle' });

    expect(response?.ok()).toBeTruthy();
    await expect(page.getByTestId('platform-v7-test-mode-systems')).toBeVisible();
    await expect(page.getByText('Внешние подключения · тестовый режим')).toBeVisible();
    await expect(page.getByText('Симуляция ответов')).toBeVisible();
    await expect(page.getByText('Банк')).toBeVisible();
    await expect(page.getByText('ФГИС Зерно')).toBeVisible();
    await expect(page.getByText('ЭДО')).toBeVisible();
    await expect(page.getByText('ЭТрН')).toBeVisible();
    await expect(page.getByText('GPS / телематика')).toBeVisible();
    await expect(page.getByText('Лаборатория')).toBeVisible();

    const overflowX = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflowX, '/platform-v7/connectors should not have horizontal overflow at 390px').toBe(false);
  });
});
