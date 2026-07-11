import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, webkit, devices } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const BASE_URL = process.env.PRODUCTION_BASE_URL;
if (!BASE_URL) throw new Error('PRODUCTION_BASE_URL is required');
const OUT = path.resolve(process.env.ARTIFACT_DIR || '../../artifacts/public-entry-production-smoke-9bc51cb');

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
  { name: 'chromium-desktop-1440', engine: chromium, context: { viewport: { width: 1440, height: 1000 } }, overflow: 4 },
  { name: 'chromium-mobile-390', engine: chromium, context: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } }, overflow: 8 },
  { name: 'webkit-iphone-13', engine: webkit, context: devices['iPhone 13'], overflow: 8 },
];
const runtimePattern = /hydration|did not match|server html|text content|validateDOMNesting|extra attributes|expected server html|Minified React error|MISSING_MESSAGE|next-intl/i;
const sessionCookies = new Set(['pc_access_token', 'pc_refresh_token', 'pc_session_present', 'pc_csrf_token', 'pc_v7_cabinet', 'pc_mfa_pending']);
const assert = (condition, message) => { if (!condition) throw new Error(message); };

function redirectCount(request) {
  let count = 0;
  let cursor = request.redirectedFrom();
  while (cursor) {
    count += 1;
    cursor = cursor.redirectedFrom();
  }
  return count;
}

async function inspectRuntime(page) {
  return page.evaluate(async () => {
    const header = document.querySelector('.pc-site-header');
    const headerStyle = header ? getComputedStyle(header) : null;
    const headerRect = header?.getBoundingClientRect();
    const registrations = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistrations() : [];
    const cacheKeys = 'caches' in window ? await caches.keys() : [];
    return {
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      brokenImages: Array.from(document.images).filter((image) => image.offsetParent !== null && (!image.complete || image.naturalWidth === 0)).length,
      header: headerStyle && headerRect ? {
        position: headerStyle.position,
        display: headerStyle.display,
        visibility: headerStyle.visibility,
        opacity: headerStyle.opacity,
        top: headerStyle.top,
        zIndex: headerStyle.zIndex,
        width: headerRect.width,
        height: headerRect.height,
      } : null,
      serviceWorkers: registrations.map((registration) => ({ scope: registration.scope, active: registration.active?.scriptURL || null })),
      cacheKeys,
      htmlLang: document.documentElement.lang,
    };
  });
}

