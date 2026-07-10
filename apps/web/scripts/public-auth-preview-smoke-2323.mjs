import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, webkit, devices } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL;
if (!BASE_URL) throw new Error('PLAYWRIGHT_BASE_URL is required');
const ARTIFACT_DIR = path.resolve(process.env.ARTIFACT_DIR || '../../artifacts/public-auth-preview-smoke-2323');

const locales = ['ru', 'en', 'zh'];
const routes = [
  { key: 'landing', path: '/platform-v7' },
  { key: 'login', path: '/platform-v7/login' },
  { key: 'forgot', path: '/platform-v7/forgot-password' },
];
const matrix = [
  { name: 'chromium-desktop-1440', engine: chromium, context: { viewport: { width: 1440, height: 1000 } } },
  { name: 'chromium-mobile-390', engine: chromium, context: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } },
  { name: 'webkit-iphone-13', engine: webkit, context: devices['iPhone 13'] },
];

function check(condition, message) {
  if (!condition) throw new Error(message);
}
function isPreviewNoise(text) {
  return text.includes("Framing 'https://app.netlify.com/'") || text.includes('app.netlify.com/cdp') || text.includes('netlify-cdp');
}
function isIgnoredRequest(url, errorText) {
  return url.startsWith('data:') || url.includes('/favicon.ico') || isPreviewNoise(url) || (url.includes('_rsc=') && /ERR_ABORTED|cancelled|canceled/i.test(errorText || ''));
}
function compactAxe(violations) {
  return violations.map(({ id, impact, nodes }) => ({ id, impact, nodes: nodes.length }));
}

async function runCase(page, matrixCase, routeCase, locale) {
  const consoleErrors = [];
  const runtimeErrors = [];
  const failedRequests = [];
  const onConsole = (message) => {
    const text = message.text();
    if (message.type() === 'error' && !isPreviewNoise(text)) consoleErrors.push(text);
  };
  const onPageError = (error) => runtimeErrors.push(String(error?.stack || error));
  const onRequestFailed = (request) => {
    const failure = request.failure();
    const url = request.url();
    const errorText = failure?.errorText || 'unknown';
    if (!isIgnoredRequest(url, errorText)) failedRequests.push({ url, error: errorText });
  };
  page.on('console', onConsole);
  page.on('pageerror', onPageError);
  page.on('requestfailed', onRequestFailed);

  const result = { outcome: 'failed', matrix: matrixCase.name, route: routeCase.path, locale, status: null, finalUrl: null, layout: null, axeViolations: [], consoleErrors, runtimeErrors, failedRequests, failure: null };
  try {
    const url = new URL(routeCase.path, BASE_URL);
    url.searchParams.set('lang', locale);
    const response = await page.goto(url.toString(), { waitUntil: 'networkidle', timeout: 60_000 });
    result.status = response?.status() ?? null;
    result.finalUrl = page.url();
    check(response?.ok(), `${matrixCase.name} ${routeCase.path} ${locale}: HTTP ${result.status}`);
    await page.locator('body').waitFor({ state: 'visible', timeout: 20_000 });
    const bodyText = await page.locator('body').innerText();
    check(bodyText.trim().length > 80, `${matrixCase.name} ${routeCase.path} ${locale}: suspiciously empty body`);
    check(!/Application error|Unhandled Runtime Error|Ошибка страницы|404 Not Found/i.test(bodyText), `${matrixCase.name} ${routeCase.path} ${locale}: visible runtime failure`);
    check((await page.locator('h1').count()) === 1, `${matrixCase.name} ${routeCase.path} ${locale}: expected one h1`);

    result.layout = await page.evaluate(() => {
      const header = document.querySelector('.pc-site-header');
      const brokenImages = Array.from(document.querySelectorAll('img'))
        .filter((image) => image instanceof HTMLImageElement && image.offsetParent !== null)
        .filter((image) => !image.complete || image.naturalWidth === 0 || image.naturalHeight === 0)
        .map((image) => ({ src: image.getAttribute('src'), alt: image.getAttribute('alt') }));
      return {
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: document.documentElement.clientWidth,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        headerVisible: Boolean(header && header.getBoundingClientRect().height > 0),
        headerPosition: header ? getComputedStyle(header).position : null,
        brokenImages,
        htmlLang: document.documentElement.lang,
      };
    });
    check(result.layout.headerVisible, `${matrixCase.name} ${routeCase.path} ${locale}: canonical header missing`);
    check(result.layout.headerPosition === 'fixed', `${matrixCase.name} ${routeCase.path} ${locale}: header not fixed`);
    check(result.layout.overflow <= 8, `${matrixCase.name} ${routeCase.path} ${locale}: horizontal overflow ${result.layout.overflow}px`);
    check(result.layout.brokenImages.length === 0, `${matrixCase.name} ${routeCase.path} ${locale}: broken images ${JSON.stringify(result.layout.brokenImages)}`);
    check(result.layout.htmlLang === locale, `${matrixCase.name} ${routeCase.path} ${locale}: html lang is ${result.layout.htmlLang}`);

    if (routeCase.key === 'landing') {
      check((await page.locator('.entry-hero-actions a').count()) === 2, `${matrixCase.name} landing ${locale}: hero must have exactly two CTA links`);
      const roleLinks = page.locator('.entry-role-tile');
      check((await roleLinks.count()) === 12, `${matrixCase.name} landing ${locale}: expected 12 role cards`);
      const hrefs = await roleLinks.evaluateAll((links) => links.map((link) => link.getAttribute('href')));
      check(hrefs.every((href) => href === '/platform-v7/login'), `${matrixCase.name} landing ${locale}: role cards bypass single entry`);
      check(!hrefs.some((href) => String(href).includes('role=')), `${matrixCase.name} landing ${locale}: role query leak`);
    }
    if (routeCase.key === 'login') {
      check((await page.locator('form').count()) === 1, `${matrixCase.name} login ${locale}: expected one form`);
      check((await page.locator('input[type="email"]').count()) === 1, `${matrixCase.name} login ${locale}: email field missing`);
      check((await page.locator('input[autocomplete="current-password"]').count()) === 1, `${matrixCase.name} login ${locale}: password field missing`);
      check((await page.locator('select[name*="role" i], [data-role-selector], .workspace-picker, [data-testid="role-selector"]').count()) === 0, `${matrixCase.name} login ${locale}: role selector present`);
      check((await page.locator('a[href="/platform-v7/forgot-password"]').count()) === 1, `${matrixCase.name} login ${locale}: recovery link missing`);
      check(!page.url().includes('role='), `${matrixCase.name} login ${locale}: role query present`);
    }
    if (routeCase.key === 'forgot') {
      check((await page.locator('form').count()) === 1, `${matrixCase.name} recovery ${locale}: form missing`);
      check((await page.locator('input[type="email"]').count()) === 1, `${matrixCase.name} recovery ${locale}: email field missing`);
    }

    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    result.axeViolations = compactAxe(axe.violations);
    const blocking = axe.violations.filter((item) => item.impact === 'critical' || item.impact === 'serious');
    check(blocking.length === 0, `${matrixCase.name} ${routeCase.path} ${locale}: axe ${JSON.stringify(compactAxe(blocking))}`);
    await page.waitForTimeout(300);
    check(consoleErrors.length === 0, `${matrixCase.name} ${routeCase.path} ${locale}: console errors ${JSON.stringify(consoleErrors)}`);
    check(runtimeErrors.length === 0, `${matrixCase.name} ${routeCase.path} ${locale}: runtime errors ${JSON.stringify(runtimeErrors)}`);
    check(failedRequests.length === 0, `${matrixCase.name} ${routeCase.path} ${locale}: failed requests ${JSON.stringify(failedRequests)}`);
    result.outcome = 'passed';
  } catch (error) {
    result.failure = error instanceof Error ? error.message : String(error);
  } finally {
    result.finalUrl = page.url();
    try {
      await page.screenshot({ path: path.join(ARTIFACT_DIR, `${matrixCase.name}-${routeCase.key}-${locale}-${result.outcome}.png`), fullPage: true });
    } catch {}
    page.off('console', onConsole);
    page.off('pageerror', onPageError);
    page.off('requestfailed', onRequestFailed);
  }
  return result;
}

