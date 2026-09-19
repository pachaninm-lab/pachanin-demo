import { expect, test } from '@playwright/test';

const kpis = [
  { testId: 'kpi-moneyAtRisk', href: '/platform-v7/disputes' },
  { testId: 'kpi-heldAmount', href: '/platform-v7/disputes' },
  { testId: 'kpi-readyToRelease', href: '/platform-v7/bank' },
  { testId: 'kpi-integrationStops', href: '/platform-v7/connectors' },
  { testId: 'kpi-transportStops', href: '/platform-v7/control-tower/hotlist' },
  { testId: 'kpi-slaCritical', href: '/platform-v7/deals' },
  { testId: 'kpi-reserveTotal', href: '/platform-v7/bank' },
];

test.describe('platform-v7 control tower domain KPIs', () => {
  test('domain KPI cards are visible, clickable and expose formulas', async ({ page }) => {
    const response = await page.goto('/platform-v7/control-tower', { waitUntil: 'networkidle' });
    expect(response?.ok()).toBeTruthy();

    for (const kpi of kpis) {
      const card = page.getByTestId(kpi.testId).first();
      await expect(card).toBeVisible();
      await expect(card).toHaveAttribute('href', kpi.href);
      await expect(card).toHaveAttribute('title', /.+/);
    }
  });
});
