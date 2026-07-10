import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, webkit, devices } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL;
if (!BASE_URL) throw new Error('PLAYWRIGHT_BASE_URL is required');
const OUT = path.resolve(process.env.ARTIFACT_DIR || '../../artifacts/public-entry-lcp-evidence-2337');

const copy = {
  ru: { landing: 'Главный риск сделки', login: 'Войти в систему', forgot: 'Восстановить доступ', mfa: 'Подтвердить вход', backup: 'Сохраните резервные коды' },
  en: { landing: 'The main transaction risk', login: 'Sign in', forgot: 'Restore access', mfa: 'Verify sign-in', backup: 'Save your backup codes' },
  zh: { landing: '交易的主要风险', login: '登录系统', forgot: '恢复访问权限', mfa: '确认登录', backup: '保存备用代码' },
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

const hydrationPattern = /hydration|did not match|server html|text content|validateDOMNesting|extra attributes|expected server html|Minified React error/i;
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const cancelledRsc = (url, error) => url.includes('_rsc=') && /ERR_ABORTED|cancelled|canceled/i.test(error || '');

async function runCase(page, device, route, locale) {
  const consoleErrors = [];
  const consoleMessages = [];
  const runtimeErrors = [];
  const failedRequests = [];
  const onConsole = (message) => {
    const item = { type: message.type(), text: message.text(), location: message.location() };
    consoleMessages.push(item);
    if (message.type() === 'error') consoleErrors.push(item.text);
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

  const result = { device: device.name, route: route.path, locale, outcome: 'failed', status: null, finalUrl: null, layout: null, consoleErrors, runtimeErrors, failedRequests, hydrationSignals: [], axe: [], failure: null };
  try {
    const url = new URL(route.path, BASE_URL);
    url.searchParams.set('lang', locale);
    const response = await page.goto(url.toString(), { waitUntil: 'networkidle', timeout: 60_000 });
    result.status = response?.status() ?? null;
    result.finalUrl = page.url();
    assert(response?.ok(), `${device.name} ${route.path} ${locale}: HTTP ${result.status}`);
    const body = await page.locator('body').innerText();
    assert(body.includes(copy[locale][route.key]), `${device.name} ${route.path} ${locale}: localized copy missing`);
    assert(!/Application error|Unhandled Runtime Error|MISSING_MESSAGE|Ошибка страницы|404 Not Found/i.test(body), `${device.name} ${route.path} ${locale}: visible runtime error`);

    result.layout = await page.evaluate(() => {
      const header = document.querySelector('.pc-site-header');
      return {
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        headerVisible: Boolean(header && header.getBoundingClientRect().height > 0),
        headerPosition: header ? getComputedStyle(header).position : null,
        headingCount: document.querySelectorAll('h1,h2').length,
        brokenImages: Array.from(document.images).filter((image) => image.offsetParent !== null && (!image.complete || image.naturalWidth === 0)).length,
      };
    });
    assert(result.layout.overflow <= device.overflow, `${device.name} ${route.path} ${locale}: overflow ${result.layout.overflow}px`);
    assert(result.layout.headerVisible && result.layout.headerPosition === 'fixed', `${device.name} ${route.path} ${locale}: canonical fixed header missing`);
    assert(result.layout.headingCount > 0, `${device.name} ${route.path} ${locale}: heading missing`);
    assert(result.layout.brokenImages === 0, `${device.name} ${route.path} ${locale}: broken images`);

    if (route.key === 'landing') {
      const cards = page.locator('.entry-role-tile');
      assert(await cards.count() === 12, `${device.name} landing ${locale}: role-card count`);
      const hrefs = await cards.evaluateAll((items) => items.map((item) => item.getAttribute('href')));
      assert(hrefs.every((href) => href === '/platform-v7/login'), `${device.name} landing ${locale}: role-card bypass`);
      assert(!hrefs.some((href) => String(href).includes('?role=')), `${device.name} landing ${locale}: role query leak`);
      assert(await page.locator('.entry-hero-actions a').count() === 2, `${device.name} landing ${locale}: hero CTA count`);
    }
    if (route.key === 'login') {
      assert(await page.locator('select[name*="role" i], [data-role-selector], .workspace-picker, [data-testid="role-selector"]').count() === 0, `${device.name} login ${locale}: role selector present`);
      assert(await page.locator('input[type="email"]').count() === 1, `${device.name} login ${locale}: email missing`);
      assert(await page.locator('input[type="password"]').count() === 1, `${device.name} login ${locale}: password missing`);
      assert(!page.url().includes('role='), `${device.name} login ${locale}: role in URL`);
    }
    if (route.key === 'forgot') {
      assert(await page.locator('form').count() === 1, `${device.name} forgot ${locale}: form missing`);
      assert(await page.locator('input[type="email"]').count() === 1, `${device.name} forgot ${locale}: email missing`);
    }

    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    result.axe = axe.violations.map(({ id, impact, nodes }) => ({ id, impact, nodes: nodes.length }));
    const blockingAxe = result.axe.filter((item) => item.impact === 'critical' || item.impact === 'serious');
    assert(blockingAxe.length === 0, `${device.name} ${route.path} ${locale}: axe ${JSON.stringify(blockingAxe)}`);

    await page.waitForTimeout(400);
    result.hydrationSignals = consoleMessages.filter((item) => hydrationPattern.test(item.text));
    assert(result.hydrationSignals.length === 0, `${device.name} ${route.path} ${locale}: hydration ${JSON.stringify(result.hydrationSignals)}`);
    assert(consoleErrors.length === 0, `${device.name} ${route.path} ${locale}: console ${JSON.stringify(consoleErrors)}`);
    assert(runtimeErrors.length === 0, `${device.name} ${route.path} ${locale}: runtime ${JSON.stringify(runtimeErrors)}`);
    assert(failedRequests.length === 0, `${device.name} ${route.path} ${locale}: failed requests ${JSON.stringify(failedRequests)}`);
    result.outcome = 'passed';
  } catch (error) {
    result.failure = error instanceof Error ? error.message : String(error);
  } finally {
    result.finalUrl = page.url();
    try { await page.screenshot({ path: path.join(OUT, `${device.name}-${route.key}-${locale}-${result.outcome}.png`), fullPage: true }); } catch {}
    page.off('console', onConsole);
    page.off('pageerror', onPageError);
    page.off('requestfailed', onRequestFailed);
  }
  return result;
}

async function verifyLanguageCycle(page) {
  const result = { outcome: 'failed', steps: [], failure: null };
  try {
    await page.goto(new URL('/platform-v7?lang=ru', BASE_URL).toString(), { waitUntil: 'networkidle', timeout: 60_000 });
    for (const target of ['en', 'zh', 'ru']) {
      const switcher = page.locator('.pc-site-locale-switch');
      await switcher.waitFor({ state: 'visible', timeout: 15_000 });
      await Promise.all([page.waitForURL(new RegExp(`lang=${target}`), { timeout: 30_000 }), switcher.click()]);
      const body = await page.locator('body').innerText();
      assert(body.includes(copy[target].landing), `language cycle did not reach ${target}`);
      assert((await page.locator('html').getAttribute('lang'))?.startsWith(target), `html lang did not reach ${target}`);
      result.steps.push({ target, url: page.url() });
    }
    result.outcome = 'passed';
  } catch (error) {
    result.failure = error instanceof Error ? error.message : String(error);
  }
  return result;
}

async function verifyMockedMfa(page, locale) {
  const result = { locale, outcome: 'failed', loginCalls: 0, mfaCalls: 0, failure: null };
  try {
    await page.route('**/api/auth/login', async (route) => {
      result.loginCalls += 1;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, mfaRequired: true, enrollmentRequired: true, setupSecret: 'JBSWY3DPEHPK3PXP', methods: ['totp', 'backup_code'] }) });
    });
    await page.route('**/api/auth/mfa-login', async (route) => {
      result.mfaCalls += 1;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, redirectTo: '/platform-v7/buyer', backupCodes: ['BACKUP-ONE', 'BACKUP-TWO', 'BACKUP-THREE'] }) });
    });
    const url = new URL('/platform-v7/login', BASE_URL);
    url.searchParams.set('lang', locale);
    await page.goto(url.toString(), { waitUntil: 'networkidle', timeout: 60_000 });
    await page.locator('input[type="email"]').fill('buyer@example.test');
    await page.locator('input[type="password"]').fill('strong-password');
    await page.locator('form button[type="submit"]').click();
    await page.getByRole('heading', { name: copy[locale].mfa }).waitFor({ timeout: 15_000 });
    await page.locator('input[autocomplete="one-time-code"]').fill('123456');
    await page.locator('form button[type="submit"]').click();
    await page.getByRole('heading', { name: copy[locale].backup }).waitFor({ timeout: 15_000 });
    assert(await page.getByText('BACKUP-ONE').count() === 1, `${locale}: backup codes missing`);
    assert(result.loginCalls === 1 && result.mfaCalls === 1, `${locale}: duplicate auth submissions`);
    result.outcome = 'passed';
  } catch (error) {
    result.failure = error instanceof Error ? error.message : String(error);
  } finally {
    await page.unroute('**/api/auth/login');
    await page.unroute('**/api/auth/mfa-login');
    try { await page.screenshot({ path: path.join(OUT, `mocked-mfa-${locale}-${result.outcome}.png`), fullPage: true }); } catch {}
  }
  return result;
}

