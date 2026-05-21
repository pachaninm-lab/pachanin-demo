import { expect, test } from '@playwright/test';

const PRIORITY_ROUTES = [
  { route: '/platform-v7', title: /исполнение|зерно|сделк|платформ/i },
  { route: '/platform-v7/seller', title: /продав/i },
  { route: '/platform-v7/buyer', title: /покуп/i },
  { route: '/platform-v7/logistics', title: /логист/i },
  { route: '/platform-v7/driver/field', title: /рейс водителя/i },
  { route: '/platform-v7/elevator', title: /элеватор|приём/i },
  { route: '/platform-v7/lab', title: /лаборатор|качество/i },
  { route: '/platform-v7/bank', title: /банк|банков/i },
  { route: '/platform-v7/control-tower', title: /центр управления/i },
  { route: '/platform-v7/disputes', title: /спор|доказатель/i },
  { route: '/platform-v7/connectors', title: /подключ|тестов|симуляц/i },
  { route: '/platform-v7/investor', title: /инвестор|traction|эконом/i },
] as const;

test.describe('platform-v7 route screen gate', () => {
  for (const item of PRIORITY_ROUTES) {
    test(`${item.route} has a clear first screen`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      const response = await page.goto(item.route, { waitUntil: 'networkidle' });

      expect(response?.ok(), `${item.route} should return 200`).toBeTruthy();

      const bodyText = await page.locator('body').innerText();
      expect(bodyText, `${item.route} should expose a recognizable screen title`).toMatch(item.title);
      expect(bodyText.length, `${item.route} should not render an empty shell`).toBeGreaterThan(120);
      await expect(page.locator('body')).not.toContainText(/404|Application error|Unhandled Runtime Error/i);
    });
  }
});
