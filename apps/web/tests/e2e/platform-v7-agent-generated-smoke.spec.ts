import { expect, test } from '@playwright/test';

test.describe('platform-v7 generated fallback smoke', () => {
  test('Autopilot Product Slice 01 keeps platform available', async ({ page }) => {
    const response = await page.goto('/platform-v7', { waitUntil: 'networkidle' });

    expect(response?.ok(), 'platform-v7 should return 2xx').toBeTruthy();
    await expect(page.locator('body'), 'platform-v7 should render body content').toBeVisible();
    await expect(page.locator('body'), 'platform-v7 should not show fatal route copy').not.toContainText(/404|500|Application error|Unhandled Runtime Error|This page could not be found/i);
  });
});
