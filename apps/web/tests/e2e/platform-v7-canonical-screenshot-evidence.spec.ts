import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const EVIDENCE = join(process.cwd(), 'artifacts', 'canonical-visual');

const CANONICAL = [
  { name: '01-home-desktop', route: '/platform-v7?lang=ru', width: 1055, height: 1491 },
  { name: '02-home-mobile', route: '/platform-v7?lang=ru', width: 432, height: 768 },
  { name: '03-market-desktop', route: '/platform-v7/market?lang=ru', width: 1448, height: 1086 },
  { name: '06-market-mobile', route: '/platform-v7/market?lang=ru', width: 430, height: 932 },
  { name: '05-deal-desktop', route: '/platform-v7/deal-flow?lang=ru', width: 1448, height: 1086 },
  { name: '06-deal-mobile', route: '/platform-v7/deal-flow?lang=ru', width: 430, height: 932 },
  { name: '07-how-it-works-desktop', route: '/platform-v7/how-it-works?lang=ru', width: 1448, height: 1086 },
  { name: '08-trust-desktop', route: '/platform-v7/trust?lang=ru', width: 1448, height: 1086 },
  { name: '09-gekta-desktop', route: '/platform-v7/ai-in-action?lang=ru', width: 1672, height: 941 },
] as const;

const REQUIRED_WIDTHS = [320, 375, 390, 768, 1280, 1440] as const;

test.describe('canonical public visual evidence', () => {
  test.beforeAll(() => mkdirSync(EVIDENCE, { recursive: true }));

  for (const item of CANONICAL) {
    test(`${item.name} evidence`, async ({ page }) => {
      await page.setViewportSize({ width: item.width, height: item.height });
      const response = await page.goto(item.route, { waitUntil: 'domcontentloaded' });
      expect(response?.ok(), `${item.route} should return 200`).toBeTruthy();
      await expect(page.locator('body')).not.toContainText(/Unhandled Runtime Error|Application error/i);
      await page.waitForTimeout(400);

      const geometry = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        bodyWidth: document.body.scrollWidth,
      }));
      expect(Math.max(geometry.scrollWidth, geometry.bodyWidth), item.name).toBeLessThanOrEqual(geometry.clientWidth + 1);

      await page.screenshot({
        path: join(EVIDENCE, `${item.name}.png`),
        fullPage: false,
        animations: 'disabled',
      });
    });
  }

  for (const width of REQUIRED_WIDTHS) {
    test(`responsive contract ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: width <= 390 ? 844 : width <= 768 ? 1024 : 900 });
      for (const route of ['/platform-v7?lang=ru', '/platform-v7/market?lang=ru', '/platform-v7/how-it-works?lang=ru', '/platform-v7/trust?lang=ru']) {
        const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
        expect(response?.ok(), `${route} should return 200 at ${width}`).toBeTruthy();
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, `${route} horizontal overflow at ${width}`).toBeLessThanOrEqual(1);
      }

      if (width <= 390) {
        const undersized = await page.locator('a,button,input,select,summary,[role="button"]').evaluateAll((nodes) =>
          nodes.filter((node) => {
            const el = node as HTMLElement;
            const style = getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden') return false;
            const rect = el.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) return false;
            if (el.matches('input[type="hidden"]')) return false;
            return rect.width < 44 || rect.height < 44;
          }).slice(0, 25).map((node) => {
            const el = node as HTMLElement;
            const rect = el.getBoundingClientRect();
            return { tag: el.tagName, text: (el.textContent || '').trim().slice(0, 40), width: rect.width, height: rect.height };
          })
        );
        expect(undersized, `touch targets below 44px at ${width}: ${JSON.stringify(undersized)}`).toEqual([]);
      }
    });
  }

  for (const locale of ['ru', 'en', 'zh'] as const) {
    test(`locale layout ${locale}`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      for (const route of ['/platform-v7', '/platform-v7/market', '/platform-v7/how-it-works', '/platform-v7/trust', '/platform-v7/ai-in-action', '/platform-v7/register', '/platform-v7/login', '/platform-v7/about', '/platform-v7/contact']) {
        const response = await page.goto(`${route}?lang=${locale}`, { waitUntil: 'domcontentloaded' });
        expect(response?.ok(), `${route} ${locale}`).toBeTruthy();
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, `${route} ${locale} overflow`).toBeLessThanOrEqual(1);
      }
    });
  }
});
