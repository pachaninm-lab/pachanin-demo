import { expect, test } from '@playwright/test';

const externalExecutionRoutes = [
  '/platform-v7/lots',
  '/platform-v7/buyer',
  '/platform-v7/seller',
  '/platform-v7/logistics/requests',
  '/platform-v7/logistics/trips',
  '/platform-v7/logistics/trips/TR-2041',
  '/platform-v7/driver',
  '/platform-v7/elevator',
  '/platform-v7/lab',
  '/platform-v7/bank/release-safety',
  '/platform-v7/deals/DL-9116',
  '/platform-v7/lots/LOT-2403/bids',
] as const;

const forbiddenFragments = [
  'Control Tower',
  'callback',
  'callbacks',
  'evidence-first',
  'release',
  'hold',
  'owner',
  'blocker',
  'sandbox dispatch',
  'Action handoff',
  'domain-core',
  'runtime',
  'idempotency',
  'guard',
  'legacy',
  'mock',
  'debug',
  'test user',
  'GigaChat',
  'assistant',
  'Assistant',
  'AI',
];

async function visibleText(page: import('@playwright/test').Page): Promise<string> {
  await expect(page.locator('body')).toBeVisible();
  return page.locator('body').innerText();
}

test.describe('platform-v7 expanded forbidden visible terms gate', () => {
  for (const route of externalExecutionRoutes) {
    test(`${route} does not expose forbidden external terms`, async ({ page }) => {
      const response = await page.goto(route, { waitUntil: 'networkidle' });
      expect(response?.ok(), `${route} must render`).toBeTruthy();

      const body = await visibleText(page);
      for (const fragment of forbiddenFragments) {
        expect(body, `${route} must not expose ${fragment}`).not.toContain(fragment);
      }
    });
  }
});
