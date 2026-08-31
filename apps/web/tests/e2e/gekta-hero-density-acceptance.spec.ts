import { expect, test, type Locator } from '@playwright/test';

async function textLineCount(locator: Locator): Promise<number> {
  return locator.evaluate((element) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        return node.textContent?.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      },
    });
    const lineTops = new Set<number>();
    let node = walker.nextNode();
    while (node) {
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const rect of Array.from(range.getClientRects())) {
        if (rect.width > 0 && rect.height > 0) lineTops.add(Math.round(rect.top * 2) / 2);
      }
      node = walker.nextNode();
    }
    return lineTops.size;
  });
}

for (const route of [
  { path: '/gekta', lang: 'ru' },
  { path: '/gekta/en', lang: 'en' },
  { path: '/gekta/zh', lang: 'zh-CN' },
] as const) {
  test(`${route.lang} keeps the approved hero and composer inside 320x700`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    const response = await page.goto(route.path, { waitUntil: 'load' });
    expect(response?.ok()).toBe(true);
    await expect(page.locator('html')).toHaveAttribute('lang', route.lang);

    const hero = page.locator('[data-gekta-server-hero="true"]');
    const h1 = hero.locator('h1');
    const lead = hero.locator('[data-gekta-hero-lead="true"]');
    const composer = page.locator('[data-gekta-composer-root="true"]');
    await expect(hero).toBeVisible();
    await expect(h1).toBeVisible();
    await expect(lead).toBeVisible();
    await expect(composer).toBeVisible();

    expect(await textLineCount(h1)).toBeLessThanOrEqual(5);
    const leadLines = await textLineCount(lead);
    expect(leadLines).toBeGreaterThanOrEqual(2);
    expect(leadLines).toBeLessThanOrEqual(4);

    const composerBox = await composer.boundingBox();
    expect(composerBox).not.toBeNull();
    if (composerBox) expect(composerBox.y + composerBox.height).toBeLessThanOrEqual(701);

    await expect(page.locator('[data-gekta-starter="true"]:visible')).toHaveCount(2);
    await expect(page.locator("[data-gekta-primary-cta='true'], [data-gekta-floating-entry]")).toHaveCount(0);
  });
}
