import { expect, test } from '@playwright/test';

const noCrash = /404|500|Application error|Unhandled Runtime Error/i;

test.describe('platform-v7 execution flow guard', () => {
  test('keeps public entry, open walkthrough and deal execution routes connected', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto('/platform-v7', { waitUntil: 'networkidle' });
    await expect(page.getByTestId('platform-v7-root-execution-cockpit')).toBeVisible();
    await expect(page.getByText('Одна сделка', { exact: false })).toBeVisible();
    await expect(page.locator('text=/404|500|Application error|Unhandled Runtime Error/i')).toHaveCount(0);

    await page.goto('/platform-v7/open', { waitUntil: 'networkidle' });
    await expect(page.getByTestId('platform-v7-open-walkthrough')).toBeVisible();
    await expect(page.getByText('Как открывается путь сделки')).toBeVisible();
    await expect(page.locator('text=/404|500|Application error|Unhandled Runtime Error/i')).toHaveCount(0);

    await page.goto('/platform-v7/roles', { waitUntil: 'networkidle' });
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator(`text=${noCrash.source}`)).toHaveCount(0);

    await page.goto('/platform-v7/deals/DL-9106/money', { waitUntil: 'networkidle' });
    await expect(page.locator('body')).toBeVisible();
    await expect(page.getByText(/деньг|расч[её]т|банк/i).first()).toBeVisible();
    await expect(page.locator('text=/404|500|Application error|Unhandled Runtime Error/i')).toHaveCount(0);

    await page.goto('/platform-v7/deals/DL-9106/audit', { waitUntil: 'networkidle' });
    await expect(page.locator('body')).toBeVisible();
    await expect(page.getByText(/журнал|аудит|событ/i).first()).toBeVisible();
    await expect(page.locator('text=/404|500|Application error|Unhandled Runtime Error/i')).toHaveCount(0);
  });
});
