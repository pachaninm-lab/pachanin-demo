import { expect, test } from '@playwright/test';

test.describe('platform-v7 evidence decision wiring', () => {
  test('/platform-v7/disputes shows evidence decision guardrails', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const response = await page.goto('/platform-v7/disputes', { waitUntil: 'networkidle' });

    expect(response?.ok()).toBeTruthy();
    await expect(page.locator('body')).not.toContainText(/404|Application error|Unhandled Runtime Error/i);
    await expect(page.getByTestId('platform-v7-evidence-decision-panel')).toBeVisible();
    await expect(page.getByTestId('platform-v7-evidence-decision-panel')).toContainText(/запросить доказательство/i);
    await expect(page.getByTestId('platform-v7-evidence-decision-panel')).toContainText(/основание/i);
    await expect(page.getByTestId('platform-v7-evidence-decision-panel')).toContainText(/удержание/i);
    await expect(page.getByTestId('platform-v7-evidence-decision-panel')).toContainText(/не выдумываются/i);
    await expect(page.getByTestId('platform-v7-evidence-decision-panel')).not.toContainText(/geo подтвержден|hash подтвержден|version подтвержден/i);
  });
});
