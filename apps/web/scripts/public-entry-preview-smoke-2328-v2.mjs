import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, webkit, devices } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL;
if (!BASE_URL) throw new Error('PLAYWRIGHT_BASE_URL is required');
const OUT = path.resolve(process.env.ARTIFACT_DIR || '../../artifacts/public-entry-preview-smoke-2328-v2');

const copy = {
  ru: { landing: 'Главный риск сделки', login: 'Войти в систему', forgot: 'Восстановить доступ' },
  en: { landing: 'The main transaction risk', login: 'Sign in', forgot: 'Restore access' },
  zh: { landing: '交易的主要风险', login: '登录系统', forgot: '恢复访问权限' },
};
const routes = [
  { key: 'landing', path: '/platform-v7' },
  { key: 'login', path: '/platform-v7/login' },
  { key: 'forgot', path: '/platform-v7/forgot-password' },
];
const devicesMatrix = [
  { name: 'chromium-desktop', engine: chromium, options: { viewport: { width: 1440, height: 1000 } } },
  { name: 'chromium-mobile', engine: chromium, options: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } },
  { name: 'webkit-iphone-13', engine: webkit, options: devices['iPhone 13'] },
];

const previewNoise = (text) => text.includes("Framing 'https://app.netlify.com/'") || text.includes('netlify-cdp') || text.includes('app.netlify.com/cdp');
const cancelledRsc = (url, error) => url.includes('_rsc=') && /ERR_ABORTED|cancelled|canceled/i.test(error || '');
const ensure = (condition, message) => { if (!condition) throw new Error(message); };

async function runCase(page, device, route, locale) {
  const consoleErrors = [];
  const runtimeErrors = [];
  const failedRequests = [];
  const onConsole = (message) => {
    const text = message.text();
    if (message.type() === 'error' && !previewNoise(text)) consoleErrors.push(text);
  };
  const onPageError = (error) => runtimeErrors.push(String(error?.stack || error));
  const onRequestFailed = (request) => {
    const url = request.url();
    const error = request.failure()?.errorText || 'unknown';
    if (!url.startsWith('data:') && !url.includes('/favicon.ico') && !cancelledRsc(url, error)) failedRequests.push({ url, error });
  };
  page.on('console', onConsole);
  page.on('pageerror', onPageError);
  page.on('requestfailed', onRequestFailed);

  const result = { device: device.name, route: route.path, locale, outcome: 'failed', consoleErrors, runtimeErrors, failedRequests, axe: [], failure: null };
  try {
    const url = new URL(route.path, BASE_URL);
    url.searchParams.set('lang', locale);
    const response = await page.goto(url.toString(), { waitUntil: 'networkidle', timeout: 60_000 });
    ensure(response?.ok(), `${route.path} ${locale}: HTTP ${response?.status()}`);
    const body = await page.locator('body').innerText();
    ensure(body.includes(copy[locale][route.key]), `${route.path} ${locale}: expected localized copy missing`);
    ensure(!/Application error|Unhandled Runtime Error|MISSING_MESSAGE|Minified React error|Ошибка страницы/i.test(body), `${route.path} ${locale}: visible runtime error`);

    const layout = await page.evaluate(() => {
      const header = document.querySelector('.pc-site-header');
      return {
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        header: Boolean(header && header.getBoundingClientRect().height > 0),
        position: header ? getComputedStyle(header).position : null,
        headings: document.querySelectorAll('h1,h2').length,
        brokenImages: Array.from(document.images).filter((img) => img.offsetParent !== null && (!img.complete || img.naturalWidth === 0)).length,
      };
    });
    ensure(layout.overflow <= 8, `${route.path} ${locale}: overflow ${layout.overflow}px`);
    ensure(layout.header && layout.position === 'fixed', `${route.path} ${locale}: fixed canonical header missing`);
    ensure(layout.headings > 0, `${route.path} ${locale}: heading missing`);
    ensure(layout.brokenImages === 0, `${route.path} ${locale}: broken image`);

    if (route.key === 'landing') {
      const cards = page.locator('.entry-role-tile');
      ensure(await cards.count() === 12, `landing ${locale}: role-card count`);
      const hrefs = await cards.evaluateAll((items) => items.map((item) => item.getAttribute('href')));
      ensure(hrefs.every((href) => href === '/platform-v7/login'), `landing ${locale}: role card bypass`);
      ensure(await page.locator('.entry-hero-actions a').count() === 2, `landing ${locale}: hero CTA count`);
    }
    if (route.key === 'login') {
      ensure(await page.locator('select[name*="role" i], [data-role-selector], .workspace-picker').count() === 0, `login ${locale}: role selector present`);
      ensure(await page.locator('input[type="email"]').count() === 1, `login ${locale}: email missing`);
      ensure(await page.locator('input[type="password"]').count() === 1, `login ${locale}: password missing`);
      ensure(await page.locator('a[href="/platform-v7/forgot-password"]').count() === 1, `login ${locale}: recovery link missing`);
    }
    if (route.key === 'forgot') {
      ensure(await page.locator('form').count() === 1, `forgot ${locale}: form missing`);
      ensure(await page.locator('input[type="email"]').count() === 1, `forgot ${locale}: email missing`);
    }

    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    result.axe = axe.violations.map(({ id, impact, nodes }) => ({ id, impact, nodes: nodes.length }));
    const blocking = result.axe.filter((item) => item.impact === 'critical' || item.impact === 'serious');
    ensure(blocking.length === 0, `${route.path} ${locale}: axe ${JSON.stringify(blocking)}`);
    await page.waitForTimeout(300);
    ensure(consoleErrors.length === 0, `${route.path} ${locale}: console ${JSON.stringify(consoleErrors)}`);
    ensure(runtimeErrors.length === 0, `${route.path} ${locale}: runtime ${JSON.stringify(runtimeErrors)}`);
    ensure(failedRequests.length === 0, `${route.path} ${locale}: failed requests ${JSON.stringify(failedRequests)}`);
    result.outcome = 'passed';
  } catch (error) {
    result.failure = error instanceof Error ? error.message : String(error);
  } finally {
    try { await page.screenshot({ path: path.join(OUT, `${device.name}-${route.key}-${locale}-${result.outcome}.png`), fullPage: true }); } catch {}
    page.off('console', onConsole);
    page.off('pageerror', onPageError);
    page.off('requestfailed', onRequestFailed);
  }
  return result;
}

