import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, webkit, devices } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL;
if (!BASE_URL) throw new Error('PLAYWRIGHT_BASE_URL is required');
const ARTIFACT_DIR = path.resolve(process.env.ARTIFACT_DIR || '../../artifacts/public-auth-preview-smoke-2323');

const routes = [
  { key: 'landing', path: '/platform-v7' },
  { key: 'login', path: '/platform-v7/login' },
  { key: 'forgot', path: '/platform-v7/forgot-password' },
];
const matrix = [
  { name: 'chromium-desktop-1440', engine: chromium, context: { viewport: { width: 1440, height: 1000 } }, locales: ['ru', 'en', 'zh'] },
  { name: 'chromium-mobile-390', engine: chromium, context: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } }, locales: ['ru'] },
  { name: 'webkit-iphone-13', engine: webkit, context: devices['iPhone 13'], locales: ['ru'] },
];

function check(condition, message) {
  if (!condition) throw new Error(message);
}
function isPreviewNoise(text) {
  return text.includes("Framing 'https://app.netlify.com/'") || text.includes('app.netlify.com/cdp') || text.includes('netlify-cdp') || text.includes('Netlify Drawer');
}
function isIgnoredRequest(url, errorText) {
  return url.startsWith('data:') || url.includes('/favicon.ico') || isPreviewNoise(url) || (url.includes('_rsc=') && /ERR_ABORTED|cancelled|canceled/i.test(errorText || ''));
}
function compactAxe(violations) {
  return violations.map(({ id, impact, nodes }) => ({ id, impact, nodes: nodes.length }));
}
function expectedHtmlLang(locale) {
  return locale === 'zh' ? ['zh', 'zh-CN'] : [locale];
}

async function gotoWithPreviewRetry(page, url, label) {
  let response = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    if (response?.status() !== 403) break;
    const body = await page.locator('body').innerText().catch(() => '');
    if (!/Netlify|verification|security|challenge/i.test(body)) break;
    if (attempt < 3) await page.waitForTimeout(2_000 * attempt);
  }
  check(response?.ok(), `${label}: HTTP ${response?.status() ?? 'no response'}`);
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
  return response;
}

