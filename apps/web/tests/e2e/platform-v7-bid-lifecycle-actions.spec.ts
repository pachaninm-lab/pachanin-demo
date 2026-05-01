import { expect, test } from '@playwright/test';

test.describe('platform-v7 bid lifecycle actions', () => {
  test('seller can accept a bid and journal shows created deal', async ({ page }) => {
    const response = await page.goto('/platform-v7/lots/LOT-2403/bids', { waitUntil: 'networkidle' });
    expect(response?.ok()).toBeTruthy();

    await expect(page.getByTestId('platform-v7-bid-lifecycle-seller')).toBeVisible();
    await page.getByRole('button', { name: 'Принять' }).first().click();

    await expect(page.getByText('Ставка принята')).toBeVisible();
    await expect(page.getByText(/Создана сделка DL-9116/)).toBeVisible();
    await expect(page.getByText(/условия ставки заморожены/i)).toBeVisible();
  });

  test('seller can request clarification and see journal update', async ({ page }) => {
    const response = await page.goto('/platform-v7/lots/LOT-2403/bids', { waitUntil: 'networkidle' });
    expect(response?.ok()).toBeTruthy();

    await page.getByRole('button', { name: 'Запросить уточнение' }).first().click();

    await expect(page.getByText('Запрошено уточнение')).toBeVisible();
    await expect(page.getByText(/подтвердить окно вывоза/i)).toBeVisible();
  });

  test('buyer can improve own bid without seeing competing bids or seller floor', async ({ page }) => {
    const response = await page.goto('/platform-v7/buyer', { waitUntil: 'networkidle' });
    expect(response?.ok()).toBeTruthy();

    const beforeText = await page.locator('body').innerText();
    expect(beforeText).not.toContain('Лучшая ставка');
    expect(beforeText).not.toContain('Минимум продавца');
    expect(beforeText).not.toContain('Покупатель A');
    expect(beforeText).not.toContain('Покупатель C');

    await page.getByRole('button', { name: 'Повысить на 100 ₽/т' }).click();

    await expect(page.getByText('Ставка изменена')).toBeVisible();
    await expect(page.getByText(/Новая цена:\s*15\s*800\s*₽\/т/)).toBeVisible();
    await expect(page.getByText(/Сумма пересчитана автоматически/)).toBeVisible();
  });

  test('buyer can withdraw own bid and journal records it', async ({ page }) => {
    const response = await page.goto('/platform-v7/buyer', { waitUntil: 'networkidle' });
    expect(response?.ok()).toBeTruthy();

    await page.getByRole('button', { name: 'Отозвать ставку' }).click();

    await expect(page.getByText('Ставка отозвана')).toBeVisible();
    await expect(page.getByText(/убрал ставку из активного сравнения/i)).toBeVisible();
    await expect(page.getByText('отозвана')).toBeVisible();
  });
});
