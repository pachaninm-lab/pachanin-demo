import { expect, test } from '@playwright/test';

test('platform-v7 release feedback panel fits mobile width', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const response = await page.goto('/platform-v7/deals/grain-release', { waitUntil: 'networkidle' });

  expect(response?.ok()).toBeTruthy();
  await expect(page.getByText('Действия по сделке')).toBeVisible();
  await expect(page.getByText('Связанные обращения')).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
});