async function runCase(browser, matrixCase, routeCase, locale) {
  const context = await browser.newContext(matrixCase.context);
  const page = await context.newPage();
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
    const label = `${matrixCase.name} ${routeCase.path} ${locale}`;
    const response = await gotoWithPreviewRetry(page, url.toString(), label);
    result.status = response?.status() ?? null;
    result.finalUrl = page.url();
    await page.locator('body').waitFor({ state: 'visible', timeout: 20_000 });
    await page.waitForTimeout(500);
    const bodyText = await page.locator('body').innerText();
    check(bodyText.trim().length > 80, `${label}: suspiciously empty body`);
    check(!/Application error|Unhandled Runtime Error|Ошибка страницы|404 Not Found/i.test(bodyText), `${label}: visible runtime failure`);
    check((await page.locator('h1').count()) === 1, `${label}: expected one h1`);

    result.layout = await page.evaluate(() => {
      const header = document.querySelector('.pc-site-header');
      const brokenImages = Array.from(document.querySelectorAll('img'))
        .filter((image) => image instanceof HTMLImageElement && image.offsetParent !== null)
        .filter((image) => !image.complete || image.naturalWidth === 0 || image.naturalHeight === 0)
        .map((image) => ({ src: image.getAttribute('src'), alt: image.getAttribute('alt') }));
      const publicInlineStyles = Array.from(document.body.querySelectorAll('style')).map((style) => style.textContent?.slice(0, 120) || '');
      return {
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: document.documentElement.clientWidth,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        headerVisible: Boolean(header && header.getBoundingClientRect().height > 0),
        headerPosition: header ? getComputedStyle(header).position : null,
        brokenImages,
        htmlLang: document.documentElement.lang,
        publicInlineStyles,
      };
    });
    check(result.layout.headerVisible, `${label}: canonical header missing`);
    check(result.layout.headerPosition === 'fixed', `${label}: header not fixed`);
    check(result.layout.overflow <= 8, `${label}: horizontal overflow ${result.layout.overflow}px`);
    check(result.layout.brokenImages.length === 0, `${label}: broken images ${JSON.stringify(result.layout.brokenImages)}`);
    check(expectedHtmlLang(locale).includes(result.layout.htmlLang), `${label}: html lang is ${result.layout.htmlLang}`);
    check(result.layout.publicInlineStyles.length === 0, `${label}: inline style nodes remain in body`);

    if (routeCase.key === 'landing') {
      check((await page.locator('.entry-hero-actions a').count()) === 2, `${label}: hero must have exactly two CTA links`);
      const roleLinks = page.locator('.entry-role-tile');
      check((await roleLinks.count()) === 12, `${label}: expected 12 role cards`);
      const hrefs = await roleLinks.evaluateAll((links) => links.map((link) => link.getAttribute('href')));
      check(hrefs.every((href) => href === '/platform-v7/login'), `${label}: role cards bypass single entry`);
      check(!hrefs.some((href) => String(href).includes('role=')), `${label}: role query leak`);
    }
    if (routeCase.key === 'login') {
      check((await page.locator('form').count()) === 1, `${label}: expected one form`);
      check((await page.locator('input[type="email"]').count()) === 1, `${label}: email field missing`);
      check((await page.locator('input[autocomplete="current-password"]').count()) === 1, `${label}: password field missing`);
      check((await page.locator('select[name*="role" i], [data-role-selector], .workspace-picker, [data-testid="role-selector"]').count()) === 0, `${label}: role selector present`);
      check((await page.locator('a[href="/platform-v7/forgot-password"]').count()) === 1, `${label}: recovery link missing`);
      check(!page.url().includes('role='), `${label}: role query present`);
    }
    if (routeCase.key === 'forgot') {
      check((await page.locator('form').count()) === 1, `${label}: recovery form missing`);
      check((await page.locator('input[type="email"]').count()) === 1, `${label}: recovery email field missing`);
    }

    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    result.axeViolations = compactAxe(axe.violations);
    const blocking = axe.violations.filter((item) => item.impact === 'critical' || item.impact === 'serious');
    check(blocking.length === 0, `${label}: axe ${JSON.stringify(compactAxe(blocking))}`);
    await page.waitForTimeout(300);
    check(consoleErrors.length === 0, `${label}: console errors ${JSON.stringify(consoleErrors)}`);
    check(runtimeErrors.length === 0, `${label}: runtime errors ${JSON.stringify(runtimeErrors)}`);
    check(failedRequests.length === 0, `${label}: failed requests ${JSON.stringify(failedRequests)}`);
    result.outcome = 'passed';
  } catch (error) {
    result.failure = error instanceof Error ? error.message : String(error);
  } finally {
    result.finalUrl = page.url();
    try {
      await page.screenshot({ path: path.join(ARTIFACT_DIR, `${matrixCase.name}-${routeCase.key}-${locale}-${result.outcome}.png`), fullPage: true });
    } catch {}
    await context.close();
  }
  return result;
}

async function verifyLanguageControl() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const result = { outcome: 'failed', sequence: [], failure: null };
  try {
    await gotoWithPreviewRetry(page, new URL('/platform-v7?lang=ru', BASE_URL).toString(), 'language control');
    for (const expected of ['ru', 'en', 'zh']) {
      const button = page.locator('.pc-site-locale-switch');
      await button.waitFor({ state: 'visible', timeout: 15_000 });
      const current = await button.getAttribute('data-current-locale');
      result.sequence.push(current);
      check(current === expected, `locale switch expected ${expected}, got ${current}`);
      if (expected !== 'zh') {
        const next = expected === 'ru' ? 'en' : 'zh';
        await Promise.all([
          page.waitForURL(new RegExp(`lang=${next}`), { timeout: 30_000 }),
          button.click(),
        ]);
        await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
      }
    }
    result.outcome = 'passed';
  } catch (error) {
    result.failure = error instanceof Error ? error.message : String(error);
  } finally {
    await context.close();
    await browser.close();
  }
  return result;
}

await fs.mkdir(ARTIFACT_DIR, { recursive: true });
const report = { baseUrl: BASE_URL, generatedAt: new Date().toISOString(), cases: [], languageControl: null, summary: null };
const reportPath = path.join(ARTIFACT_DIR, 'browser-smoke-report.json');
const persist = () => fs.writeFile(reportPath, JSON.stringify(report, null, 2));
for (const matrixCase of matrix) {
  const browser = await matrixCase.engine.launch({ headless: true });
  try {
    for (const locale of matrixCase.locales) {
      for (const routeCase of routes) {
        report.cases.push(await runCase(browser, matrixCase, routeCase, locale));
        await persist();
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  } finally {
    await browser.close();
  }
}
report.languageControl = await verifyLanguageControl();
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
