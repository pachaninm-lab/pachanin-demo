import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, webkit, devices } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000';
const NETLIFY_BASE_URL = process.env.NETLIFY_PREVIEW_URL || '';
const ARTIFACT_DIR = path.resolve(process.env.ARTIFACT_DIR || '../../artifacts/public-entry-evidence-2337');

const locales = {
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
  { name: 'chromium-desktop-1440', engine: chromium, context: { viewport: { width: 1440, height: 1000 } }, overflowTolerance: 4 },
  { name: 'chromium-mobile-390', engine: chromium, context: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } }, overflowTolerance: 8 },
  { name: 'webkit-iphone-13', engine: webkit, context: devices['iPhone 13'], overflowTolerance: 8 },
];

function check(condition, message) {
  if (!condition) throw new Error(message);
}
function isInfrastructureNoise(text) {
  return /app\.netlify\.com\/cdp|netlify-cdp|Netlify Drawer|Framing 'https:\/\/app\.netlify\.com\//i.test(text);
}
function isCancelledRsc(url, errorText) {
  return url.includes('_rsc=') && /ERR_ABORTED|cancelled|canceled/i.test(errorText || '');
}
function isHydrationSignal(text) {
  return /hydration|did not match|server html|text content|validateDOMNesting|extra attributes|expected server html/i.test(text);
}
function compactAxe(violations) {
  return violations.map(({ id, impact, help, helpUrl, nodes }) => ({
    id, impact, help, helpUrl,
    nodes: nodes.map(({ target, html, failureSummary }) => ({ target, html, failureSummary })),
  }));
}

async function runCase(browser, matrixCase, routeCase, locale) {
  const context = await browser.newContext(matrixCase.context);
  const page = await context.newPage();
  const consoleErrors = [];
  const consoleMessages = [];
  const runtimeErrors = [];
  const failedRequests = [];
  page.on('console', (message) => {
    const text = message.text();
    consoleMessages.push({ type: message.type(), text });
    if (message.type() === 'error' && !isInfrastructureNoise(text)) consoleErrors.push(text);
  });
  page.on('pageerror', (error) => runtimeErrors.push(String(error?.stack || error)));
  page.on('requestfailed', (request) => {
    const url = request.url();
    const error = request.failure()?.errorText || 'unknown';
    if (!url.startsWith('data:') && !url.includes('/favicon.ico') && !isInfrastructureNoise(url) && !isCancelledRsc(url, error)) {
      failedRequests.push({ url, error });
    }
  });

  const result = {
    outcome: 'failed', matrix: matrixCase.name, route: routeCase.path, locale,
    requestedUrl: null, finalUrl: null, status: null, navigationMs: null,
    layout: null, axeViolations: [], consoleErrors, runtimeErrors, failedRequests,
    hydrationSignals: [], failure: null,
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
    check(response?.ok(), `${matrixCase.name} ${routeCase.path} ${locale}: HTTP ${response?.status()}`);
    await page.locator('body').waitFor({ state: 'visible', timeout: 20_000 });
    const bodyText = await page.locator('body').innerText();
    check(bodyText.includes(locales[locale][routeCase.key]), `${matrixCase.name} ${routeCase.path} ${locale}: expected copy missing`);
    check(!/Application error|Unhandled Runtime Error|Ошибка страницы|404 Not Found/i.test(bodyText), `${matrixCase.name} ${routeCase.path} ${locale}: visible runtime failure`);

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
      };
    });
    check(result.layout.headerVisible, `${matrixCase.name} ${routeCase.path} ${locale}: header missing`);
    check(result.layout.headerPosition === 'fixed', `${matrixCase.name} ${routeCase.path} ${locale}: header not fixed`);
    check(result.layout.overflow <= matrixCase.overflowTolerance, `${matrixCase.name} ${routeCase.path} ${locale}: horizontal overflow ${result.layout.overflow}px`);
    check(result.layout.brokenImages.length === 0, `${matrixCase.name} ${routeCase.path} ${locale}: broken images`);

    if (routeCase.key === 'landing') {
      const roleLinks = page.locator('.entry-role-tile');
      check((await roleLinks.count()) === 12, `${matrixCase.name} landing ${locale}: expected 12 role cards`);
      const hrefs = await roleLinks.evaluateAll((links) => links.map((link) => link.getAttribute('href')));
      check(hrefs.every((href) => href === '/platform-v7/login'), `${matrixCase.name} landing ${locale}: role cards bypass login`);
      check(!hrefs.some((href) => String(href).includes('?role=')), `${matrixCase.name} landing ${locale}: role query leak`);
      check((await page.locator('.entry-hero-actions a').count()) === 2, `${matrixCase.name} landing ${locale}: hero CTA count mismatch`);
    }
    if (routeCase.key === 'login') {
      check((await page.locator('select[name*="role" i], [data-role-selector], .workspace-picker, [data-testid="role-selector"]').count()) === 0, `${matrixCase.name} login ${locale}: role selector present`);
      check((await page.locator('input[type="email"]').count()) === 1, `${matrixCase.name} login ${locale}: email field mismatch`);
      check((await page.locator('input[type="password"]').count()) === 1, `${matrixCase.name} login ${locale}: password field mismatch`);
      check(!page.url().includes('role='), `${matrixCase.name} login ${locale}: role query present`);
    }
    if (routeCase.key === 'forgot') {
      check((await page.locator('form').count()) === 1, `${matrixCase.name} recovery ${locale}: form missing`);
      check((await page.locator('input[type="email"]').count()) === 1, `${matrixCase.name} recovery ${locale}: email missing`);
    }

    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    result.axeViolations = compactAxe(axe.violations);
    const blocking = axe.violations.filter((violation) => violation.impact === 'critical' || violation.impact === 'serious');
    check(blocking.length === 0, `${matrixCase.name} ${routeCase.path} ${locale}: blocking axe violations`);
    await page.waitForTimeout(300);
    result.hydrationSignals = consoleMessages.filter((item) => isHydrationSignal(item.text));
    check(result.hydrationSignals.length === 0, `${matrixCase.name} ${routeCase.path} ${locale}: hydration signals`);
    check(consoleErrors.length === 0, `${matrixCase.name} ${routeCase.path} ${locale}: console errors`);
    check(runtimeErrors.length === 0, `${matrixCase.name} ${routeCase.path} ${locale}: runtime errors`);
    check(failedRequests.length === 0, `${matrixCase.name} ${routeCase.path} ${locale}: failed requests`);
    result.outcome = 'passed';
  } catch (error) {
    result.failure = error instanceof Error ? error.message : String(error);
  } finally {
    result.finalUrl = page.url();
    try { await page.screenshot({ path: path.join(ARTIFACT_DIR, 'screenshots', `${matrixCase.name}-${routeCase.key}-${locale}-${result.outcome}.png`), fullPage: true }); } catch {}
    await context.close();
  }
  return result;
}

