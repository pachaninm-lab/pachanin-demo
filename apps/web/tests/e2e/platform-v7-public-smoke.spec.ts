import { expect, test } from '@playwright/test';

const BASE = process.env.PLATFORM_V7_PUBLIC_URL ?? 'https://pachanin-web.vercel.app';

const routes = ['/platform-v7', '/platform-v7/bank', '/platform-v7/driver/field', '/platform-v7/deals/grain-release'] as const;
const viewports = [
  { label: 'mobile-390', width: 390, height: 844 },
  { label: 'desktop-1440', width: 1440, height: 900 },
] as const;

test.describe('platform-v7 public smoke', () => {
  test.setTimeout(90_000);

  for (const viewport of viewports) {
    for (const route of routes) {
      test(`${route} public check ${viewport.label}`, async ({ page }, testInfo) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        const response = await page.goto(new URL(route, BASE).toString(), { waitUntil: 'networkidle', timeout: 45_000 });

        expect(response?.ok()).toBeTruthy();
        await expect(page.locator('body')).not.toContainText(/404|Application error|Unhandled Runtime Error/i);

        const bodyText = await page.locator('body').innerText({ timeout: 15_000 });
        expect(bodyText.length).toBeGreaterThan(200);
        expect(bodyText).toMatch(/Прозрачная Цена|сделк|деньг|документ|рейс|банк/i);

        const hasOverflowX = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
        expect(hasOverflowX).toBe(false);

        await testInfo.attach(`public-${route.replaceAll('/', '-')}-${viewport.label}.png`, {
          body: await page.screenshot({ fullPage: true }),
          contentType: 'image/png',
        });
      });
    }
  }
});
