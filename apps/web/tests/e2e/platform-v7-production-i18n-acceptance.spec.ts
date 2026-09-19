import { expect, test, type Page, type TestInfo } from '@playwright/test';

const LIVE_BASE = process.env.PLAYWRIGHT_BASE_URL || 'https://xn----8sbjf4befbjgs9b.xn--p1ai';

const locales = [
  { code: 'en', htmlLang: 'en', label: 'EN' },
  { code: 'zh', htmlLang: 'zh-CN', label: 'ZH' },
] as const;

const viewports = [
  { width: 320, height: 700, name: '320x700' },
  { width: 375, height: 812, name: '375x812' },
  { width: 390, height: 844, name: '390x844' },
  { width: 430, height: 932, name: '430x932' },
  { width: 1440, height: 900, name: '1440x900' },
] as const;

type AcceptanceViewport = (typeof viewports)[number];

const TARGET_SIZE_EPSILON = 0.001;

const publicRoutes = [
  { path: '/platform-v7', name: 'home' },
  { path: '/platform-v7/login', name: 'login' },
  { path: '/platform-v7/register', name: 'register' },
  { path: '/platform-v7/contact', name: 'contact' },
  { path: '/platform-v7/how-it-works', name: 'how-it-works' },
  { path: '/platform-v7/demo', name: 'deal-preview' },
  { path: '/platform-v7/deal-flow', name: 'deal-flow' },
  { path: '/platform-v7/roles', name: 'roles' },
] as const;

const allowedCyrillicTokens = [
  'Процент-Агро',
  'Прозрачная Цена',
  'ФГИС',
  'СДИЗ',
  'ЭДО',
] as const;

function localizedUrl(path: string, locale: string, marker: string): string {
  const url = new URL(path, LIVE_BASE);
  url.searchParams.set('lang', locale);
  url.searchParams.set('production-i18n', marker);
  return url.toString();
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => Math.max(
    document.documentElement.scrollWidth - document.documentElement.clientWidth,
    document.body.scrollWidth - document.body.clientWidth,
  ));
  expect(overflow).toBeLessThanOrEqual(1);
}

async function residualCyrillic(page: Page): Promise<string[]> {
  return page.evaluate((allowedTokens) => {
    const cyrillic = /[А-Яа-яЁё]/u;
    const clean = (source: string) => allowedTokens.reduce(
      (value, token) => value.split(token).join(''),
      source.replace(/\s+/gu, ' ').trim(),
    );

    const samples = new Set<string>();
    const bodyText = document.body?.innerText ?? '';
    for (const fragment of bodyText.split(/\n+/u)) {
      const normalized = clean(fragment);
      if (normalized && cyrillic.test(normalized)) samples.add(`text: ${fragment.trim()}`);
    }

    const title = clean(document.title || '');
    if (title && cyrillic.test(title)) samples.add(`document.title: ${document.title}`);

    const attributeNames = ['aria-label', 'title', 'placeholder', 'alt'] as const;
    for (const element of Array.from(document.querySelectorAll<HTMLElement>('[aria-label],[title],[placeholder],[alt]'))) {
      const style = window.getComputedStyle(element);
      const box = element.getBoundingClientRect();
      const visible = style.display !== 'none' && style.visibility !== 'hidden' && box.width > 0 && box.height > 0;
      if (!visible) continue;
      for (const attribute of attributeNames) {
        const value = element.getAttribute(attribute);
        if (!value) continue;
        const normalized = clean(value);
        if (normalized && cyrillic.test(normalized)) samples.add(`${attribute}: ${value}`);
      }
    }

    return Array.from(samples).sort().slice(0, 40);
  }, [...allowedCyrillicTokens]);
}

async function expectLocalizedSurface(page: Page, htmlLang: string) {
  await expect(page.locator('html')).toHaveAttribute('lang', htmlLang);
  await expect.poll(
    () => residualCyrillic(page),
    { timeout: 15_000, intervals: [100, 250, 500, 1_000] },
  ).toEqual([]);
  await expectNoHorizontalOverflow(page);
}

