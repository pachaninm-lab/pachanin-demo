import { expect, test } from '@playwright/test';

const routes = [
  '/platform-v7/lots',
  '/platform-v7/buyer',
  '/platform-v7/seller',
  '/platform-v7/logistics/requests',
  '/platform-v7/logistics/trips',
  '/platform-v7/driver',
  '/platform-v7/elevator',
  '/platform-v7/lab',
];

async function collectRuntimeNoise(page: import('@playwright/test').Page) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });

  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  return { consoleErrors, pageErrors };
}

test.describe('platform-v7 runtime and accessibility smoke gates', () => {
  for (const route of routes) {
    test(`${route} renders with no console errors and keyboard-reachable focus`, async ({ page }) => {
      const runtime = await collectRuntimeNoise(page);
      await page.setViewportSize({ width: 390, height: 844 });

      const response = await page.goto(route, { waitUntil: 'networkidle' });
      expect(response?.ok(), `${route} should return ok response`).toBeTruthy();
      await expect(page.locator('body')).toBeVisible();

      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');

      const focused = await page.evaluate(() => {
        const active = document.activeElement as HTMLElement | null;
        if (!active || active === document.body || active === document.documentElement) return null;
        const rect = active.getBoundingClientRect();
        const style = window.getComputedStyle(active);
        return {
          tag: active.tagName,
          text: (active.textContent ?? '').trim().slice(0, 80),
          width: rect.width,
          height: rect.height,
          outlineStyle: style.outlineStyle,
          outlineWidth: style.outlineWidth,
          boxShadow: style.boxShadow,
        };
      });

      expect(focused, `${route} should expose a keyboard focus target`).not.toBeNull();
      if (focused) {
        expect(focused.width, `${route} focused element should have visible width`).toBeGreaterThan(0);
        expect(focused.height, `${route} focused element should have visible height`).toBeGreaterThan(0);
      }

      expect(runtime.consoleErrors, `${route} should not emit console errors`).toEqual([]);
      expect(runtime.pageErrors, `${route} should not emit page runtime errors`).toEqual([]);
    });
  }

  for (const colorScheme of ['light', 'dark'] as const) {
    for (const route of routes) {
      test(`${route} remains readable in ${colorScheme} mode`, async ({ page }) => {
        await page.emulateMedia({ colorScheme });
        await page.setViewportSize({ width: 430, height: 844 });

        const response = await page.goto(route, { waitUntil: 'networkidle' });
        expect(response?.ok(), `${route} should return ok response`).toBeTruthy();
        await expect(page.locator('body')).toBeVisible();

        const contrastProbe = await page.evaluate(() => {
          const body = window.getComputedStyle(document.body);
          const documentElement = document.documentElement;
          return {
            color: body.color,
            backgroundColor: body.backgroundColor,
            overflow: documentElement.scrollWidth - window.innerWidth,
            textLength: document.body.innerText.trim().length,
          };
        });

        expect(contrastProbe.textLength, `${route} should render content in ${colorScheme} mode`).toBeGreaterThan(80);
        expect(contrastProbe.color, `${route} text color should be defined in ${colorScheme} mode`).not.toBe('rgba(0, 0, 0, 0)');
        expect(contrastProbe.backgroundColor, `${route} background should be defined in ${colorScheme} mode`).not.toBe('rgba(0, 0, 0, 0)');
        expect(contrastProbe.overflow, `${route} should not overflow horizontally in ${colorScheme} mode`).toBeLessThanOrEqual(1);
      });
    }
  }
});