async function verifyMockedRecovery(page, locale) {
  const result = { locale, outcome: 'failed', requestCalls: 0, failure: null };
  try {
    await page.route('**/api/platform-v7/inquiries', async (route) => {
      result.requestCalls += 1;
      await route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ accepted: true }) });
    });
    const url = new URL('/platform-v7/forgot-password', BASE_URL);
    url.searchParams.set('lang', locale);
    await page.goto(url.toString(), { waitUntil: 'networkidle', timeout: 60_000 });
    await page.locator('input[type="email"]').fill('user@example.test');
    await page.locator('form button[type="submit"]').click();
    await page.locator('.pc-recovery-success').waitFor({ timeout: 15_000 });
    assert(result.requestCalls === 1, `${locale}: duplicate recovery requests`);
    result.outcome = 'passed';
  } catch (error) {
    result.failure = error instanceof Error ? error.message : String(error);
  } finally {
    await page.unroute('**/api/platform-v7/inquiries');
    try { await page.screenshot({ path: path.join(OUT, `mocked-recovery-${locale}-${result.outcome}.png`), fullPage: true }); } catch {}
  }
  return result;
}

await fs.mkdir(OUT, { recursive: true });
const report = { baseUrl: BASE_URL, generatedAt: new Date().toISOString(), cases: [], languageCycle: null, mockedMfa: [], mockedRecovery: [], summary: null };
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
    if (device.name === 'chromium-desktop-1440') {
      const languagePage = await context.newPage();
      try { report.languageCycle = await verifyLanguageCycle(languagePage); } finally { await languagePage.close(); }
      for (const locale of Object.keys(copy)) {
        const mfaPage = await context.newPage();
        try { report.mockedMfa.push(await verifyMockedMfa(mfaPage, locale)); } finally { await mfaPage.close(); }
        const recoveryPage = await context.newPage();
        try { report.mockedRecovery.push(await verifyMockedRecovery(recoveryPage, locale)); } finally { await recoveryPage.close(); }
      }
    }
  } finally {
    await context.close();
    await browser.close();
  }
}

