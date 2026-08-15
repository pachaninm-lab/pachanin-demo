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

async function captureEvidence(page: Page, testInfo: TestInfo, locale: string, viewport: string, route: string) {
  if (!['390x844', '1440x900'].includes(viewport)) return;
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
          if (locale.code === 'zh' && route.name === 'home') await expectChineseTypography(page);
          await captureEvidence(page, testInfo, locale.code, viewport.name, route.name);
        }

        expect(pageErrors).toEqual([]);
      });
    }
  }

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