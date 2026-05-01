import { expect, test } from '@playwright/test';

async function readBody(page: import('@playwright/test').Page): Promise<string> {
  await expect(page.locator('body')).toBeVisible();
  return page.locator('body').innerText();
}

test.describe('platform-v7 logistics lifecycle actions', () => {
  test('operator can send request, carrier submits quote, operator accepts quote and trip appears', async ({ page }) => {
    const response = await page.goto('/platform-v7/logistics/requests', { waitUntil: 'networkidle' });
    expect(response?.ok()).toBeTruthy();

    await expect(page.getByTestId('platform-v7-logistics-request-card')).toBeVisible();
    await expect(page.getByText('LR-2041')).toBeVisible();
    await expect(page.getByText('Рейс ещё не создан')).toBeVisible();

    await page.getByRole('button', { name: 'Отправить в логистику' }).click();
    await expect(page.getByText('Заявка отправлена перевозчику')).toBeVisible();
    await expect(page.getByText('отправлена')).toBeVisible();

    await page.getByRole('button', { name: 'Отметить просмотр' }).click();
    await expect(page.getByText('Заявка просмотрена')).toBeVisible();
    await expect(page.getByText('просмотрена')).toBeVisible();

    await page.getByRole('button', { name: 'Предложить условия' }).click();
    await expect(page.getByText('Перевозчик предложил условия')).toBeVisible();
    await expect(page.getByTestId('platform-v7-logistics-quote-card')).toBeVisible();
    await expect(page.getByText('LQ-3001')).toBeVisible();
    await expect(page.getByText(/2\s*400\s*₽\/т/)).toBeVisible();

    await page.getByRole('button', { name: 'Выбрать предложение' }).click();
    await expect(page.getByText('Предложение выбрано, рейс создан')).toBeVisible();
    await expect(page.getByTestId('platform-v7-trip-created-card')).toBeVisible();
    await expect(page.getByText('TR-2041')).toBeVisible();
    await expect(page.getByText('driver-2041')).toBeVisible();
    await expect(page.getByText('truck-2041')).toBeVisible();
  });

  test('logistics lifecycle screen hides grain bid economics and banking context', async ({ page }) => {
    const response = await page.goto('/platform-v7/logistics/requests', { waitUntil: 'networkidle' });
    expect(response?.ok()).toBeTruthy();

    const text = await readBody(page);
    expect(text).toContain('Логистика: входящие заявки');
    expect(text).toContain('Тамбов → Воронеж');

    for (const forbidden of ['Цена ожидания', 'Лучшая ставка', 'Минимум продавца', 'Покупатель A', 'Покупатель B', 'Покупатель C', 'Резерв', 'Выпуск денег', 'Маржа']) {
      expect(text, `logistics route must not show ${forbidden}`).not.toContain(forbidden);
    }
  });

  test('trip route exposes trip field context without grain bid fight', async ({ page }) => {
    const response = await page.goto('/platform-v7/logistics/trips', { waitUntil: 'networkidle' });
    expect(response?.ok()).toBeTruthy();

    const text = await readBody(page);
    await expect(page.getByText('Рейс TR-2041')).toBeVisible();
    await expect(page.getByText('Полевые подтверждения')).toBeVisible();
    expect(text).toContain('DL-9116');
    expect(text).toContain('LR-2041');

    for (const forbidden of ['Лучшая ставка', 'Минимум продавца', 'Покупатель A', 'Покупатель B', 'Покупатель C', 'Резерв']) {
      expect(text, `trip route must not show ${forbidden}`).not.toContain(forbidden);
    }
  });
});
