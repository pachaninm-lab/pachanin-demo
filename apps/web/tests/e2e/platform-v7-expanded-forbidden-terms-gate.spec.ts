import { expect, test } from '@playwright/test';

const riskRoutes = [
  '/platform-v7',
  '/platform-v7/control-tower',
  '/platform-v7/bank',
  '/platform-v7/integrations',
  '/platform-v7/runtime-status',
  '/platform-v7/security',
  '/platform-v7/demo',
  '/platform-v7/roles',
  '/platform-v7/support',
  '/platform-v7/logistics',
  '/platform-v7/disputes',
  '/platform-v7/evidence-pack',
  '/platform-v7/execution-map',
  '/platform-v7r',
  '/platform-v7r/deals',
  '/platform-v7r/driver',
  '/platform-v7r/elevator',
  '/platform-v7r/lab',
];

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
  for (const route of riskRoutes) {
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