async function verifyLanguageControl(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const result = { outcome: 'failed', finalUrl: null, finalLocale: null, failure: null };
  try {
    await page.goto(new URL('/platform-v7?lang=ru', BASE_URL).toString(), { waitUntil: 'networkidle', timeout: 60_000 });
    let switcher = page.locator('.pc-site-locale-switch');
    check((await switcher.getAttribute('data-current-locale')) === 'ru', 'language did not start RU');
    await Promise.all([page.waitForURL(/lang=en/, { timeout: 30_000 }), switcher.click()]);
    check((await page.locator('body').innerText()).includes(locales.en.landing), 'RU→EN failed');
    switcher = page.locator('.pc-site-locale-switch');
    await Promise.all([page.waitForURL(/lang=zh/, { timeout: 30_000 }), switcher.click()]);
    check((await page.locator('body').innerText()).includes(locales.zh.landing), 'EN→ZH failed');
    result.outcome = 'passed';
    result.finalUrl = page.url();
    result.finalLocale = await page.locator('.pc-site-locale-switch').getAttribute('data-current-locale');
  } catch (error) {
    result.failure = error instanceof Error ? error.message : String(error);
  } finally {
    await context.close();
  }
  return result;
}

async function verifyMockedMfa(browser, locale) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const result = { outcome: 'failed', locale, loginCalls: 0, mfaCalls: 0, failure: null };
  try {
    await page.route('**/api/auth/login', async (route) => {
      result.loginCalls += 1;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, mfaRequired: true, enrollmentRequired: true, setupSecret: 'JBSWY3DPEHPK3PXP', methods: ['totp', 'backup_code'] }) });
    });
    await page.route('**/api/auth/mfa-login', async (route) => {
      result.mfaCalls += 1;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, redirectTo: '/platform-v7/buyer', backupCodes: ['BACKUP-ONE', 'BACKUP-TWO'] }) });
    });
    const url = new URL('/platform-v7/login', BASE_URL);
    url.searchParams.set('lang', locale);
    await page.goto(url.toString(), { waitUntil: 'networkidle', timeout: 60_000 });
    await page.locator('input[type="email"]').fill('buyer@example.test');
    await page.locator('input[type="password"]').fill('strong-password');
    await page.locator('form button[type="submit"]').click();
    await page.getByRole('heading', { name: locales[locale].mfa }).waitFor({ timeout: 15_000 });
    check((await page.getByText('JBSWY3DPEHPK3PXP', { exact: true }).count()) === 1, `MFA secret missing ${locale}`);
    await page.locator('input[autocomplete="one-time-code"]').fill('123456');
    await page.locator('form button[type="submit"]').click();
    await page.getByRole('heading', { name: locales[locale].backup }).waitFor({ timeout: 15_000 });
    check((await page.getByText('BACKUP-ONE', { exact: true }).count()) === 1, `backup codes missing ${locale}`);
    check(result.loginCalls === 1 && result.mfaCalls === 1, `unexpected auth call counts ${locale}`);
    result.outcome = 'passed';
  } catch (error) {
    result.failure = error instanceof Error ? error.message : String(error);
  } finally {
    await context.close();
  }
  return result;
}