report.summary = {
  totalCases: report.cases.length,
  failedCases: report.cases.filter((item) => item.outcome !== 'passed').length,
  consoleErrorCases: report.cases.filter((item) => item.consoleErrors.length).length,
  runtimeErrorCases: report.cases.filter((item) => item.runtimeErrors.length).length,
  failedRequestCases: report.cases.filter((item) => item.failedRequests.length).length,
  hydrationSignalCases: report.cases.filter((item) => item.hydrationSignals.length).length,
  seriousOrCriticalAxeCases: report.cases.filter((item) => item.axe.some((violation) => violation.impact === 'serious' || violation.impact === 'critical')).length,
  languageCyclePassed: report.languageCycle?.outcome === 'passed',
  mockedMfaFailures: report.mockedMfa.filter((item) => item.outcome !== 'passed').length,
  mockedRecoveryFailures: report.mockedRecovery.filter((item) => item.outcome !== 'passed').length,
};
await fs.writeFile(path.join(OUT, 'browser-smoke-report.json'), JSON.stringify(report, null, 2));
await fs.writeFile(path.join(OUT, 'hydration-report.json'), JSON.stringify({ generatedAt: report.generatedAt, cases: report.cases.map(({ device, route, locale, hydrationSignals, runtimeErrors }) => ({ device, route, locale, hydrationSignals, runtimeErrors })) }, null, 2));
console.log(JSON.stringify(report.summary, null, 2));
if (report.summary.failedCases || report.summary.consoleErrorCases || report.summary.runtimeErrorCases || report.summary.failedRequestCases || report.summary.hydrationSignalCases || report.summary.seriousOrCriticalAxeCases || !report.summary.languageCyclePassed || report.summary.mockedMfaFailures || report.summary.mockedRecoveryFailures) process.exitCode = 1;
