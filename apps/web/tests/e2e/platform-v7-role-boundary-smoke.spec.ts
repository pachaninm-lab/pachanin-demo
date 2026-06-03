import { expect, test } from '@playwright/test';

const ROLE_BOUNDARY_ROUTES = [
  { route: '/platform-v7/seller', roleCopy: /продав/i, forbiddenCopy: /водитель|рейс водителя/i },
  { route: '/platform-v7/buyer', roleCopy: /покуп/i, forbiddenCopy: /рейс водителя/i },
  { route: '/platform-v7/logistics', roleCopy: /логист/i, forbiddenCopy: /банк подключён|ФГИС подключён/i },
  { route: '/platform-v7/driver/field', roleCopy: /рейс водителя|водител/i, forbiddenCopy: /инвестор|traction|экономика/i },
  { route: '/platform-v7/elevator', roleCopy: /элеватор|приём/i, forbiddenCopy: /traction|инвестор/i },
  { route: '/platform-v7/lab', roleCopy: /лаборатор|качество/i, forbiddenCopy: /traction|инвестор/i },
  { route: '/platform-v7/bank', roleCopy: /банк|банков/i, forbiddenCopy: /платформа сама выпускает деньги|банк подключён/i },
  { route: '/platform-v7/disputes', roleCopy: /спор|доказатель/i, forbiddenCopy: /production-ready|fully live/i },
] as const;

const FATAL_RENDER_COPY = /404|500|Application error|Unhandled Runtime Error|This page could not be found/i;
const FAKE_MATURITY_COPY = /production-ready|fully live|fully integrated|банк подключён|ФГИС подключён|ЭДО подключён|платформа гарантирует оплату|платформа сама выпускает деньги/i;

test.describe('platform-v7 role boundary smoke', () => {
  for (const item of ROLE_BOUNDARY_ROUTES) {
    test(`${item.route} keeps its role boundary`, async ({ page }) => {
      const response = await page.goto(item.route, { waitUntil: 'networkidle' });

      expect(response?.ok(), `${item.route} should return 2xx`).toBeTruthy();
      await expect(page.locator('body'), `${item.route} should render body content`).toBeVisible();

      const bodyText = await page.locator('body').innerText();
      expect(bodyText, `${item.route} should expose its role-specific copy`).toMatch(item.roleCopy);
      expect(bodyText, `${item.route} should not collapse into fatal route copy`).not.toMatch(FATAL_RENDER_COPY);
      expect(bodyText, `${item.route} should not expose fake maturity claims`).not.toMatch(FAKE_MATURITY_COPY);
      expect(bodyText, `${item.route} should not expose conflicting role copy`).not.toMatch(item.forbiddenCopy);
    });
  }
});
