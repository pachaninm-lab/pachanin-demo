import { expect, test } from '@playwright/test';

test('platform-v7 disputes page shows evidence pack gate without fake confirmations', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/platform-v7/disputes');

  await expect(page.getByText('Проверка доказательного пакета')).toBeVisible();
  await expect(page.getByText('Решение можно готовить').or(page.getByText('Решение закрыто до комплекта доказательств'))).toBeVisible();
  await expect(page.getByText(/Готовность/)).toBeVisible();
  await expect(page.getByText(/Действие/)).toBeVisible();
  await expect(page.getByText(/подготовить решение по спору|дособрать доказательства/)).toBeVisible();

  const body = await page.locator('body').innerText();
  expect(body).not.toMatch(/production-ready|fully live|fully integrated|гарантирует оплату|платформа сама выпускает деньги/i);
});