async function expectChineseTypography(page: Page) {
  const root = page.locator('.pc-v7-public-entry').first();
  await expect(root).toBeVisible();
  const rootStyle = await root.evaluate((node) => {
    const style = window.getComputedStyle(node);
    return { fontFamily: style.fontFamily, letterSpacing: style.letterSpacing };
  });
  expect(rootStyle.fontFamily).toMatch(/PingFang SC|Noto Sans SC|Microsoft YaHei/u);
  expect(['0px', 'normal']).toContain(rootStyle.letterSpacing);

  const heading = page.locator('.pc-v7-public-entry h1:visible, .pc-v7-public-entry h2:visible').first();
  await expect(heading).toBeVisible();
  const headingStyle = await heading.evaluate((node) => {
    const style = window.getComputedStyle(node);
    return {
      letterSpacing: style.letterSpacing,
      lineHeight: Number.parseFloat(style.lineHeight),
      fontSize: Number.parseFloat(style.fontSize),
    };
  });
  expect(['0px', 'normal']).toContain(headingStyle.letterSpacing);
  expect(headingStyle.lineHeight).toBeGreaterThanOrEqual(headingStyle.fontSize * 1.05);
}

async function expectProductionHomepageDesignGates(
  page: Page,
  viewport: AcceptanceViewport,
  expectedBrand?: string,
) {
  const brand = page.locator("[data-testid='platform-v7-root-execution-cockpit'] .pc-site-brand-text strong");
  await expect(brand).toBeVisible();
  if (expectedBrand) {
    await expect(brand).toHaveText(expectedBrand);
  } else {
    // Localization owns the visible brand wording on EN/ZH. The design gate owns
    // geometry: the localized brand must remain non-empty, legible and unclipped.
    await expect(brand).toHaveText(/\S/u);
  }
  const brandGeometry = await brand.evaluate((node) => {
    const element = node as HTMLElement;
    const clippingHost = element.closest<HTMLElement>('.pc-site-brand') ?? element;
    const host = clippingHost.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(element);
    const lineRects = Array.from(range.getClientRects()).filter((rect) => rect.width > 0 && rect.height > 0);
    const style = window.getComputedStyle(element);
    return {
      fontSize: Number.parseFloat(style.fontSize),
      lineRectCount: lineRects.length,
      textInside: lineRects.length > 0 && lineRects.every((rect) => (
        rect.left >= host.left - 1
        && rect.right <= host.right + 1
        && rect.top >= host.top - 1
        && rect.bottom <= host.bottom + 1
      )),
      scrollFits:
        clippingHost.scrollWidth <= clippingHost.clientWidth + 1
        && clippingHost.scrollHeight <= clippingHost.clientHeight + 1,
    };
  });
  expect(brandGeometry.fontSize).toBeGreaterThanOrEqual(14);
  expect(brandGeometry.lineRectCount).toBeGreaterThanOrEqual(1);
  expect(brandGeometry.textInside).toBe(true);
  expect(brandGeometry.scrollFits).toBe(true);

  if (viewport.width <= 430) {
    for (const selector of ['.pc-site-mobile-menu > summary', '.pc-site-locale-switch', '.entry-login']) {
      const control = page.locator(selector).first();
      await expect(control).toBeVisible();
      const box = await control.boundingBox();
      expect(box, `${selector} production bounding box`).not.toBeNull();
      expect(box!.width, `${selector} production width`).toBeGreaterThanOrEqual(44 - TARGET_SIZE_EPSILON);
      expect(box!.height, `${selector} production height`).toBeGreaterThanOrEqual(44 - TARGET_SIZE_EPSILON);
    }
  }

  const card = page.locator('[data-testid="platform-v7-deal-card"]');
  await expect(card).toBeVisible();
  const tinyText = await card.evaluate((root) => {
    const offenders: Array<{ text: string; fontSize: number; tag: string }> = [];
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
          offenders.push({ text: text.slice(0, 80), fontSize, tag: element.tagName.toLowerCase() });
        }
      }
      current = walker.nextNode();
    }
    return offenders;
  });
  expect(tinyText, JSON.stringify(tinyText, null, 2)).toEqual([]);

  if (viewport.width === 320 && viewport.height === 700) {
    const heading = page.locator('#pc-v6-title');
    await expect(heading).toBeVisible();
    const lineCount = await heading.evaluate((node) => {
      // Count only rendered text fragments. A Range over the H1 parent also
      // returns geometry for nested block spans, which double-counts visual
      // lines even when the screenshot shows the copy within the <=5-line gate.
      const uniqueLineTops: number[] = [];
      const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
      let current = walker.nextNode();
      while (current) {
        if (current.textContent?.trim()) {
          const range = document.createRange();
          range.selectNodeContents(current);
          const rects = Array.from(range.getClientRects()).filter((rect) => rect.width > 0 && rect.height > 0);
          for (const rect of rects) {
            if (!uniqueLineTops.some((top) => Math.abs(top - rect.top) <= 1)) uniqueLineTops.push(rect.top);
          }
        }
        current = walker.nextNode();
      }
      return uniqueLineTops.length;
    });
    expect(lineCount, 'production 320px Hero H1 line count').toBeGreaterThanOrEqual(1);
    expect(lineCount, 'production 320px Hero H1 line count').toBeLessThanOrEqual(5);

    const primary = page.locator('.pc-v6-actions .pc-v6-primary').first();
    await expect(primary).toBeVisible();
    const primaryBox = await primary.boundingBox();
    expect(primaryBox, 'production primary Hero CTA bounding box').not.toBeNull();
    expect(primaryBox!.y, 'production primary Hero CTA top').toBeGreaterThanOrEqual(0);
    expect(primaryBox!.y + primaryBox!.height, 'production primary Hero CTA bottom').toBeLessThanOrEqual(viewport.height + 1);
  }

  await expectNoHorizontalOverflow(page);
}