async function verifyLanguageControl(page) {
  const result = { outcome: 'failed', sequence: [], failure: null };
  try {
    await page.goto(new URL('/platform-v7?lang=ru', BASE_URL).toString(), { waitUntil: 'networkidle', timeout: 60_000 });
    for (const expected of ['ru', 'en', 'zh']) {
      const button = page.locator('.pc-site-locale-switch');
      await button.waitFor({ state: 'visible', timeout: 15_000 });
      const current = await button.getAttribute('data-current-locale');
      result.sequence.push(current);
      check(current === expected, `locale switch expected ${expected}, got ${current}`);
      if (expected !== 'zh') await Promise.all([page.waitForURL(new RegExp(`lang=${expected === 'ru' ? 'en' : 'zh'}`), { timeout: 30_000 }), button.click()]);
    }
    result.outcome = 'passed';
  } catch (error) {
    result.failure = error instanceof Error ? error.message : String(error);
  }
  return result;
}

await fs.mkdir(ARTIFACT_DIR, { recursive: true });
const report = { baseUrl: BASE_URL, generatedAt: new Date().toISOString(), cases: [], languageControl: null, summary: null };
const reportPath = path.join(ARTIFACT_DIR, 'browser-smoke-report.json');
const persist = () => fs.writeFile(reportPath, JSON.stringify(report, null, 2));
for (const matrixCase of matrix) {
  const browser = await matrixCase.engine.launch({ headless: true });
  const context = await browser.newContext(matrixCase.context);
  const page = await context.newPage();
  try {
    for (const locale of locales) for (const routeCase of routes) {
      report.cases.push(await runCase(page, matrixCase, routeCase, locale));
      await persist();
    }
    if (matrixCase.name === 'chromium-desktop-1440') report.languageControl = await verifyLanguageControl(page);
  } finally {
    await context.close();
    await browser.close();
  }
}
report.summary = {
  totalCases: report.cases.length,
  failures: report.cases.filter((item) => item.outcome !== 'passed').length,
  consoleErrorCases: report.cases.filter((item) => item.consoleErrors.length > 0).length,
  runtimeErrorCases: report.cases.filter((item) => item.runtimeErrors.length > 0).length,
  failedRequestCases: report.cases.filter((item) => item.failedRequests.length > 0).length,
  seriousOrCriticalAxeCases: report.cases.filter((item) => item.axeViolations.some((violation) => violation.impact === 'serious' || violation.impact === 'critical')).length,
  languageControlPassed: report.languageControl?.outcome === 'passed',
};
await persist();
console.log(JSON.stringify(report.summary, null, 2));
if (report.summary.failures || report.summary.consoleErrorCases || report.summary.runtimeErrorCases || report.summary.failedRequestCases || !report.summary.languageControlPassed) process.exitCode = 1;
