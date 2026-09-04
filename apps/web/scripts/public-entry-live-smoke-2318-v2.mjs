import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, webkit, devices } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'https://xn----8sbjf4befbjgs9b.xn--p1ai';
const ARTIFACT_DIR = path.resolve(process.env.ARTIFACT_DIR || '../../artifacts/public-entry-live-smoke-2318');

const locales = {
  ru: { landing: 'Главный риск сделки', login: 'Войти в систему', forgot: 'Восстановить доступ' },
  en: { landing: 'The main transaction risk', login: 'Sign in', forgot: 'Restore access' },
  zh: { landing: '交易的主要风险', login: '登录系统', forgot: '恢复访问权限' },
};

const routes = [
  { key: 'landing', path: '/platform-v7' },
  { key: 'login', path: '/platform-v7/login' },
  { key: 'forgot', path: '/platform-v7/forgot-password' },
];

const matrix = [
  { name: 'chromium-desktop-1440', engine: chromium, context: { viewport: { width: 1440, height: 1000 } }, overflowTolerance: 4 },
  { name: 'chromium-mobile-390', engine: chromium, context: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } }, overflowTolerance: 8 },
  { name: 'webkit-iphone-13', engine: webkit, context: devices['iPhone 13'], overflowTolerance: 8 },
];

function check(condition, message) {
  if (!condition) throw new Error(message);
}

function compactAxe(violations) {
  return violations.map(({ id, impact, nodes }) => ({ id, impact, nodes: nodes.length }));
}

async function runCase(page, matrixCase, routeCase, locale) {
  const consoleErrors = [];
  const runtimeErrors = [];
  const onConsole = (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  };
  const onPageError = (error) => runtimeErrors.push(String(error?.stack || error));
  page.on('console', onConsole);
  page.on('pageerror', onPageError);

  const result = {
    outcome: 'failed',
    matrix: matrixCase.name,
    route: routeCase.path,
    locale,
    requestedUrl: null,
    finalUrl: null,
    status: null,
    navigationMs: null,
    layout: null,
    axeViolations: [],
    consoleErrors,
    runtimeErrors,
    failure: null,
  };

  try {
    const url = new URL(routeCase.path, BASE_URL);
    url.searchParams.set('lang', locale);
    result.requestedUrl = url.toString();

    const startedAt = Date.now();
    const response = await page.goto(url.toString(), { waitUntil: 'networkidle', timeout: 60_000 });
    result.navigationMs = Date.now() - startedAt;
    result.status = response?.status() ?? null;
    result.finalUrl = page.url();

    check(response, `${matrixCase.name} ${routeCase.path} ${locale}: no navigation response`);
    check(response.ok(), `${matrixCase.name} ${routeCase.path} ${locale}: HTTP ${response.status()}`);

    await page.locator('body').waitFor({ state: 'visible', timeout: 20_000 });
    const bodyText = await page.locator('body').innerText();
    const expected = locales[locale][routeCase.key];
    check(bodyText.includes(expected), `${matrixCase.name} ${routeCase.path} ${locale}: missing “${expected}”`);
    check(!/Application error|Unhandled Runtime Error|Ошибка страницы|404 Not Found/i.test(bodyText), `${matrixCase.name} ${routeCase.path} ${locale}: visible runtime failure`);

    result.layout = await page.evaluate(() => {
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
        controlCount: document.querySelectorAll('a,button,input,select,textarea').length,
        brokenImages,
      };
    });

    check(result.layout.headerVisible, `${matrixCase.name} ${routeCase.path} ${locale}: canonical header is not visible`);
    check(result.layout.headerPosition === 'fixed', `${matrixCase.name} ${routeCase.path} ${locale}: header is not fixed`);
    check(result.layout.overflow <= matrixCase.overflowTolerance, `${matrixCase.name} ${routeCase.path} ${locale}: horizontal overflow ${result.layout.overflow}px`);
    check(result.layout.headingCount > 0, `${matrixCase.name} ${routeCase.path} ${locale}: no headings`);
    check(result.layout.controlCount > 0, `${matrixCase.name} ${routeCase.path} ${locale}: no interactive controls`);
    check(result.layout.brokenImages.length === 0, `${matrixCase.name} ${routeCase.path} ${locale}: broken images ${JSON.stringify(result.layout.brokenImages)}`);

    if (routeCase.key === 'landing') {
      const roleLinks = page.locator('.entry-role-tile');
      check((await roleLinks.count()) === 12, `${matrixCase.name} landing ${locale}: expected 12 role cards`);
      const hrefs = await roleLinks.evaluateAll((links) => links.map((link) => link.getAttribute('href')));
      check(hrefs.every((href) => href === '/platform-v7/login'), `${matrixCase.name} landing ${locale}: role cards bypass single entry ${JSON.stringify(hrefs)}`);
      check(!hrefs.some((href) => String(href).includes('?role=')), `${matrixCase.name} landing ${locale}: role query leak`);
      check((await page.locator('.entry-hero-actions a').count()) === 2, `${matrixCase.name} landing ${locale}: hero must contain exactly two CTA links`);
      check((await page.locator('.entry-primary-cta').count()) === 1, `${matrixCase.name} landing ${locale}: primary CTA count mismatch`);
      check((await page.locator('.entry-secondary-cta').count()) === 1, `${matrixCase.name} landing ${locale}: secondary CTA count mismatch`);
    }

    if (routeCase.key === 'login') {
      const roleSelector = page.locator('select[name*="role" i], [data-role-selector], .workspace-picker, [data-testid="role-selector"]');
      check((await roleSelector.count()) === 0, `${matrixCase.name} login ${locale}: public role selector is present`);
      check((await page.locator('a[href="/platform-v7/forgot-password"]').count()) === 1, `${matrixCase.name} login ${locale}: recovery link missing`);
      check(!page.url().includes('role='), `${matrixCase.name} login ${locale}: role query present in URL`);
    }

    if (routeCase.key === 'forgot') {
      check((await page.locator('form').count()) === 1, `${matrixCase.name} recovery ${locale}: recovery form missing`);
      check((await page.locator('input[type="email"]').count()) === 1, `${matrixCase.name} recovery ${locale}: work email field missing`);
    }

    const axe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    result.axeViolations = compactAxe(axe.violations);
    const blocking = axe.violations.filter((violation) => violation.impact === 'critical' || violation.impact === 'serious');
    check(blocking.length === 0, `${matrixCase.name} ${routeCase.path} ${locale}: serious/critical axe violations ${JSON.stringify(compactAxe(blocking))}`);

    result.outcome = 'passed';
  } catch (error) {
    result.failure = error instanceof Error ? error.message : String(error);
  } finally {
    result.finalUrl = page.url();
    try {
      await page.screenshot({
        path: path.join(ARTIFACT_DIR, `${matrixCase.name}-${routeCase.key}-${locale}-${result.outcome}.png`),
        fullPage: true,
      });
    } catch (error) {
      result.screenshotError = error instanceof Error ? error.message : String(error);
    }
    page.off('console', onConsole);
    page.off('pageerror', onPageError);
  }

  return result;
}

