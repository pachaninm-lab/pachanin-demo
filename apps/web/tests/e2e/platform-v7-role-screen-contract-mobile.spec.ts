import { expect, test } from '@playwright/test';

const MOBILE_VIEWPORT = { width: 390, height: 844 } as const;
const OVERFLOW_TOLERANCE_PX = 2;

const ROLE_CONTRACT_ROUTES = [
  { route: '/platform-v7/logistics', role: 'logistics' },
  { route: '/platform-v7/bank', role: 'bank' },
] as const;

const REQUIRED_CONTRACT_LABELS = ['Статус', 'Блокер', 'Главное действие', 'Деньги', 'Документы / evidence'] as const;

test.describe('platform-v7 role screen contract mobile smoke', () => {
  test.use({ viewport: MOBILE_VIEWPORT });

  for (const { route, role } of ROLE_CONTRACT_ROUTES) {
    test(`${route} exposes first-decision role contract without mobile overflow`, async ({ page }) => {
      const response = await page.goto(route, { waitUntil: 'domcontentloaded' });

      expect(response?.ok(), `${route} should return a successful response`).toBeTruthy();

      const contract = page.getByTestId(`platform-v7-${role}-screen-contract`);
      await expect(contract, `${role} screen contract should be visible`).toBeVisible();

      for (const label of REQUIRED_CONTRACT_LABELS) {
        await expect(contract.getByText(label), `${role} contract should show ${label}`).toBeVisible();
      }

      const overflowPx = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflowPx, `${route} horizontal overflow should stay within tolerance`).toBeLessThanOrEqual(OVERFLOW_TOLERANCE_PX);
    });
  }
});
