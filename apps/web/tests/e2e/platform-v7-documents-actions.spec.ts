import { expect, test } from '@playwright/test';

const HIDDEN_ROUTES = [
  '/platform-v7/driver/field',
  '/platform-v7/logistics',
  '/platform-v7/elevator',
  '/platform-v7/lab',
] as const;

test.describe('platform-v7 document action wiring', () => {
  test('/platform-v7/bank shows safe document actions', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const response = await page.goto('/platform-v7/bank', { waitUntil: 'networkidle' });

    expect(response?.ok()).toBeTruthy();
    await expect(page.locator('body')).not.toContainText(/404|Application error|Unhandled Runtime Error/i);
    await expect(page.getByTestId('platform-v7-documents-actions')).toBeVisible();
    await expect(page.getByTestId('platform-v7-documents-actions')).toContainText(/запросить документ/i);
    await expect(page.getByTestId('platform-v7-documents-actions')).toContainText(/ручную проверку/i);
    await expect(page.getByTestId('platform-v7-documents-actions')).toContainText(/тестовом режиме/i);
    await expect(page.getByTestId('platform-v7-documents-actions')).not.toContainText(/подтверждено внешней системой|подписано автоматически/i);
  });

  for (const route of HIDDEN_ROUTES) {
    test(`${route} does not show bank document actions`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      const response = await page.goto(route, { waitUntil: 'networkidle' });

      expect(response?.ok(), `${route} should return 200`).toBeTruthy();
      await expect(page.locator('body')).not.toContainText(/404|Application error|Unhandled Runtime Error/i);
      await expect(page.getByTestId('platform-v7-documents-actions')).toHaveCount(0);
    });
  }
});
