import { expect, test } from '@playwright/test';

const LIVE_SMOKE_ROUTES = [
  { route: '/platform-v7', expected: /зерн|сделк|исполн|платформ/i },
  { route: '/platform-v7/control-tower', expected: /центр управления|очередь|деньги/i },
  { route: '/platform-v7/bank', expected: /банк|резерв|удерж|выпуск/i },
  { route: '/platform-v7/driver/field', expected: /рейс водителя|водител|рейс/i },
  { route: '/platform-v7/disputes', expected: /спор|доказатель|удерж/i },
  { route: '/platform-v7/seller', expected: /продав|лот|предлож/i },
  { route: '/platform-v7/buyer', expected: /покуп|ставк|резерв/i },
  { route: '/platform-v7/logistics', expected: /логист|рейс|маршрут/i },
  { route: '/platform-v7/elevator', expected: /элеватор|вес|пломб|приём/i },
  { route: '/platform-v7/lab', expected: /лаборатор|качество|протокол/i },
  { route: '/platform-v7/connectors', expected: /подключ|тестов|внешн/i },
  { route: '/platform-v7/investor', expected: /инвестор|эконом|риски|traction/i },
] as const;

const FORBIDDEN_LIVE_SMOKE_COPY = [
  'production-ready',
  'fully live',
  'fully integrated',
  'complete product',
  'всё готово',
  'нет рисков',
  'нет аналогов',
  'платформа гарантирует оплату',
  'платформа сама выпускает деньги',
  'лучшая в мире',
] as const;

test.describe('platform-v7 live smoke gate', () => {
  for (const item of LIVE_SMOKE_ROUTES) {
    test(`${item.route} has safe first-screen live smoke`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      const response = await page.goto(item.route, { waitUntil: 'networkidle' });

      expect(response?.ok(), `${item.route} should return 200`).toBeTruthy();

      const bodyText = await page.locator('body').innerText();
      const normalized = bodyText.toLowerCase();

      expect(bodyText.length, `${item.route} should not render an empty shell`).toBeGreaterThan(120);
      expect(bodyText, `${item.route} should expose recognizable first-screen content`).toMatch(item.expected);
      await expect(page.locator('body')).not.toContainText(/404|Application error|Unhandled Runtime Error/i);

      const overflowX = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      expect(overflowX, `${item.route} should not have horizontal overflow at 390px`).toBe(false);

      for (const forbidden of FORBIDDEN_LIVE_SMOKE_COPY) {
        expect(normalized, `${item.route} should not expose ${forbidden}`).not.toContain(forbidden.toLowerCase());
      }
    });
  }
});