async function verifyFailClosed(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const result = { outcome: 'failed', status: null, finalUrl: null, cookies: [], failure: null };
  try {
    await page.goto(new URL('/platform-v7/login?lang=ru', BASE_URL).toString(), { waitUntil: 'networkidle', timeout: 60_000 });
    const responsePromise = page.waitForResponse((response) => response.url().includes('/api/auth/login'));
    await page.locator('input[type="email"]').fill('nobody@example.test');
    await page.locator('input[type="password"]').fill('invalid-password');
    await page.locator('form button[type="submit"]').click();
    const response = await responsePromise;
    result.status = response.status();
    await page.locator('[role="alert"]').waitFor({ state: 'visible', timeout: 15_000 });
    result.finalUrl = page.url();
    result.cookies = (await context.cookies()).map(({ name }) => name);
    check(result.status >= 400, `fail-closed login returned ${result.status}`);
    check(result.finalUrl.includes('/platform-v7/login'), 'fail-closed login redirected');
    check(!result.cookies.some((name) => /demo|access|refresh|cabinet|session/i.test(name)), `session cookie created ${result.cookies}`);
    result.outcome = 'passed';
  } catch (error) {
    result.failure = error instanceof Error ? error.message : String(error);
  } finally {
    await context.close();
  }
  return result;
}

async function runNetlifySmoke() {
  if (!NETLIFY_BASE_URL) return { outcome: 'skipped', reason: 'NETLIFY_PREVIEW_URL not set', results: [] };
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const results = [];
  try {
    for (const route of routes) {
      const page = await context.newPage();
      const result = { route: route.path, status: null, finalUrl: null, outcome: 'failed', failure: null };
      try {
        const url = new URL(`${route.path}?lang=ru`, NETLIFY_BASE_URL).toString();
        const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
        result.status = response?.status() ?? null;
        result.finalUrl = page.url();
        const body = await page.locator('body').innerText();
        if (result.status === 403 || result.status === 429 || /verify you are human|netlify challenge/i.test(body)) {
          result.outcome = 'hosting-interference';
        } else {
          check(response?.ok(), `Netlify HTTP ${result.status}`);
          check(body.includes(locales.ru[route.key]), `Netlify expected copy missing ${route.key}`);
          check((await page.locator('.pc-site-header').count()) === 1, `Netlify header missing ${route.key}`);
          result.outcome = 'passed';
        }
      } catch (error) {
        result.failure = error instanceof Error ? error.message : String(error);
      } finally {
        try { await page.screenshot({ path: path.join(ARTIFACT_DIR, 'netlify', `${route.key}-${result.outcome}.png`), fullPage: true }); } catch {}
        await page.close();
      }
      results.push(result);
    }
  } finally {
    await context.close();
    await browser.close();
  }
  const appFailures = results.filter((item) => item.outcome === 'failed').length;
  return { outcome: appFailures ? 'failed' : 'passed', appFailures, results };
}

await fs.mkdir(path.join(ARTIFACT_DIR, 'screenshots'), { recursive: true });
await fs.mkdir(path.join(ARTIFACT_DIR, 'netlify'), { recursive: true });
const browsers = new Map();
const cases = [];
try {
  for (const matrixCase of matrix) {
    const browser = await matrixCase.engine.launch({ headless: true });
    browsers.set(matrixCase.name, browser);
    for (const routeCase of routes) {
      for (const locale of Object.keys(locales)) cases.push(await runCase(browser, matrixCase, routeCase, locale));
    }
  }
  const chromiumBrowser = browsers.get('chromium-mobile-390');
  const language = await verifyLanguageControl(chromiumBrowser);
  const mfa = [];
  for (const locale of Object.keys(locales)) mfa.push(await verifyMockedMfa(chromiumBrowser, locale));
  const failClosed = await verifyFailClosed(chromiumBrowser);
  const netlify = await runNetlifySmoke();
  const summary = {
    baseUrl: BASE_URL,
    netlifyBaseUrl: NETLIFY_BASE_URL || null,
    generatedAt: new Date().toISOString(),
    matrix: {
      total: cases.length,
      passed: cases.filter((item) => item.outcome === 'passed').length,
      failed: cases.filter((item) => item.outcome === 'failed').length,
      consoleErrors: cases.reduce((sum, item) => sum + item.consoleErrors.length, 0),
      runtimeErrors: cases.reduce((sum, item) => sum + item.runtimeErrors.length, 0),
      failedRequests: cases.reduce((sum, item) => sum + item.failedRequests.length, 0),
      hydrationSignals: cases.reduce((sum, item) => sum + item.hydrationSignals.length, 0),
      blockingAxe: cases.reduce((sum, item) => sum + item.axeViolations.filter((v) => v.impact === 'critical' || v.impact === 'serious').length, 0),
    },
    language,
    mfa,
    failClosed,
    netlify,
    cases,
  };
  await fs.writeFile(path.join(ARTIFACT_DIR, 'browser-summary.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({ matrix: summary.matrix, language, mfa, failClosed, netlify }, null, 2));
  if (summary.matrix.failed || language.outcome !== 'passed' || mfa.some((item) => item.outcome !== 'passed') || failClosed.outcome !== 'passed' || netlify.outcome === 'failed') process.exitCode = 1;
} finally {
  for (const browser of browsers.values()) await browser.close();
}