async function captureEvidence(page: Page, testInfo: TestInfo, locale: string, viewport: string, route: string) {
  if (!['320x700', '390x844', '1440x900'].includes(viewport)) return;
  if (!['home', 'register'].includes(route)) return;
  await page.screenshot({
    path: testInfo.outputPath(`${testInfo.project.name}-${locale}-${viewport}-${route}.png`),
    fullPage: false,
    animations: 'disabled',
  });
}

test.describe('Platform V7 exact production i18n acceptance', () => {
  test.describe.configure({ mode: 'serial' });

  for (const locale of locales) {
    for (const viewport of viewports) {
      test(`${locale.label} ${viewport.name}: public localization, reflow and typography`, async ({ page }, testInfo) => {
        const pageErrors: string[] = [];
        page.on('pageerror', (error) => pageErrors.push(error.message));
        await page.setViewportSize({ width: viewport.width, height: viewport.height });

        for (const route of publicRoutes) {
          const marker = `${testInfo.project.name}-${locale.code}-${viewport.name}-${route.name}`;
          const response = await page.goto(localizedUrl(route.path, locale.code, marker), { waitUntil: 'load' });
          expect(response?.ok(), `${route.path} did not return a successful final response`).toBe(true);
          await expectLocalizedSurface(page, locale.htmlLang);
          if (route.name === 'home') await expectProductionHomepageDesignGates(page, viewport);
          if (locale.code === 'zh' && route.name === 'home') await expectChineseTypography(page);
          await captureEvidence(page, testInfo, locale.code, viewport.name, route.name);
        }

        expect(pageErrors).toEqual([]);
      });
    }
  }

  test('RU 320x700: exact production homepage master design gates', async ({ page }, testInfo) => {
    const viewport = viewports[0];
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.setViewportSize({ width: viewport.width, height: viewport.height });

    const response = await page.goto(
      localizedUrl('/platform-v7', 'ru', `${testInfo.project.name}-ru-${viewport.name}-home-design`),
      { waitUntil: 'load' },
    );
    expect(response?.ok()).toBe(true);
    await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
    await expectProductionHomepageDesignGates(page, viewport, 'Прозрачная Цена');
    await captureEvidence(page, testInfo, 'ru', viewport.name, 'home');
    expect(pageErrors).toEqual([]);
  });

  for (const locale of locales) {
    test(`${locale.label}: query-selected locale persists after clean reload`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: 390, height: 844 });
      const response = await page.goto(localizedUrl('/platform-v7', locale.code, `${testInfo.project.name}-${locale.code}-persist`), { waitUntil: 'load' });
      expect(response?.ok()).toBe(true);
      await expectLocalizedSurface(page, locale.htmlLang);

      const persisted = await page.context().cookies(LIVE_BASE);
      expect(persisted.some((cookie) => cookie.name === 'pc-v7-locale' && cookie.value === locale.code)).toBe(true);

      const cleanUrl = new URL('/platform-v7', LIVE_BASE);
      cleanUrl.searchParams.set('production-i18n', `${testInfo.project.name}-${locale.code}-persist-reload`);
      const reloadResponse = await page.goto(cleanUrl.toString(), { waitUntil: 'load' });
      expect(reloadResponse?.ok()).toBe(true);
      await expectLocalizedSurface(page, locale.htmlLang);
    });
  }
});
