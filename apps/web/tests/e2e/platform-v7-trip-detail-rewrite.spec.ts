import { expect, test } from '@playwright/test';

async function readBody(page: import('@playwright/test').Page): Promise<string> {
  await expect(page.locator('body')).toBeVisible();
  return page.locator('body').innerText();
}

test.describe('platform-v7 trip detail rewrite', () => {
  test('deep trip link renders trip detail context through rewrite', async ({ page }) => {
    const response = await page.goto('/platform-v7/logistics/trips/TR-2041', { waitUntil: 'networkidle' });
    expect(response?.ok()).toBeTruthy();

    const text = await readBody(page);
    expect(text).toContain('Рейс TR-2041');
    expect(text).toContain('DL-9116');
    expect(text).toContain('LR-2041');
    expect(text).toContain('Полевые подтверждения');
    expect(text).toContain('GPS');
    expect(text).toContain('Фото');
    expect(text).toContain('Пломба');
    expect(text).toContain('Документы');
  });
});
