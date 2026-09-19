import { expect, test } from '@playwright/test';

const FIELD_USABILITY_ROUTES = [
  { route: '/platform-v7/driver/field', role: 'driver', minPrimaryHeight: 56 },
  { route: '/platform-v7/elevator', role: 'elevator', minPrimaryHeight: 44 },
  { route: '/platform-v7/lab', role: 'lab', minPrimaryHeight: 44 },
  { route: '/platform-v7/logistics', role: 'logistics', minPrimaryHeight: 44 },
  { route: '/platform-v7/bank', role: 'bank', minPrimaryHeight: 44 },
  { route: '/platform-v7/control-tower', role: 'control-tower', minPrimaryHeight: 44 },
] as const;

const DRIVER_FORBIDDEN_COPY = [/банк/i, /инвестор/i, /ставк/i, /control tower/i, /центр управления/i, /резерв/i, /выпуск денег/i];

async function visibleActionBoxes(page: import('@playwright/test').Page) {
  return page.locator('button:visible, a:visible, [role="button"]:visible').evaluateAll((nodes) =>
    nodes
      .map((node) => {
        const rect = node.getBoundingClientRect();
        const text = (node.textContent ?? '').trim();
        return { width: rect.width, height: rect.height, text };
      })
      .filter((item) => item.text.length > 0),
  );
}

test.describe('platform-v7 field usability gate', () => {
  for (const item of FIELD_USABILITY_ROUTES) {
    test(`${item.route} is usable on 390px mobile`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      const response = await page.goto(item.route, { waitUntil: 'networkidle' });

      expect(response?.ok(), `${item.route} should return 200`).toBeTruthy();
      await expect(page.locator('body')).not.toContainText(/404|Application error|Unhandled Runtime Error/i);

      const overflowX = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      expect(overflowX, `${item.route} should not have horizontal overflow at 390px`).toBe(false);

      const bodyText = await page.locator('body').innerText();
      expect(bodyText.length, `${item.route} should have readable body content`).toBeGreaterThan(140);

      const actionBoxes = await visibleActionBoxes(page);
      expect(actionBoxes.length, `${item.route} should expose at least one visible action`).toBeGreaterThan(0);

      const tooSmallActions = actionBoxes.filter((box) => box.height > 0 && box.height < item.minPrimaryHeight && box.width >= 80);
      expect(tooSmallActions, `${item.route} should not expose undersized main actions`).toEqual([]);

      if (item.role === 'driver') {
        for (const forbidden of DRIVER_FORBIDDEN_COPY) {
          await expect(page.locator('body'), `/platform-v7/driver/field should not expose ${forbidden}`).not.toContainText(forbidden);
        }
      }
    });
  }
});
