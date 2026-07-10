import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, webkit, devices } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL;
if (!BASE_URL) throw new Error('PLAYWRIGHT_BASE_URL is required');
const ARTIFACT_DIR = path.resolve(process.env.ARTIFACT_DIR || '../../artifacts/public-entry-preview-smoke-2328');

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
  { name: 'chromium-desktop', engine: chromium, context: { viewport: { width: 1440, height: 1000 } } },
  { name: 'chromium-mobile', engine: chromium, context: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } },
  { name: 'webkit-iphone-13', engine: webkit, context: devices['iPhone 13'] },
];

function isPreviewNoise(text) {
  return text.includes("Framing 'https://app.netlify.com/'") || text.includes('app.netlify.com/cdp') || text.includes('netlify-cdp');
}
function isCancelledRsc(url, error) {
  return url.includes('_rsc=') && /ERR_ABORTED|cancelled|canceled/i.test(error || '');
}
function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function runCase(page, device, route, locale) {
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
    const error = failure?.errorText || 'unknown';
    if (!url.startsWith('data:') && !url.includes('/favicon.ico') && !isCancelledRsc(url, error)) failedRequests.push({ url, error });
  };
  page.on('console', onConsole);
  page.on('pageerror', onPageError);
  page.on('requestfailed', onRequestFailed);

  const result = { device: device.name, route: route.path, locale, outcome: 'failed', consoleErrors, runtimeErrors, failedRequests, failure: null, axe: [] };
  try {
    const url = new URL(route.path, BASE_URL);
    url.searchParams.set('lang', locale);
    const response = await page.goto(url.toString(), { waitUntil: 'networkidle', timeout: 60_000 });
    assert(response?.ok(), `${route.path} ${locale}: HTTP ${response?.status()}`);
    const bodyText = await page.locator('body').innerText();
    assert(bodyText.includes(locales[locale][route.key]), `${route.path} ${locale}: expected copy missing`);
    assert(!/Application error|Unhandled Runtime Error|MISSING_MESSAGE|Minified React error|Ошибка страницы/i.test(bodyText), `${route.path} ${locale}: visible runtime error`);

    const layout = await page.evaluate(() => {
      const header = document.querySelector('.pc-site-header');
      return {
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        headerVisible: Boolean(header && header.getBoundingClientRect().height > 0),
        headerPosition: header ? getComputedStyle(header).position : null,
        headingCount: document.querySelectorAll('h1,h2').length,
        brokenImages: Array.from(document.images).filter((image) => image.offsetParent !== null && (!image.complete || image.naturalWidth === 0)).length,
      };
    });
    assert(layout.overflow <= 8, `${route.path} ${locale}: overflow ${layout.overflow}px`);
    assert(layout.headerVisible && layout.headerPosition === 'fixed', `${route.path} ${locale}: canonical fixed header missing`);
    assert(layout.headingCount > 0, `${route.path} ${locale}: heading missing`);
    assert(layout.brokenImages === 0, `${route.path} ${locale}: broken images`);

    if (route.key === 'landing') {
      const cards = page.locator('.entry-role-tile');
      assert(await cards.count() === 12, `landing ${locale}: expected 12 role cards`);
      const hrefs = await cards.evaluateAll((items) => items.map((item) => item.getAttribute('href')));
      assert(hrefs.every((href) => href === '/platform-v7/login'), `landing ${locale}: role cards bypass login`);
      assert(await page.locator('.entry-hero-actions a').count() === 2, `landing ${locale}: hero CTA count is not 2`);
    }
    if (route.key === 'login') {
      assert(await page.locator('select[name*="role" i], [data-role-selector], .workspace-picker').count() === 0, `login ${locale}: role selector present`);
      assert(await page.locator('input[type="email"]').count() === 1, `login ${locale}: email missing`);
      assert(await page.locator('input[type="password"]').count() === 1, `login ${locale}: password missing`);
      assert(await page.locator('a[href="/platform-v7/forgot-password"]').count() === 1, `login ${locale}: recovery link missing`);
    }
    if (route.key === 'forgot') {
      assert(await page.locator('form').count() === 1, `forgot ${locale}: form missing`);
      assert(await page.locator('input[type="email"]').count() === 1, `forgot ${locale}: email missing`);
    }

    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    result.axe = axe.violations.map(({ id, impact, nodes }) => ({ id, impact, nodes: nodes.length }));
    const blocking = result.axe.filter((item) => item.impact === 'serious' || item.impact === 'critical');
    assert(blocking.length === 0, `${route.path} ${locale}: axe ${JSON.stringify(blocking)}`);
    await page.waitForTimeout(300);
    assert(consoleErrors.length === 0, `${route.path} ${locale}: console ${JSON.stringify(consoleErrors)}`);
    assert(runtimeErrors.length === 0, `${route.path} ${locale}: runtime ${JSON.stringify(runtimeErrors)}`);
    assert(failedRequests.length === 0, `${route.path} ${locale}: failed requests ${JSON.stringify(failedRequests)}`);
    result.outcome = 'passed';
  } catch (error) {
    result.failure = error instanceof Error ? error.message : String(error);
  } finally {
    try {
      await page.screenshot({ path: path.join(ARTIFACT_DIR, `${device.name}-${route.key}-${locale}-${result.outcome}.png`), fullPage: true });
    } catch {}
    page.off('console', onConsole);
    page.off('pageerror', onPageError);
    page.off('requestfailed', onRequestFailed);
  }
  return result;
}

async function languageCycle(page) {
  const result = { outcome: 'failed', failure: null };
  try {
    await page.goto(new URL('/platform-v7?lang=ru', BASE_URL).toString(), { waitUntil: 'networkidle', timeout: 60_000 });
    for (const expected of ['en', 'zh', 'ru']) {
      const button = page.locator('.pc-site-locale-switch');
      await button.click();
      await page.waitForURL(new RegExp(`lang=${expected}`), { timeout: 30_000 });
      assert(await button.getAttribute('data-current-locale') === expected, `language switch did not reach ${expected}`);
    }
    result.outcome = 'passed';
  } catch (error) {
    result.failure = error instanceof Error ? error.message : String(error);
  }
  return result;
}

await fs.mkdir(ARTIFACT_DIR, { recursive: true });
const report = { baseUrl: BASE_URL, generatedAt: new Date().toISOString(), cases: [], languageCycle: null, summary: null };
for (const device of matrix) {
  const browser = await device.engine.launch({ headless: true });
  const context = await browser.newContext(device.context);
  const page = await context.newPage();
  try {
    for (const locale of Object.keys(locales)) for (const route of routes) report.cases.push(await runCase(page, device, route, locale));
    if (device.name === 'chromium-desktop') report.languageCycle = await languageCycle(page);
  } finally {
    await context.close();
    await browser.close();
  }
}
report.summary = {
  total: report.cases.length,
  failed: report.cases.filter((item) => item.outcome !== 'passed').length,
  consoleErrorCases: report.cases.filter((item) => item.consoleErrors.length).length,
  runtimeErrorCases: report.cases.filter((item) => item.runtimeErrors.length).length,
  failedRequestCases: report.cases.filter((item) => item.failedRequests.length).length,
  languageCyclePassed: report.languageCycle?.outcome === 'passed',
};
await fs.writeFile(path.join(ARTIFACT_DIR, 'browser-smoke-report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report.summary, null, 2));
if (report.summary.failed || !report.summary.languageCyclePassed) process.exitCode = 1;