async function runCase(page, device, route, locale) {
  const consoleErrors = [];
  const runtimeErrors = [];
  const failedRequests = [];
  const badResponses = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push({ text: message.text(), location: message.location() });
  });
  page.on('pageerror', (error) => runtimeErrors.push(String(error?.stack || error)));
  page.on('requestfailed', (request) => {
    const url = request.url();
    if (!url.startsWith('data:') && !url.includes('/favicon.ico')) failedRequests.push({ url, resourceType: request.resourceType(), error: request.failure()?.errorText || 'unknown' });
  });
  page.on('response', (response) => {
    if (response.status() >= 400) badResponses.push({ url: response.url(), status: response.status(), resourceType: response.request().resourceType() });
  });

  const result = {
    device: device.name,
    route: route.path,
    locale,
    status: null,
    finalUrl: null,
    redirectCount: null,
    runtime: null,
    consoleErrors,
    runtimeErrors,
    failedRequests,
    badResponses,
    outcome: 'failed',
    failure: null,
  };
  try {
    const url = new URL(route.path, BASE_URL);
    url.searchParams.set('lang', locale);
    const response = await page.goto(url.toString(), { waitUntil: 'networkidle', timeout: 90_000 });
    result.status = response?.status() ?? null;
    result.finalUrl = page.url();
    result.redirectCount = response ? redirectCount(response.request()) : null;
    assert(response?.ok(), `${device.name} ${route.path} ${locale}: HTTP ${result.status}`);
    assert((result.redirectCount ?? 99) <= 2, `${device.name} ${route.path} ${locale}: redirect loop risk ${result.redirectCount}`);
    assert(new URL(result.finalUrl).pathname === route.path, `${device.name} ${route.path} ${locale}: unexpected final path ${result.finalUrl}`);
    assert(!new URL(result.finalUrl).searchParams.has('role'), `${device.name} ${route.path} ${locale}: role query present`);

    const body = await page.locator('body').innerText();
    assert(body.includes(copy[locale][route.key]), `${device.name} ${route.path} ${locale}: localized copy missing`);
    assert(!/Application error|Unhandled Runtime Error|Ошибка страницы|404 Not Found/i.test(body), `${device.name} ${route.path} ${locale}: visible runtime failure`);

    result.runtime = await inspectRuntime(page);
    assert(result.runtime.header, `${device.name} ${route.path} ${locale}: header missing`);
    assert(result.runtime.header.position === 'fixed', `${device.name} ${route.path} ${locale}: header not fixed`);
    assert(result.runtime.header.visibility === 'visible' && result.runtime.header.opacity === '1', `${device.name} ${route.path} ${locale}: header hidden`);
    assert(result.runtime.overflow <= device.overflow, `${device.name} ${route.path} ${locale}: overflow ${result.runtime.overflow}px`);
    assert(result.runtime.brokenImages === 0, `${device.name} ${route.path} ${locale}: broken images`);
    assert(result.runtime.serviceWorkers.length === 0, `${device.name} ${route.path} ${locale}: unexpected service worker ${JSON.stringify(result.runtime.serviceWorkers)}`);
    assert(result.runtime.cacheKeys.length === 0, `${device.name} ${route.path} ${locale}: unexpected Cache Storage ${JSON.stringify(result.runtime.cacheKeys)}`);
    assert(result.runtime.htmlLang.startsWith(locale), `${device.name} ${route.path} ${locale}: html lang ${result.runtime.htmlLang}`);

    if (route.key === 'landing') {
      const cards = page.locator('.entry-role-tile');
      assert(await cards.count() === 12, `${device.name} landing ${locale}: expected 12 role cards`);
      const hrefs = await cards.evaluateAll((items) => items.map((item) => item.getAttribute('href')));
      assert(hrefs.every((href) => href === '/platform-v7/login'), `${device.name} landing ${locale}: role card bypass`);
      assert(await page.locator('.entry-hero-actions a').count() === 2, `${device.name} landing ${locale}: hero CTA count`);
    }
    if (route.key === 'login') {
      assert(await page.locator('select[name*="role" i], [data-role-selector], .workspace-picker, [data-testid="role-selector"]').count() === 0, `${device.name} login ${locale}: role selector present`);
      assert(await page.locator('input[type="email"]').count() === 1, `${device.name} login ${locale}: email missing`);
      assert(await page.locator('input[type="password"]').count() === 1, `${device.name} login ${locale}: password missing`);
    }
    if (route.key === 'forgot') {
      assert(await page.locator('form').count() === 1, `${device.name} forgot ${locale}: form missing`);
      assert(await page.locator('input[type="email"]').count() === 1, `${device.name} forgot ${locale}: email missing`);
    }

    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    const blockers = axe.violations.filter((violation) => violation.impact === 'critical' || violation.impact === 'serious');
    assert(blockers.length === 0, `${device.name} ${route.path} ${locale}: axe ${JSON.stringify(blockers.map(({ id, impact, nodes }) => ({ id, impact, nodes: nodes.length })))}`);

    await page.waitForTimeout(350);
    assert(consoleErrors.length === 0, `${device.name} ${route.path} ${locale}: console ${JSON.stringify(consoleErrors)}`);
    assert(runtimeErrors.length === 0, `${device.name} ${route.path} ${locale}: runtime ${JSON.stringify(runtimeErrors)}`);
    assert(failedRequests.length === 0, `${device.name} ${route.path} ${locale}: failed requests ${JSON.stringify(failedRequests)}`);
    assert(badResponses.length === 0, `${device.name} ${route.path} ${locale}: bad responses ${JSON.stringify(badResponses)}`);
    assert(!consoleErrors.some((item) => runtimePattern.test(item.text)), `${device.name} ${route.path} ${locale}: hydration/i18n signal`);

    if (route.key === 'landing' && locale === 'ru') {
      await page.reload({ waitUntil: 'networkidle', timeout: 90_000 });
      const reloadedBody = await page.locator('body').innerText();
      const reloadedRuntime = await inspectRuntime(page);
      assert(reloadedBody.includes(copy.ru.landing), `${device.name}: reload white-screen regression`);
      assert(reloadedRuntime.header?.position === 'fixed', `${device.name}: header lost after reload`);
      assert(reloadedRuntime.overflow <= device.overflow, `${device.name}: overflow after reload`);
    }

    result.outcome = 'passed';
  } catch (error) {
    result.failure = error instanceof Error ? error.message : String(error);
  } finally {
    result.finalUrl = page.url();
    try { await page.screenshot({ path: path.join(OUT, `${device.name}-${route.key}-${locale}-${result.outcome}.png`), fullPage: true }); } catch {}
  }
  return result;
}

