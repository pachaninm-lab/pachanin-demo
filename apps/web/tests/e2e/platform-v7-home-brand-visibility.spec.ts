import { expect, test, type Page } from '@playwright/test';

const TARGET_SIZE_EPSILON = 0.001;

async function expectBrandFullyVisible(page: Page) {
  const brandLink = page.locator("[data-testid='platform-v7-root-execution-cockpit'] .pc-site-brand");
  await expect(brandLink).toBeVisible();
  const linkBox = await brandLink.boundingBox();
  expect(linkBox, 'canonical brand link bounding box').not.toBeNull();
  expect(linkBox!.height, 'canonical brand hit area').toBeGreaterThanOrEqual(44 - TARGET_SIZE_EPSILON);

  const brandMark = brandLink.locator(".pc-site-brand-mark[data-brand-mark='transparent-price-canonical']");
  await expect(brandMark).toBeVisible();
  const markBox = await brandMark.boundingBox();
  expect(markBox, 'canonical brand mark bounding box').not.toBeNull();
  expect(markBox!.width, 'canonical brand mark width').toBeGreaterThanOrEqual(30);
  expect(markBox!.height, 'canonical brand mark height').toBeGreaterThanOrEqual(30);

  const brand = brandLink.locator('.pc-site-brand-text strong');
  await expect(brand).toBeVisible();
  await expect(brand).toHaveText('Прозрачная Цена');

  const geometry = await brand.evaluate((node) => {
    const element = node as HTMLElement;
    const clippingHost = element.closest<HTMLElement>('.pc-site-brand') ?? element;
    const host = clippingHost.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(element);
    const lineRects = Array.from(range.getClientRects()).filter((rect) => rect.width > 0 && rect.height > 0);
    return {
      lineRectCount: lineRects.length,
      textInside: lineRects.length > 0 && lineRects.every((rect) => (
        rect.left >= host.left - 1 && rect.right <= host.right + 1
        && rect.top >= host.top - 1 && rect.bottom <= host.bottom + 1
      )),
      scrollFits: clippingHost.scrollWidth <= clippingHost.clientWidth + 1
        && clippingHost.scrollHeight <= clippingHost.clientHeight + 1,
    };
  });

  expect(geometry.lineRectCount).toBeGreaterThanOrEqual(1);
  expect(geometry.textInside).toBe(true);
  expect(geometry.scrollFits).toBe(true);
}

async function expectHeaderControls(page: Page) {
  const selectors = [
    '.pc-site-mobile-menu > summary',
    '.pc-site-header > .pc-site-actions > .pc-site-locale-cluster .pc-site-locale-option[data-active="true"]',
  ];
  for (const selector of selectors) {
    const control = page.locator(selector).first();
    await expect(control).toBeVisible();
    const box = await control.boundingBox();
    expect(box, selector + ' bounding box').not.toBeNull();
    expect(box!.width, selector + ' width').toBeGreaterThanOrEqual(44 - TARGET_SIZE_EPSILON);
    expect(box!.height, selector + ' height').toBeGreaterThanOrEqual(44 - TARGET_SIZE_EPSILON);
  }
}

async function expectMobileHeroFirstViewport(page: Page) {
  const heading = page.locator('#pc-cp-home-title');
  await expect(heading).toBeVisible();
  const lineCount = await heading.evaluate((node) => {
    const range = document.createRange();
    range.selectNodeContents(node);
    const rects = Array.from(range.getClientRects()).filter((rect) => rect.width > 0 && rect.height > 0);
    const uniqueLineTops: number[] = [];
    for (const rect of rects) if (!uniqueLineTops.some((top) => Math.abs(top - rect.top) <= 1)) uniqueLineTops.push(rect.top);
    return uniqueLineTops.length;
  });
  expect(lineCount, '320px Hero H1 line count').toBeGreaterThanOrEqual(1);
  expect(lineCount, '320px Hero H1 line count').toBeLessThanOrEqual(5);

  const primary = page.locator('.pc-cp-hero-copy .pc-cp-button').first();
  await expect(primary).toBeVisible();
  await expect(primary).toHaveAttribute('href', '/platform-v7/register?lang=ru&intent=sell');
  const primaryBox = await primary.boundingBox();
  expect(primaryBox, 'primary Hero CTA bounding box').not.toBeNull();
  expect(primaryBox!.height, 'primary Hero CTA touch height').toBeGreaterThanOrEqual(44 - TARGET_SIZE_EPSILON);
  expect(primaryBox!.y, 'primary Hero CTA top').toBeGreaterThanOrEqual(0);
  expect(primaryBox!.y + primaryBox!.height, 'primary Hero CTA bottom').toBeLessThanOrEqual(701);
}

test.describe('Platform V7 strategic homepage mobile design gates', () => {
  for (const width of [320, 375, 390, 430]) {
    test(String(width) + 'px keeps the full canonical brand and header controls visible', async ({ page }) => {
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

  test('320x700 keeps H1 within five lines and the primary Hero CTA above the fold', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    const response = await page.goto('/platform-v7?lang=ru', { waitUntil: 'load' });
    expect(response?.ok()).toBe(true);
    await expectMobileHeroFirstViewport(page);
    const overflow = await page.evaluate(() => Math.max(
      document.documentElement.scrollWidth - document.documentElement.clientWidth,
      document.body.scrollWidth - document.body.clientWidth,
    ));
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
