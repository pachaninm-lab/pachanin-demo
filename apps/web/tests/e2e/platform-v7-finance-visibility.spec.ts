import { expect, test } from '@playwright/test';

test.describe('platform-v7 finance visibility gates', () => {
  test('bank release safety hides bid comparison', async ({ page }) => {
    const response = await page.goto('/platform-v7/bank/release-safety', { waitUntil: 'networkidle' });
    expect(response?.ok()).toBeTruthy();

    const text = await page.locator('body').innerText();
    await expect(page.getByText('Проверка выпуска денег')).toBeVisible();
    expect(text).toContain('Выпуск денег заблокирован');
    expect(text).toContain('Выпуск денег разрешён');
    expect(text).not.toContain('Сравнение ставок');
    expect(text).not.toContain('Минимум продавца');
    expect(text).not.toContain('Лучшая ставка');
  });

  test('investor route hides operational controls', async ({ page }) => {
    const response = await page.goto('/platform-v7/investor', { waitUntil: 'networkidle' });
    expect(response?.ok()).toBeTruthy();

    const text = await page.locator('body').innerText();
    await expect(page.getByText('Инвестор и раунд')).toBeVisible();
    expect(text).toContain('демонстрационный инвестиционный срез');
    expect(text).toContain('Показатели доверия');
    expect(text).not.toContain('Сравнение ставок');
    expect(text).not.toContain('Минимум продавца');
    expect(text).not.toContain('Лучшая ставка');
    expect(text).not.toContain('Подтвердить выпуск');
  });
});
