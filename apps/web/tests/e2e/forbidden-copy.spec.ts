import { expect, test } from '@playwright/test';

const routes = [
  '/platform-v7',
  '/platform-v7/roles',
  '/platform-v7/seller',
  '/platform-v7/buyer',
  '/platform-v7/logistics',
  '/platform-v7/driver',
  '/platform-v7/driver/field',
  '/platform-v7/elevator',
  '/platform-v7/lab',
  '/platform-v7/surveyor',
  '/platform-v7/bank',
  '/platform-v7/control-tower',
  '/platform-v7/disputes',
  '/platform-v7/compliance',
  '/platform-v7/arbitrator',
  '/platform-v7/investor',
  '/platform-v7/demo',
] as const;

const forbiddenVisibleTerms = [
  'Controlled pilot',
  'callbacks',
  'evidence-first',
  'Simulation-grade',
  'simulation-grade',
  'sandbox projection',
  'sandbox dispatch',
  'sandbox',
  'domain-core',
  'guard-правила',
  'guard',
  'runtime-контур',
  'runtime',
  'release callbacks',
  'Action handoff',
  'requestReserve',
  'legacy-логика',
  'legacy',
  'Live GPS',
  'production-ready',
  'fully live',
  'fully integrated',
  'complete product',
  'no risks',
] as const;

test.describe('platform-v7 forbidden user-facing copy', () => {
  for (const route of routes) {
    test(`${route} does not expose forbidden technical or inflated copy`, async ({ page }) => {
      const response = await page.goto(route, { waitUntil: 'networkidle' });
      expect(response?.ok(), `${route} should return 2xx`).toBeTruthy();

      const visibleText = await page.locator('body').innerText();

      for (const term of forbiddenVisibleTerms) {
        expect(visibleText, `${route} should not expose "${term}"`).not.toContain(term);
      }
    });
  }
});
