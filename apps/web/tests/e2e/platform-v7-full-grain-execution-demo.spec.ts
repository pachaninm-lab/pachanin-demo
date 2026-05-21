import { expect, test } from '@playwright/test';

test('opens grain execution demo flow without 404 content', async ({ page }) => {
  await page.goto('/platform-v7/demo/grain-execution');
  await expect(page.getByText('Сквозной сценарий от партии до денег')).toBeVisible();
  await expect(page.getByText('Партия создана')).toBeVisible();
  await expect(page.getByText('к выпуску через банк').first()).toBeVisible();
});
