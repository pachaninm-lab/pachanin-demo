import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, webkit, devices } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'https://xn----8sbjf4befbjgs9b.xn--p1ai';
const ARTIFACT_DIR = path.resolve(process.env.ARTIFACT_DIR || '../../artifacts/public-entry-live-smoke-2318');

const locales = {
  ru: {
    landing: 'Главный риск сделки',
    login: 'Войти в систему',
    forgot: 'Восстановить доступ',
  },
  en: {
    landing: 'The main transaction risk',
    login: 'Sign in',
    forgot: 'Restore access',
  },
  zh: {
    landing: '交易的主要风险',
    login: '登录系统',
    forgot: '恢复访问权限',
  },
};

const routeCases = [
  { key: 'landing', path: '/platform-v7' },
  { key: 'login', path: '/platform-v7/login' },
  { key: 'forgot', path: '/platform-v7/forgot-password' },
];

const matrix = [
  {
    name: 'chromium-desktop-1440',
    engine: chromium,
    context: { viewport: { width: 1440, height: 1000 } },
    overflowTolerance: 4,
  },
  {
    name: 'chromium-mobile-390',
    engine: chromium,
    context: {
      ...devices['Pixel 7'],
      viewport: { width: 390, height: 844 },
    },
    overflowTolerance: 8,
  },
  {
    name: 'webkit-iphone-13',
    engine: webkit,
    context: devices['iPhone 13'],
    overflowTolerance: 8,
  },
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function inspectPage(page, matrixCase, routeCase, locale) {
  const url = new URL(routeCase.path, BASE_URL);
  url.searchParams.set('lang', locale);

  const consoleErrors = [];
  const runtimeErrors = [];
  const onConsole = (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  };
  const onPageError = (error) => runtimeErrors.push(String(error?.stack || error));
  page.on('console', onConsole);
  page.on('pageerror', onPageError);

  const startedAt = Date.now();
  const response = await page.goto(url.toString(), { waitUntil: 'networkidle', timeout: 60_000 });
  const navigationMs = Date.now() - startedAt;

  assert(response, `${matrixCase.name} ${routeCase.path} ${locale}: no navigation response`);
  assert(response.ok(), `${matrixCase.name} ${routeCase.path} ${locale}: HTTP ${response.status()}`);

  await page.locator('body').waitFor({ state: 'visible', timeout: 20_000 });
  const bodyText = await page.locator('body').innerText();
  const expectedText = locales[locale][routeCase.key];
  assert(bodyText.includes(expectedText), `${matrixCase.name} ${routeCase.path} ${locale}: missing “${expectedText}”`);
  assert(!/Application error|Unhandled Runtime Error|Ошибка страницы|404 Not Found/i.test(bodyText), `${matrixCase.name} ${routeCase.path} ${locale}: visible runtime failure`);

  const layout = await page.evaluate(() => {
    const header = document.querySelector('.pc-site-header');
    const brokenImages = Array.from(document.querySelectorAll('img'))
      .filter((image) => image instanceof HTMLImageElement)
      .filter((image) => image.offsetParent !== null)
      .filter((image) => !image.complete || image.naturalWidth === 0 || image.naturalHeight === 0)
      .map((image) => ({ src: image.getAttribute('src'), alt: image.getAttribute('alt') }));

    return {
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      headerVisible: Boolean(header && header.getBoundingClientRect().height > 0),
      headerPosition: header ? getComputedStyle(header).position : null,
      headingCount: document.querySelectorAll('h1,h2').length,
      controlCount: document.querySelectorAll('a,button,input').length,
      brokenImages,
    };
  });

  assert(layout.headerVisible, `${matrixCase.name} ${routeCase.path} ${locale}: canonical header is not visible`);
  assert(layout.headerPosition === 'fixed', `${matrixCase.name} ${routeCase.path} ${locale}: header is not fixed`);
  assert(layout.overflow <= matrixCase.overflowTolerance, `${matrixCase.name} ${routeCase.path} ${locale}: horizontal overflow ${layout.overflow}px`);
  assert(layout.headingCount > 0, `${matrixCase.name} ${routeCase.path} ${locale}: no headings`);
  assert(layout.controlCount > 0, `${matrixCase.name} ${routeCase.path} ${locale}: no interactive controls`);
  assert(layout.brokenImages.length === 0, `${matrixCase.name} ${routeCase.path} ${locale}: broken images ${JSON.stringify(layout.brokenImages)}`);

  if (routeCase.key === 'landing') {
    const roleLinks = page.locator('.entry-role-tile');
    assert((await roleLinks.count()) === 12, `${matrixCase.name} landing ${locale}: expected 12 role cards`);
    const hrefs = await roleLinks.evaluateAll((links) => links.map((link) => link.getAttribute('href')));
    assert(hrefs.every((href) => href === '/platform-v7/login'), `${matrixCase.name} landing ${locale}: role cards bypass single entry: ${JSON.stringify(hrefs)}`);
    assert(!hrefs.some((href) => String(href).includes('?role=')), `${matrixCase.name} landing ${locale}: role query leak`);
    assert((await page.locator('.entry-hero-actions a').count()) === 2, `${matrixCase.name} landing ${locale}: hero must contain exactly two CTA links`);
    assert((await page.locator('.entry-primary-cta').count()) === 1, `${matrixCase.name} landing ${locale}: primary CTA count mismatch`);
    assert((await page.locator('.entry-secondary-cta').count()) === 1, `${matrixCase.name} landing ${locale}: secondary CTA count mismatch`);
  }

  if (routeCase.key === 'login') {
    assert((await page.locator('select').count()) === 0, `${matrixCase.name} login ${locale}: role selector is present`);
    assert((await page.locator('a[href="/platform-v7/forgot-password"]').count()) === 1, `${matrixCase.name} login ${locale}: recovery link missing`);
    assert(!page.url().includes('role='), `${matrixCase.name} login ${locale}: role query present in URL`);
  }

  if (routeCase.key === 'forgot') {
    assert((await page.locator('form').count()) === 1, `${matrixCase.name} recovery ${locale}: recovery form missing`);
    assert((await page.locator('input[type="email"]').count()) === 1, `${matrixCase.name} recovery ${locale}: work email field missing`);
  }

  const axe = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const blockingAxe = axe.violations.filter((violation) => violation.impact === 'critical' || violation.impact === 'serious');
  assert(blockingAxe.length === 0, `${matrixCase.name} ${routeCase.path} ${locale}: serious/critical axe violations ${JSON.stringify(blockingAxe.map(({ id, impact, nodes }) => ({ id, impact, nodes: nodes.length })))}`);

  await page.screenshot({
    path: path.join(ARTIFACT_DIR, `${matrixCase.name}-${routeCase.key}-${locale}.png`),
    fullPage: true,
  });

  page.off('console', onConsole);
  page.off('pageerror', onPageError);

  return {
    matrix: matrixCase.name,
    route: routeCase.path,
    locale,
    status: response.status(),
    finalUrl: page.url(),
    navigationMs,
    layout,
    axeViolations: axe.violations.map(({ id, impact, nodes }) => ({ id, impact, nodes: nodes.length })),
    consoleErrors,
    runtimeErrors,
  };
}

async function verifyLanguageControl(page) {
  await page.goto(new URL('/platform-v7?lang=ru', BASE_URL).toString(), { waitUntil: 'networkidle', timeout: 60_000 });
  const switcher = page.locator('.pc-site-locale-switch');
  await switcher.waitFor({ state: 'visible', timeout: 15_000 });
  assert((await switcher.getAttribute('data-current-locale')) === 'ru', 'language control did not start at RU');

  await Promise.all([
    page.waitForURL(/lang=en/, { timeout: 30_000 }),
    switcher.click(),
  ]);
  await page.locator('body').waitFor({ state: 'visible' });
  assert((await page.locator('body').innerText()).includes(locales.en.landing), 'language control did not switch RU → EN');

  const secondSwitcher = page.locator('.pc-site-locale-switch');
  await Promise.all([
    page.waitForURL(/lang=zh/, { timeout: 30_000 }),
    secondSwitcher.click(),
  ]);
  await page.locator('body').waitFor({ state: 'visible' });
  assert((await page.locator('body').innerText()).includes(locales.zh.landing), 'language control did not switch EN → ZH');

  return { finalUrl: page.url(), finalLocale: await page.locator('.pc-site-locale-switch').getAttribute('data-current-locale') };
}

await fs.mkdir(ARTIFACT_DIR, { recursive: true });
const report = {
  baseUrl: BASE_URL,
  generatedAt: new Date().toISOString(),
  cases: [],
  languageControl: null,
  diagnostics: {
    consoleErrorCases: [],
    runtimeErrorCases: [],
  },
};

for (const matrixCase of matrix) {
  const browser = await matrixCase.engine.launch({ headless: true });
  const context = await browser.newContext(matrixCase.context);
  const page = await context.newPage();
  try {
    for (const locale of Object.keys(locales)) {
      for (const routeCase of routeCases) {
        const result = await inspectPage(page, matrixCase, routeCase, locale);
        report.cases.push(result);
        if (result.consoleErrors.length > 0) report.diagnostics.consoleErrorCases.push({ matrix: result.matrix, route: result.route, locale: result.locale, errors: result.consoleErrors });
        if (result.runtimeErrors.length > 0) report.diagnostics.runtimeErrorCases.push({ matrix: result.matrix, route: result.route, locale: result.locale, errors: result.runtimeErrors });
        await fs.writeFile(path.join(ARTIFACT_DIR, 'browser-smoke-report.json'), JSON.stringify(report, null, 2));
      }
    }
    if (matrixCase.name === 'chromium-desktop-1440') {
      report.languageControl = await verifyLanguageControl(page);
      await fs.writeFile(path.join(ARTIFACT_DIR, 'browser-smoke-report.json'), JSON.stringify(report, null, 2));
    }
  } finally {
    await context.close();
    await browser.close();
  }
}

await fs.writeFile(path.join(ARTIFACT_DIR, 'browser-smoke-report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({
  status: 'collected',
  cases: report.cases.length,
  languageControl: report.languageControl,
  consoleErrorCases: report.diagnostics.consoleErrorCases.length,
  runtimeErrorCases: report.diagnostics.runtimeErrorCases.length,
}, null, 2));
