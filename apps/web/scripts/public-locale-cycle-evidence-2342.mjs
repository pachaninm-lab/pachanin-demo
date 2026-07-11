import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, webkit, devices } from '@playwright/test';

const BASE_URL = process.env.PREVIEW_BASE_URL;
if (!BASE_URL) throw new Error('PREVIEW_BASE_URL is required');
const OUT = path.resolve(process.env.ARTIFACT_DIR || '../../artifacts/public-locale-cycle-evidence-2342');
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
const matrix = [
  { name: 'chromium-desktop-1440', engine: chromium, context: { viewport: { width: 1440, height: 1000 } } },
  { name: 'webkit-iphone-13', engine: webkit, context: devices['iPhone 13'] },
];
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const runtimePattern = /hydration|did not match|server html|text content|validateDOMNesting|extra attributes|expected server html|Minified React error|MISSING_MESSAGE|next-intl/i;

async function cleanLoad(page, route, locale, diagnostics) {
  const url = new URL(route.path, BASE_URL);
  url.searchParams.set('lang', locale);
  const response = await page.goto(url.toString(), { waitUntil: 'networkidle', timeout: 90_000 });
  diagnostics.statuses.push({ url: url.toString(), status: response?.status() ?? null, finalUrl: page.url() });
  assert(response?.ok(), `${route.path} ${locale}: HTTP ${response?.status()}`);
  const body = await page.locator('body').innerText();
  assert(body.includes(copy[locale][route.key]), `${route.path} ${locale}: localized copy missing`);
  assert((await page.locator('html').getAttribute('lang'))?.startsWith(locale), `${route.path} ${locale}: html lang mismatch`);
  const switcher = page.locator('.pc-site-locale-switch');
  await switcher.waitFor({ state: 'visible', timeout: 15_000 });
  assert(await switcher.getAttribute('data-current-locale') === locale, `${route.path} ${locale}: stale current locale`);
  const headerPosition = await page.locator('.pc-site-header').evaluate((node) => getComputedStyle(node).position);
  assert(headerPosition === 'fixed', `${route.path} ${locale}: header not fixed`);
}

async function runEngine(item) {
  const browser = await item.engine.launch({ headless: true });
  const context = await browser.newContext(item.context);
  const result = { engine: item.name, outcome: 'failed', explicitOverride: [], cycle: [], consoleErrors: [], runtimeErrors: [], failedRequests: [], badResponses: [], statuses: [], failure: null };
  try {
    await context.addCookies([{ name: 'pc-v7-locale', value: 'zh', domain: new URL(BASE_URL).hostname, path: '/', secure: true, sameSite: 'Lax' }]);
    const page = await context.newPage();
    page.on('console', (message) => { if (message.type() === 'error') result.consoleErrors.push({ text: message.text(), location: message.location() }); });
    page.on('pageerror', (error) => result.runtimeErrors.push(String(error?.stack || error)));
    page.on('requestfailed', (request) => result.failedRequests.push({ url: request.url(), error: request.failure()?.errorText || 'unknown' }));
    page.on('response', (response) => { if (response.status() >= 400) result.badResponses.push({ url: response.url(), status: response.status(), type: response.request().resourceType() }); });

    for (const route of routes) {
      await cleanLoad(page, route, 'ru', result);
      const switcher = page.locator('.pc-site-locale-switch');
      assert(await switcher.getAttribute('data-next-locale') === 'en', `${route.path}: explicit RU did not override stale ZH cookie`);
      assert((await switcher.getAttribute('href'))?.endsWith('?lang=en'), `${route.path}: next href is not EN`);
      result.explicitOverride.push({ route: route.path, current: await switcher.getAttribute('data-current-locale'), next: await switcher.getAttribute('data-next-locale'), href: await switcher.getAttribute('href') });
    }

    await cleanLoad(page, routes[0], 'ru', result);
    for (const target of ['en', 'zh', 'ru']) {
      const switcher = page.locator('.pc-site-locale-switch');
      const href = await switcher.getAttribute('href');
      assert(await switcher.getAttribute('data-next-locale') === target, `${item.name}: expected next ${target}, got ${await switcher.getAttribute('data-next-locale')}`);
      await Promise.all([
        page.waitForURL((url) => url.searchParams.get('lang') === target, { timeout: 45_000 }),
        switcher.click(),
      ]);
      await page.waitForLoadState('networkidle');
      const body = await page.locator('body').innerText();
      assert(body.includes(copy[target].landing), `${item.name}: cycle copy did not reach ${target}`);
      assert((await page.locator('html').getAttribute('lang'))?.startsWith(target), `${item.name}: cycle html lang did not reach ${target}`);
      assert(await page.locator('.pc-site-locale-switch').getAttribute('data-current-locale') === target, `${item.name}: switch label did not reach ${target}`);
      result.cycle.push({ target, href, finalUrl: page.url() });
    }

    await page.waitForTimeout(350);
    assert(result.consoleErrors.length === 0, `${item.name}: console errors ${JSON.stringify(result.consoleErrors)}`);
    assert(result.runtimeErrors.length === 0, `${item.name}: runtime errors ${JSON.stringify(result.runtimeErrors)}`);
    assert(result.failedRequests.length === 0, `${item.name}: failed requests ${JSON.stringify(result.failedRequests)}`);
    assert(result.badResponses.length === 0, `${item.name}: bad responses ${JSON.stringify(result.badResponses)}`);
    assert(!result.consoleErrors.some((item) => runtimePattern.test(item.text)), `${item.name}: hydration/i18n signal`);
    result.outcome = 'passed';
    await page.screenshot({ path: path.join(OUT, `${item.name}-cycle-passed.png`), fullPage: true });
    await page.close();
  } catch (error) {
    result.failure = error instanceof Error ? error.message : String(error);
  } finally {
    await context.close();
    await browser.close();
  }
  return result;
}

await fs.mkdir(OUT, { recursive: true });
const results = [];
for (const item of matrix) results.push(await runEngine(item));
const report = {
  baseUrl: BASE_URL,
  implementation: process.env.IMPLEMENTATION_SHA || null,
  deployId: process.env.DEPLOY_ID || null,
  generatedAt: new Date().toISOString(),
  results,
  summary: {
    engines: results.length,
    passed: results.filter((item) => item.outcome === 'passed').length,
    failed: results.filter((item) => item.outcome !== 'passed').length,
    explicitOverrideChecks: results.reduce((sum, item) => sum + item.explicitOverride.length, 0),
    cycleSteps: results.reduce((sum, item) => sum + item.cycle.length, 0),
  },
};
await fs.writeFile(path.join(OUT, 'locale-cycle-report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report.summary, null, 2));
if (report.summary.failed) process.exitCode = 1;
