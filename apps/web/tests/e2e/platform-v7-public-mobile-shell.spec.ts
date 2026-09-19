import { expect, test } from '@playwright/test';

test.describe('platform-v7 public mobile shell', () => {
  test('public entry renders on 390px without internal app chrome', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/platform-v7', { waitUntil: 'networkidle' });

    await expect(page.getByTestId('platform-v7-root-execution-cockpit')).toBeVisible();
    await expect(page.locator('.pc-v4-header')).toHaveCount(0);
    await expect(page.locator('.pc-v4-bottomnav')).toHaveCount(0);
    await expect(page.locator('.pc-v4-drawer')).toHaveCount(0);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(2);
  });

  test('public open page does not expose old cabinet CTAs on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/platform-v7/open', { waitUntil: 'networkidle' });

    await expect(page.getByTestId('platform-v7-open-walkthrough')).toBeVisible();
    await expect(page.getByText('Выставить партию', { exact: false })).toHaveCount(0);
    await expect(page.getByText('Создать запрос на закупку', { exact: false })).toHaveCount(0);
    await expect(page.getByText('Открытый просмотр', { exact: false })).toHaveCount(0);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(2);
  });
});
