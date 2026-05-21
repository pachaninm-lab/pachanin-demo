import { expect, test } from '@playwright/test';

test.describe('platform-v7 release safety', () => {
  test('keeps the bank release screen as a control screen with visible stop reasons', async ({ page }) => {
    const response = await page.goto('/platform-v7/bank/release-safety', { waitUntil: 'domcontentloaded' });
    expect(response?.ok()).toBeTruthy();

    await expect(page.locator('body')).toContainText('Проверка безопасности выпуска денег', { timeout: 15000 });
    await expect(page.locator('body')).toContainText('Выплата допустима только после закрытия условий');
    await expect(page.locator('body')).toContainText('Причины остановки');
    await expect(page.locator('body')).toContainText('Остановлено');
    await expect(page.locator('body')).toContainText(/ФГИС|СДИЗ|документы|удержание|приёмка|качество|спор/);

    await expect(page.getByRole('button', { name: /выплатить|перевести|отправить платёж/i })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /выплатить|перевести|отправить платёж/i })).toHaveCount(0);
  });
});