async function languageCycle(page) {
  const result = { outcome: 'failed', failure: null };
  try {
    for (const locale of ['ru', 'en', 'zh']) {
      const initial = locale === 'ru' ? 'ru' : locale === 'en' ? 'ru' : 'en';
      const startUrl = new URL('/platform-v7', BASE_URL);
      startUrl.searchParams.set('lang', initial);
      await page.goto(startUrl.toString(), { waitUntil: 'networkidle', timeout: 60_000 });
      const target = page.locator(`.pc-site-locale-options a[data-locale="${locale}"]`);
      await target.click();
      await page.waitForURL(new RegExp(`lang=${locale}`), { timeout: 30_000 });
      ensure((await page.locator('html').getAttribute('lang'))?.startsWith(locale), `html lang did not reach ${locale}`);
      ensure((await page.locator('body').innerText()).includes(copy[locale].landing), `body copy did not reach ${locale}`);
    }
    result.outcome = 'passed';
  } catch (error) {
    result.failure = error instanceof Error ? error.message : String(error);
  }
  return result;
}

await fs.mkdir(OUT, { recursive: true });
const report = { baseUrl: BASE_URL, generatedAt: new Date().toISOString(), cases: [], languageCycle: null, summary: null };
for (const device of devicesMatrix) {
  const browser = await device.engine.launch({ headless: true });
  const context = await browser.newContext(device.options);
  const page = await context.newPage();
  try {
    for (const locale of Object.keys(copy)) for (const route of routes) report.cases.push(await runCase(page, device, route, locale));
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
await fs.writeFile(path.join(OUT, 'browser-smoke-report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report.summary, null, 2));
if (report.summary.failed || !report.summary.languageCyclePassed) process.exitCode = 1;
