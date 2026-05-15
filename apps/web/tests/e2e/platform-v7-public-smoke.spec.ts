import { expect, test } from '@playwright/test';

const BASE = process.env.PLATFORM_V7_PUBLIC_URL ?? 'https://pachanin-web.vercel.app';

const routes = [
  { path: '/platform-v7', required: /Прозрачная Цена|исполн/i },
  { path: '/platform-v7/seller', required: /Продавец · партия → лот → документы → деньги/i },
  { path: '/platform-v7/buyer', required: /Покупатель · RFQ → оффер → резерв → логистика/i },
  { path: '/platform-v7/logistics', required: /Логистика · рейс → водитель → ЭТрН → приёмка/i },
  { path: '/platform-v7/driver/field', required: /Водитель · один рейс · одно действие/i },
  { path: '/platform-v7/elevator', required: /Элеватор · прибытие → вес → проба → акт/i },
  { path: '/platform-v7/lab', required: /Лаборатория · проба → показатели → протокол/i },
  { path: '/platform-v7/surveyor', required: /Сюрвейер · осмотр → фото → расхождение → заключение/i },
  { path: '/platform-v7/bank', required: /Банк · резерв → основание → подтверждение статуса/i },
  { path: '/platform-v7/executive', required: /Руководитель · деньги → стопы → SLA → решение/i },
  { path: '/platform-v7/deals/grain-release', required: /деньг|документ|блокер|следующ/i },
] as const;
const viewports = [
  { label: 'mobile-390', width: 390, height: 844 },
  { label: 'desktop-1440', width: 1440, height: 900 },
] as const;

const unsafeCopy = [
  'production-ready',
  'fully live',
  'fully integrated',
  'guaranteed payment',
  'marketplace',
  'sandbox',
  'гарантия оплаты',
  'безрисковая сделка',
  'полностью готово',
  'нет рисков',
  'нет аналогов',
  'лучшая в мире',
  'revolutionary',
  'платформа гарантирует оплату',
  'платформа сама выпускает деньги',
] as const;

test.describe('platform-v7 public smoke', () => {
  test.setTimeout(90_000);

  for (const viewport of viewports) {
    for (const route of routes) {
      test(`${route.path} public check ${viewport.label}`, async ({ page }, testInfo) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        const response = await page.goto(new URL(route.path, BASE).toString(), { waitUntil: 'networkidle', timeout: 45_000 });

        expect(response?.ok()).toBeTruthy();
        await expect(page.locator('body')).not.toContainText(/404|Application error|Unhandled Runtime Error/i);

        const bodyText = await page.locator('body').innerText({ timeout: 15_000 });
        expect(bodyText.length).toBeGreaterThan(200);
        expect(bodyText).toMatch(/Прозрачная Цена|сделк|деньг|документ|рейс|банк/i);
        expect(bodyText).toMatch(route.required);

        const normalizedText = bodyText.toLowerCase();
        for (const claim of unsafeCopy) expect(normalizedText).not.toContain(claim);

        if (!route.path.includes('/driver/field')) {
          expect(bodyText).toMatch(/роль|Активная роль|Продавец|Покупатель|Банк/i);
        }

        if (route.path.includes('/bank')) expect(bodyText).toMatch(/банк|деньг|документ|основан/i);
        if (route.path.includes('/driver/field')) expect(bodyText).toMatch(/водитель|рейс|офлайн|действие/i);
        if (route.path.includes('/grain-release')) expect(bodyText).toMatch(/деньг|документ|блокер|следующ/i);

        const hasOverflowX = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
        expect(hasOverflowX).toBe(false);

        await testInfo.attach(`public-${route.path.replaceAll('/', '-')}-${viewport.label}.png`, {
          body: await page.screenshot({ fullPage: true }),
          contentType: 'image/png',
        });
      });
    }
  }
});