async function verifyLanguageCycle(page, engine) {
  const result = { engine, outcome: 'failed', steps: [], failure: null };
  try {
    await page.goto(new URL('/platform-v7?lang=ru', BASE_URL).toString(), { waitUntil: 'networkidle', timeout: 90_000 });
    for (const target of ['en', 'zh', 'ru']) {
      const control = page.locator('.pc-site-locale-switch');
      await control.waitFor({ state: 'visible', timeout: 15_000 });
      await Promise.all([
        page.waitForURL((url) => url.searchParams.get('lang') === target, { timeout: 30_000 }),
        control.click(),
      ]);
      const body = await page.locator('body').innerText();
      assert(body.includes(copy[target].landing), `${engine}: language cycle did not reach ${target}`);
      assert((await page.locator('html').getAttribute('lang'))?.startsWith(target), `${engine}: html lang did not reach ${target}`);
      result.steps.push({ target, url: page.url() });
    }
    result.outcome = 'passed';
  } catch (error) {
    result.failure = error instanceof Error ? error.message : String(error);
  }
  return result;
}

async function verifyRecoveryWithoutSideEffect(page, locale) {
  const result = { locale, outcome: 'failed', requestCalls: 0, failure: null };
  try {
    await page.route('**/api/platform-v7/inquiries', async (route) => {
      result.requestCalls += 1;
      await route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ accepted: true }) });
    });
    const url = new URL('/platform-v7/forgot-password', BASE_URL);
    url.searchParams.set('lang', locale);
    await page.goto(url.toString(), { waitUntil: 'networkidle', timeout: 90_000 });
    await page.locator('input[type="email"]').fill(`production-smoke-${locale}@example.invalid`);
    await page.locator('form button[type="submit"]').click();
    await page.locator('.pc-recovery-success').waitFor({ timeout: 15_000 });
    assert(result.requestCalls === 1, `${locale}: duplicate recovery requests`);
    result.outcome = 'passed';
  } catch (error) {
    result.failure = error instanceof Error ? error.message : String(error);
  } finally {
    await page.unroute('**/api/platform-v7/inquiries');
  }
  return result;
}