async function verifyLanguageControl(page) {
  const result = { outcome: 'failed', finalUrl: null, finalLocale: null, failure: null };
  try {
    await page.goto(new URL('/platform-v7?lang=ru', BASE_URL).toString(), { waitUntil: 'networkidle', timeout: 60_000 });
    let switcher = page.locator('.pc-site-locale-switch');
    await switcher.waitFor({ state: 'visible', timeout: 15_000 });
    check((await switcher.getAttribute('data-current-locale')) === 'ru', 'language control did not start at RU');

    await Promise.all([page.waitForURL(/lang=en/, { timeout: 30_000 }), switcher.click()]);
    check((await page.locator('body').innerText()).includes(locales.en.landing), 'language control did not switch RU → EN');

    switcher = page.locator('.pc-site-locale-switch');
    await Promise.all([page.waitForURL(/lang=zh/, { timeout: 30_000 }), switcher.click()]);
    check((await page.locator('body').innerText()).includes(locales.zh.landing), 'language control did not switch EN → ZH');

    result.outcome = 'passed';
    result.finalUrl = page.url();
    result.finalLocale = await page.locator('.pc-site-locale-switch').getAttribute('data-current-locale');
  } catch (error) {
    result.failure = error instanceof Error ? error.message : String(error);
    result.finalUrl = page.url();
  }
  return result;
}

await fs.mkdir(ARTIFACT_DIR, { recursive: true });
const reportPath = path.join(ARTIFACT_DIR, 'browser-smoke-report.json');
const report = {
  baseUrl: BASE_URL,
  generatedAt: new Date().toISOString(),
  cases: [],
  languageControl: null,
  summary: null,
};

async function persist() {
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
}

for (const matrixCase of matrix) {
  const browser = await matrixCase.engine.launch({ headless: true });
  const context = await browser.newContext(matrixCase.context);
  const page = await context.newPage();
  try {
    for (const locale of Object.keys(locales)) {
      for (const routeCase of routes) {
        report.cases.push(await runCase(page, matrixCase, routeCase, locale));
        await persist();
      }
    }
    if (matrixCase.name === 'chromium-desktop-1440') {
      report.languageControl = await verifyLanguageControl(page);
      await persist();
    }
  } finally {
    await context.close();
    await browser.close();
  }
}

report.summary = {
  totalCases: report.cases.length,
  functionalFailures: report.cases.filter((item) => item.outcome !== 'passed').length,
  consoleErrorCases: report.cases.filter((item) => item.consoleErrors.length > 0).length,
  runtimeErrorCases: report.cases.filter((item) => item.runtimeErrors.length > 0).length,
  seriousOrCriticalAxeCases: report.cases.filter((item) => item.axeViolations.some((violation) => violation.impact === 'serious' || violation.impact === 'critical')).length,
  languageControlPassed: report.languageControl?.outcome === 'passed',
};
await persist();
console.log(JSON.stringify(report.summary, null, 2));

if (report.summary.functionalFailures > 0 || !report.summary.languageControlPassed) process.exitCode = 1;
