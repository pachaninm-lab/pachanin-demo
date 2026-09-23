import { expect, test } from '@playwright/test';

test.describe('UX-29 legal language and reflow', () => {
  for (const route of ['terms', 'privacy'] as const) {
    for (const locale of ['ru', 'en', 'zh'] as const) {
      test(`${route} marks Russian source and remains readable: ${locale}`, async ({ page }) => {
        for (const width of [390, 320] as const) {
          await page.setViewportSize({ width, height: 844 });
          const response = await page.goto(`/platform-v7/${route}?lang=${locale}`, { waitUntil: 'networkidle' });
          expect(response?.status()).toBe(200);
          const original = page.locator('[data-public-legal-original="ru"]');
          await expect(original).toBeVisible();
          await expect(original).toHaveAttribute('lang', 'ru');
          expect(await original.evaluate((node) => getComputedStyle(node).hyphens)).toBe('auto');
          expect(await original.evaluate((node) => getComputedStyle(node).overflowWrap)).not.toBe('anywhere');
          const firstBody = original.locator(':scope > div > section').first().locator('div').last();
          expect(await firstBody.evaluate((node) => parseFloat(getComputedStyle(node).fontSize))).toBeGreaterThanOrEqual(16);
          const notice = original.getByRole('note');
          if (locale === 'ru') await expect(notice).toHaveCount(0);
          else {
            await expect(notice).toBeVisible();
            await expect(notice).toHaveAttribute('lang', locale);
            await expect(notice).toContainText(locale === 'zh' ? '俄语原文' : 'Russian');
          }

          if (route === 'privacy') {
            const panel = original.getByRole('tablist', { name: 'Разделы о персональных данных' });
            for (const tab of await panel.getByRole('tab').all()) {
              expect(await tab.evaluate((node) => parseFloat(getComputedStyle(node).fontSize))).toBeGreaterThanOrEqual(14);
            }
            const portalBody = original.getByRole('tabpanel').locator('p');
            for (const paragraph of await portalBody.all()) {
              expect(await paragraph.evaluate((node) => parseFloat(getComputedStyle(node).fontSize))).toBeGreaterThanOrEqual(16);
            }
          }

          if (width === 320) {
            await original.evaluate((container) => {
              const leaves = [...container.querySelectorAll<HTMLElement>('div,p,span,a,button,strong')]
                .filter((node) => node.childElementCount === 0 && getComputedStyle(node).display !== 'none');
              const sizes = leaves.map((node) => [node, parseFloat(getComputedStyle(node).fontSize)] as const);
              for (const [node, size] of sizes) node.style.fontSize = `${size * 2}px`;
            });
          }
          const geometry = await page.evaluate(() => {
            const container = document.querySelector<HTMLElement>('[data-public-legal-original="ru"]')!;
            const rect = container.getBoundingClientRect();
            const text = [...container.querySelectorAll<HTMLElement>('div,p,span,a,button,strong')]
              .filter((node) => node.childElementCount === 0 && getComputedStyle(node).display !== 'none')
              .map((node) => ({ left: node.getBoundingClientRect().left,
                right: node.getBoundingClientRect().right,
                display: getComputedStyle(node).display,
                scroll: node.scrollWidth - node.clientWidth }));
            return { documentOverflow: Math.max(document.documentElement.scrollWidth - innerWidth,
              document.body.scrollWidth - innerWidth), left: rect.left, right: rect.right, text };
          });
          expect(geometry.documentOverflow, `${route} ${locale} ${width}: document overflow`).toBeLessThanOrEqual(1);
          expect(geometry.left).toBeGreaterThanOrEqual(-1);
          expect(geometry.right).toBeLessThanOrEqual(width + 1);
          for (const item of geometry.text) {
            expect(item.left).toBeGreaterThanOrEqual(-1);
            expect(item.right).toBeLessThanOrEqual(width + 1);
            // Firefox reports scrollWidth for inline text while clientWidth is
            // always zero. Its inline box rect and the containing block bounds
            // remain checked; scroll metrics apply to boxes with layout width.
            if (item.display !== 'inline' && item.display !== 'contents') {
              expect(item.scroll).toBeLessThanOrEqual(1);
            }
          }
        }
      });
    }
  }
});
