import { expect, test, type Page } from '@playwright/test';

async function expectBrandFullyVisible(page: Page) {
  const brand = page.locator("[data-testid='platform-v7-root-execution-cockpit'] .pc-site-brand-text strong");
  await expect(brand).toBeVisible();
  await expect(brand).toHaveText('Прозрачная Цена');

  const geometry = await brand.evaluate((node) => {
    const element = node as HTMLElement;
    const host = element.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(element);
    const lineRects = Array.from(range.getClientRects())
      .filter((rect) => rect.width > 0 && rect.height > 0);
    const style = window.getComputedStyle(element);
    return {
      fontSize: Number.parseFloat(style.fontSize),
      lineRectCount: lineRects.length,
      textInside:
        lineRects.length > 0
        && lineRects.every((rect) => (
          rect.left >= host.left - 1
          && rect.right <= host.right + 1
          && rect.top >= host.top - 1
          && rect.bottom <= host.bottom + 1
        )),
      scrollFits: element.scrollWidth <= element.clientWidth + 1 && element.scrollHeight <= element.clientHeight + 1,
    };
  });

  expect(geometry.fontSize).toBeGreaterThanOrEqual(14);
  expect(geometry.lineRectCount).toBeGreaterThanOrEqual(1);
  expect(geometry.textInside).toBe(true);
  expect(geometry.scrollFits).toBe(true);
}

async function expectHeaderControls(page: Page) {
  const selectors = [
    '.pc-site-mobile-menu > summary',
    '.pc-site-locale-switch',
    '.entry-login',
  ];
  for (const selector of selectors) {
    const control = page.locator(selector).first();
    await expect(control).toBeVisible();
    const box = await control.boundingBox();
    expect(box, `${selector} bounding box`).not.toBeNull();
    expect(box!.width, `${selector} width`).toBeGreaterThanOrEqual(44);
    expect(box!.height, `${selector} height`).toBeGreaterThanOrEqual(44);
  }
}

test.describe('Platform V7 strategic homepage mobile brand visibility', () => {
  for (const width of [320, 375, 390, 430]) {
    test(`${width}px keeps the full canonical brand and header controls visible`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      const response = await page.goto('/platform-v7?lang=ru', { waitUntil: 'load' });
      expect(response?.ok()).toBe(true);

      await expectBrandFullyVisible(page);
      await expectHeaderControls(page);

      const overflow = await page.evaluate(() => Math.max(
        document.documentElement.scrollWidth - document.documentElement.clientWidth,
        document.body.scrollWidth - document.body.clientWidth,
      ));
      expect(overflow).toBeLessThanOrEqual(1);
    });
  }
});
