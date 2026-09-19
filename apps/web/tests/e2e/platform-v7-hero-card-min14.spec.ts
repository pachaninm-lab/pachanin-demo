import { expect, test } from '@playwright/test';

const widths = [320, 375, 390, 430, 768, 1440] as const;

test.describe('Platform V7 Hero Deal card legibility', () => {
  for (const width of widths) {
    test(`${width}px keeps every visible Hero Deal card text node at or above 14 CSS px`, async ({ page }) => {
      await page.setViewportSize({ width, height: width < 768 ? 900 : 1000 });
      const response = await page.goto('/platform-v7?lang=ru', { waitUntil: 'load' });
      expect(response?.ok()).toBe(true);

      const card = page.locator('[data-testid="platform-v7-deal-card"]');
      await expect(card).toBeVisible();

      const offenders = await card.evaluate((root) => {
        const result: Array<{ text: string; fontSize: number; tag: string }> = [];
        const seen = new Set<Element>();
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        let current = walker.nextNode();
        while (current) {
          const text = current.textContent?.replace(/\s+/gu, ' ').trim() ?? '';
          const element = current.parentElement;
          if (text && element && !seen.has(element)) {
            seen.add(element);
            const style = window.getComputedStyle(element);
            const box = element.getBoundingClientRect();
            const visible = style.display !== 'none' && style.visibility !== 'hidden' && box.width > 0 && box.height > 0;
            const fontSize = Number.parseFloat(style.fontSize);
            if (visible && Number.isFinite(fontSize) && fontSize < 13.99) {
              result.push({ text: text.slice(0, 80), fontSize, tag: element.tagName.toLowerCase() });
            }
          }
          current = walker.nextNode();
        }
        return result;
      });

      expect(offenders, JSON.stringify(offenders, null, 2)).toEqual([]);

      const overflow = await page.evaluate(() => Math.max(
        document.documentElement.scrollWidth - document.documentElement.clientWidth,
        document.body.scrollWidth - document.body.clientWidth,
      ));
      expect(overflow).toBeLessThanOrEqual(1);
    });
  }
});
