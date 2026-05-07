import { expect, test } from '@playwright/test';

test('platform-v7 bank release safety hides direct money release when blockers exist', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/platform-v7/bank/release-safety');

  await expect(page.getByText('Проверка безопасности выпуска денег')).toBeVisible();
  await expect(page.getByText('Закрыть условия').first()).toBeVisible();
  await expect(page.getByText('Запрос на банковскую проверку скрыт до закрытия причин остановки.').first()).toBeVisible();
  await expect(page.getByText('Причины остановки').first()).toBeVisible();

  const body = await page.locator('body').innerText();
  expect(body).not.toMatch(/платформа сама выпускает деньги|гарантирует оплату|production-ready|fully live|fully integrated/i);
});
