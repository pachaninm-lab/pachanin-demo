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
  '/platform-v7/bank/events',
  '/platform-v7/bank/release-safety',
  '/platform-v7/control-tower',
  '/platform-v7/disputes',
  '/platform-v7/disputes/DK-2024-89',
  '/platform-v7/trust',
  '/platform-v7/reports',
  '/platform-v7/simulator',
  '/platform-v7/demo/execution-flow',
  '/platform-v7/connectors',
  '/platform-v7/investor',
] as const;

const VIEWPORTS = [
  { label: '375px', width: 375, height: 667 },
  { label: '390px', width: 390, height: 844 },
  { label: '414px', width: 414, height: 896 },
  { label: '768px', width: 768, height: 1024 },
  { label: '1440px', width: 1440, height: 900 },
] as const;

test.describe('platform-v7 responsive overflow gate', () => {
  for (const viewport of VIEWPORTS) {
    for (const route of PRIORITY_ROUTES) {
      test(`${route} has no horizontal overflow at ${viewport.label}`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        const response = await page.goto(route, { waitUntil: 'networkidle' });

        expect(response?.ok(), `${route} should return 200 at ${viewport.label}`).toBeTruthy();

        const overflowX = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
        expect(overflowX, `${route} should not have horizontal overflow at ${viewport.label}`).toBe(false);
      });
    }
  }
});
