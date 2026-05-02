import { expect, test } from '@playwright/test';

const PRIORITY_ROUTES = [
  '/platform-v7',
  '/platform-v7/seller',
  '/platform-v7/buyer',
  '/platform-v7/logistics',
  '/platform-v7/driver/field',
  '/platform-v7/elevator',
  '/platform-v7/lab',
  '/platform-v7/bank',
  '/platform-v7/control-tower',
  '/platform-v7/disputes',
  '/platform-v7/connectors',
  '/platform-v7/investor',
] as const;

const FORBIDDEN_COPY = [
  'production-ready',
  'fully live',
  'fully integrated',
  'complete product',
  'no risks',
  'Simulation-grade',
  'domain-core',
  'Action handoff',
  'requestReserve',
  'всё готово',
  'нет рисков',
  'нет аналогов',
  'платформа гарантирует оплату',
  'платформа сама выпускает деньги',
  'лучшая в мире',
] as const;

test.describe('platform-v7 forbidden copy gate', () => {
  for (const route of PRIORITY_ROUTES) {
    test(`${route} does not expose forbidden copy`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      const response = await page.goto(route, { waitUntil: 'networkidle' });

      expect(response?.ok(), `${route} should return 200`).toBeTruthy();
      const bodyText = await page.locator('body').innerText().then((text) => text.toLowerCase());

      for (const forbidden of FORBIDDEN_COPY) {
        expect(bodyText, `${route} should not expose ${forbidden}`).not.toContain(forbidden.toLowerCase());
      }
    });
  }
});
