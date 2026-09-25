import { expect, test } from '@playwright/test';

const widths = [320, 375, 390, 430, 768, 1440] as const;

test.describe('Platform V7 canonical Hero decision legibility', () => {
  for (const width of widths) {
    test(String(width) + 'px keeps canonical Hero decision text readable and touch targets safe', async ({ page }) => {
      await page.setViewportSize({ width, height: width < 768 ? 900 : 1000 });
      const response = await page.goto('/platform-v7?lang=ru', { waitUntil: 'load' });
      expect(response?.ok()).toBe(true);

      const heading = page.locator('#pc-cp-home-title');
      await expect(heading).toBeVisible();
      const headingSize = await heading.evaluate((node) => Number.parseFloat(getComputedStyle(node).fontSize));
      expect(headingSize).toBeGreaterThanOrEqual(28);

      const actions = page.locator('.pc-cp-hero-copy .pc-cp-actions .pc-cp-button');
      await expect(actions).toHaveCount(2);
      const actionGeometry = await actions.evaluateAll((nodes) => nodes.map((node) => {
        const box = node.getBoundingClientRect();
        return { width: box.width, height: box.height };
      }));
      expect(actionGeometry.every((item) => item.width >= 44 && item.height >= 44)).toBe(true);

      const overflow = await page.evaluate(() => Math.max(
        document.documentElement.scrollWidth - document.documentElement.clientWidth,
        document.body.scrollWidth - document.body.clientWidth,
      ));
      expect(overflow).toBeLessThanOrEqual(1);
    });
  }
});
