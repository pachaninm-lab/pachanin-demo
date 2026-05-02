import { expect, test } from '@playwright/test';

test.describe('platform-v7 driver field shell', () => {
  test('keeps the field route focused on trip execution and free from forbidden role leakage', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const response = await page.goto('/platform-v7/driver/field', { waitUntil: 'networkidle' });

    expect(response?.ok()).toBeTruthy();
    await expect(page.getByTestId('platform-v7-driver-field-shell')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Рейс водителя' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Подтвердить прибытие|Прибытие подтверждено/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Сообщить об отклонении' })).toBeVisible();

    const visibleText = await page.locator('body').innerText();

    for (const forbidden of [
      'Инвесторский режим',
      'Открыть банк',
      'Открыть центр управления',
      'Открыть сделку',
      'Сделать ставку',
      'Запросить резерв',
      'Подтвердить выпуск денег',
      'К выпуску',
      'Под удержанием',
    ]) {
      expect(visibleText, `/platform-v7/driver/field should not expose ${forbidden}`).not.toContain(forbidden);
    }

    const overflowX = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflowX, '/platform-v7/driver/field should not have horizontal overflow at 390px').toBe(false);
  });
});