async function verifyFailClosedLogin(context) {
  const result = { outcome: 'failed', status: null, payload: null, setCookie: null, cookies: [], uiErrorVisible: false, finalUrl: null, failure: null };
  try {
    const response = await context.request.post(new URL('/api/auth/login', BASE_URL).toString(), {
      data: { email: `production-smoke-${Date.now()}@example.invalid`, password: 'not-a-real-password' },
      timeout: 30_000,
    });
    result.status = response.status();
    result.payload = await response.json().catch(() => null);
    result.setCookie = response.headers()['set-cookie'] || null;
    assert(result.status === 503, `fail-closed login expected 503, got ${result.status}`);
    assert(result.payload?.ok === false && result.payload?.code === 'AUTH_SERVICE_UNAVAILABLE', `unexpected fail-closed payload ${JSON.stringify(result.payload)}`);
    assert(!result.setCookie || ![...sessionCookies].some((name) => result.setCookie.includes(`${name}=`)), `session cookie emitted on fail-closed response: ${result.setCookie}`);

    const page = await context.newPage();
    try {
      await page.goto(new URL('/platform-v7/login?lang=ru', BASE_URL).toString(), { waitUntil: 'networkidle', timeout: 90_000 });
      await page.locator('input[type="email"]').fill(`production-ui-smoke-${Date.now()}@example.invalid`);
      await page.locator('input[type="password"]').fill('not-a-real-password');
      await page.locator('form button[type="submit"]').click();
      await page.locator('.pc-auth-error').waitFor({ timeout: 20_000 });
      result.uiErrorVisible = true;
      result.finalUrl = page.url();
      assert(new URL(result.finalUrl).pathname === '/platform-v7/login', `fail-closed UI redirected to ${result.finalUrl}`);
      const body = await page.locator('body').innerText();
      assert(!/резервные коды|backup codes|备用代码/i.test(body), 'fail-closed UI entered MFA/session flow');
    } finally {
      await page.close();
    }

    result.cookies = (await context.cookies()).map(({ name, domain, path }) => ({ name, domain, path }));
    assert(!result.cookies.some((cookie) => sessionCookies.has(cookie.name)), `session/demo cookie created: ${JSON.stringify(result.cookies)}`);
    result.outcome = 'passed';
  } catch (error) {
    result.failure = error instanceof Error ? error.message : String(error);
  }
  return result;
}

await fs.mkdir(OUT, { recursive: true });
const report = {
  baseUrl: BASE_URL,
  productionCommit: process.env.PRODUCTION_COMMIT || null,
  productionDeploy: process.env.PRODUCTION_DEPLOY_ID || null,
  generatedAt: new Date().toISOString(),
  cases: [],
  languageCycles: [],
  recovery: [],
  failClosedLogin: null,
  summary: null,
};

for (const device of matrix) {
  const browser = await device.engine.launch({ headless: true });
  const context = await browser.newContext(device.context);
  try {
    for (const locale of Object.keys(copy)) {
      for (const route of routes) {
        const page = await context.newPage();
        try { report.cases.push(await runCase(page, device, route, locale)); } finally { await page.close(); }
      }
    }
    if (device.name === 'chromium-desktop-1440' || device.name === 'webkit-iphone-13') {
      const page = await context.newPage();
      try { report.languageCycles.push(await verifyLanguageCycle(page, device.name)); } finally { await page.close(); }
    }
    if (device.name === 'chromium-desktop-1440') {
      for (const locale of Object.keys(copy)) {
        const page = await context.newPage();
        try { report.recovery.push(await verifyRecoveryWithoutSideEffect(page, locale)); } finally { await page.close(); }
      }
      report.failClosedLogin = await verifyFailClosedLogin(context);
    }
  } finally {
    await context.close();
    await browser.close();
  }
}

report.summary = {
  totalCases: report.cases.length,
  failedCases: report.cases.filter((item) => item.outcome !== 'passed').length,
  http200Cases: report.cases.filter((item) => item.status === 200).length,
  consoleErrorCases: report.cases.filter((item) => item.consoleErrors.length).length,
  runtimeErrorCases: report.cases.filter((item) => item.runtimeErrors.length).length,
  failedRequestCases: report.cases.filter((item) => item.failedRequests.length).length,
  badResponseCases: report.cases.filter((item) => item.badResponses.length).length,
  languageCycleFailures: report.languageCycles.filter((item) => item.outcome !== 'passed').length,
  recoveryFailures: report.recovery.filter((item) => item.outcome !== 'passed').length,
  failClosedLoginPassed: report.failClosedLogin?.outcome === 'passed',
};
await fs.writeFile(path.join(OUT, 'production-smoke-report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report.summary, null, 2));
if (
  report.summary.failedCases ||
  report.summary.http200Cases !== report.summary.totalCases ||
  report.summary.consoleErrorCases ||
  report.summary.runtimeErrorCases ||
  report.summary.failedRequestCases ||
  report.summary.badResponseCases ||
  report.summary.languageCycleFailures ||
  report.summary.recoveryFailures ||
  !report.summary.failClosedLoginPassed
) process.exitCode = 1;
