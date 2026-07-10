import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, webkit, devices } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL;
if (!BASE_URL) throw new Error('PLAYWRIGHT_BASE_URL is required');
const ARTIFACT_DIR = path.resolve(process.env.ARTIFACT_DIR || '../../artifacts/public-entry-preview-smoke-2323');

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

function isNetlifyPreviewNoise(text) {
  return (
    text.includes("Framing 'https://app.netlify.com/'") ||
    text.includes('app.netlify.com/cdp') ||
    text.includes('netlify-cdp') ||
    text.includes('Netlify Drawer')
  );
}

function isCancelledRscNavigation(url, errorText) {
  return url.includes('_rsc=') && /ERR_ABORTED|cancelled|canceled/i.test(errorText || '');
}

function compactAxe(violations) {
  return violations.map(({ id, impact, help, helpUrl, nodes }) => ({
    id,
    impact,
    help,
    helpUrl,
    nodes: nodes.map(({ target, html, failureSummary }) => ({ target, html, failureSummary })),
  }));
}

async function runCase(page, matrixCase, routeCase, locale) {
  const consoleErrors = [];
  const runtimeErrors = [];
  const failedRequests = [];
  const onConsole = (message) => {
    const text = message.text();
    if (message.type() === 'error' && !isNetlifyPreviewNoise(text)) consoleErrors.push(text);
  };
  const onPageError = (error) => runtimeErrors.push(String(error?.stack || error));
  const onRequestFailed = (request) => {
    const url = request.url();
    const errorText = request.failure()?.errorText || 'unknown';
    if (!url.startsWith('data:') && !url.includes('/favicon.ico') && !isNetlifyPreviewNoise(url) && !isCancelledRscNavigation(url, errorText)) {
      failedRequests.push({ url, error: errorText });
    }
  };
  page.on('console', onConsole);
  page.on('pageerror', onPageError);
  page.on('requestfailed', onRequestFailed);

  const result = {
    outcome: 'failed', matrix: matrixCase.name, route: routeCase.path, locale,
    requestedUrl: null, finalUrl: null, status: null, navigationMs: null,
    layout: null, axeViolations: [], consoleErrors, runtimeErrors, failedRequests, failure: null,
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
        .filter((image) => image instanceof HTMLImageElement && image.offsetParent !== null)
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

    check(result.layout.headerVisible, `${matrixCase.name} ${routeCase.path} ${locale}: canonical header not visible`);
    check(result.layout.headerPosition === 'fixed', `${matrixCase.name} ${routeCase.path} ${locale}: header not fixed`);
    check(result.layout.overflow <= matrixCase.overflowTolerance, `${matrixCase.name} ${routeCase.path} ${locale}: horizontal overflow ${result.layout.overflow}px`);
    check(result.layout.headingCount > 0, `${matrixCase.name} ${routeCase.path} ${locale}: no headings`);
    check(result.layout.controlCount > 0, `${matrixCase.name} ${routeCase.path} ${locale}: no controls`);
    check(result.layout.brokenImages.length === 0, `${matrixCase.name} ${routeCase.path} ${locale}: broken images ${JSON.stringify(result.layout.brokenImages)}`);

    if (routeCase.key === 'landing') {
      const roleLinks = page.locator('.entry-role-tile');
      check((await roleLinks.count()) === 12, `${matrixCase.name} landing ${locale}: expected 12 role cards`);
      const hrefs = await roleLinks.evaluateAll((links) => links.map((link) => link.getAttribute('href')));
      check(hrefs.every((href) => href === '/platform-v7/login'), `${matrixCase.name} landing ${locale}: role cards bypass login ${JSON.stringify(hrefs)}`);
      check(!hrefs.some((href) => String(href).includes('?role=')), `${matrixCase.name} landing ${locale}: role query leak`);
      check((await page.locator('.entry-hero-actions a').count()) === 2, `${matrixCase.name} landing ${locale}: hero CTA count mismatch`);
    }

    if (routeCase.key === 'login') {
      const roleSelector = page.locator('select[name*="role" i], [data-role-selector], .workspace-picker, [data-testid="role-selector"], .roles');
      check((await roleSelector.count()) === 0, `${matrixCase.name} login ${locale}: role selector present`);
      check((await page.locator('input[type="email"]').count()) === 1, `${matrixCase.name} login ${locale}: email field mismatch`);
      check((await page.locator('input[type="password"]').count()) === 1, `${matrixCase.name} login ${locale}: password field mismatch`);
      check((await page.locator('a[href="/platform-v7/forgot-password"]').count()) === 1, `${matrixCase.name} login ${locale}: recovery link missing`);
      check(!page.url().includes('role='), `${matrixCase.name} login ${locale}: role query present`);
    }

    if (routeCase.key === 'forgot') {
      check((await page.locator('form').count()) === 1, `${matrixCase.name} recovery ${locale}: recovery form missing`);
      check((await page.locator('input[type="email"]').count()) === 1, `${matrixCase.name} recovery ${locale}: email field missing`);
    }

    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    result.axeViolations = compactAxe(axe.violations);
    const blocking = axe.violations.filter((violation) => violation.impact === 'critical' || violation.impact === 'serious');
    check(blocking.length === 0, `${matrixCase.name} ${routeCase.path} ${locale}: axe ${JSON.stringify(compactAxe(blocking))}`);

    await page.waitForTimeout(400);
    check(consoleErrors.length === 0, `${matrixCase.name} ${routeCase.path} ${locale}: console ${JSON.stringify(consoleErrors)}`);
    check(runtimeErrors.length === 0, `${matrixCase.name} ${routeCase.path} ${locale}: runtime ${JSON.stringify(runtimeErrors)}`);
    check(failedRequests.length === 0, `${matrixCase.name} ${routeCase.path} ${locale}: requests ${JSON.stringify(failedRequests)}`);
    result.outcome = 'passed';
  } catch (error) {
    result.failure = error instanceof Error ? error.message : String(error);
  } finally {
    result.finalUrl = page.url();
    try {
      await page.screenshot({ path: path.join(ARTIFACT_DIR, `${matrixCase.name}-${routeCase.key}-${locale}-${result.outcome}.png`), fullPage: true });
    } catch (error) {
      result.screenshotError = error instanceof Error ? error.message : String(error);
    }
    page.off('console', onConsole);
    page.off('pageerror', onPageError);
    page.off('requestfailed', onRequestFailed);
  }
  return result;
}

async function verifyLanguageControl(page) {
  const result = { outcome: 'failed', finalUrl: null, finalLocale: null, failure: null };
  try {
    await page.goto(new URL('/platform-v7?lang=ru', BASE_URL).toString(), { waitUntil: 'networkidle', timeout: 60_000 });
    let switcher = page.locator('.pc-site-locale-switch');
    await switcher.waitFor({ state: 'visible', timeout: 15_000 });
    check((await switcher.getAttribute('data-current-locale')) === 'ru', 'language control did not start RU');
    await Promise.all([page.waitForURL(/lang=en/, { timeout: 30_000 }), switcher.click()]);
    check((await page.locator('body').innerText()).includes(locales.en.landing), 'language control RU→EN failed');
    switcher = page.locator('.pc-site-locale-switch');
    await Promise.all([page.waitForURL(/lang=zh/, { timeout: 30_000 }), switcher.click()]);
    check((await page.locator('body').innerText()).includes(locales.zh.landing), 'language control EN→ZH failed');
    result.outcome = 'passed';
    result.finalUrl = page.url();
    result.finalLocale = await page.locator('.pc-site-locale-switch').getAttribute('data-current-locale');
  } catch (error) {
    result.failure = error instanceof Error ? error.message : String(error);
    result.finalUrl = page.url();
  }
  return result;
}

async function verifyMockedMfaFlow(page, locale) {
  const result = { outcome: 'failed', locale, loginCalls: 0, mfaCalls: 0, failure: null };
  try {
    await page.route('**/api/auth/login', async (route) => {
      result.loginCalls += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          mfaRequired: true,
          enrollmentRequired: true,
          setupSecret: 'JBSWY3DPEHPK3PXP',
          methods: ['totp', 'backup_code'],
        }),
      });
    });
    await page.route('**/api/auth/mfa-login', async (route) => {
      result.mfaCalls += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          redirectTo: '/platform-v7/buyer',
          backupCodes: ['BACKUP-ONE', 'BACKUP-TWO', 'BACKUP-THREE'],
        }),
      });
    });

    const url = new URL('/platform-v7/login', BASE_URL);
    url.searchParams.set('lang', locale);
    await page.goto(url.toString(), { waitUntil: 'networkidle', timeout: 60_000 });
    await page.locator('input[type="email"]').fill('buyer@example.test');
    await page.locator('input[type="password"]').fill('strong-password');
    await page.locator('form button[type="submit"]').click();
    await page.getByRole('heading', { name: locales[locale].mfa }).waitFor({ timeout: 15_000 });
    check((await page.locator('text=JBSWY3DPEHPK3PXP').count()) === 1, `MFA setup secret missing for ${locale}`);
    await page.locator('input[autocomplete="one-time-code"]').fill('123456');
    await page.locator('form button[type="submit"]').click();
    await page.getByRole('heading', { name: locales[locale].backup }).waitFor({ timeout: 15_000 });
    check((await page.locator('text=BACKUP-ONE').count()) === 1, `backup codes missing for ${locale}`);
    check(result.loginCalls === 1, `login submit count ${result.loginCalls}`);
    check(result.mfaCalls === 1, `mfa submit count ${result.mfaCalls}`);
    result.outcome = 'passed';
  } catch (error) {
    result.failure = error instanceof Error ? error.message : String(error);
  } finally {
    await page.unroute('**/api/auth/login');
    await page.unroute('**/api/auth/mfa-login');
    try { await page.screenshot({ path: path.join(ARTIFACT_DIR, `mocked-mfa-${locale}-${result.outcome}.png`), fullPage: true }); } catch {}
  }
  return result;
}

await fs.mkdir(ARTIFACT_DIR, { recursive: true });
const reportPath = path.join(ARTIFACT_DIR, 'browser-smoke-report.json');
const report = { baseUrl: BASE_URL, generatedAt: new Date().toISOString(), cases: [], languageControl: null, mockedMfa: [], summary: null };
const persist = () => fs.writeFile(reportPath, JSON.stringify(report, null, 2));

for (const matrixCase of matrix) {
  const browser = await matrixCase.engine.launch({ headless: true });
  const context = await browser.newContext(matrixCase.context);
  try {
    for (const locale of Object.keys(locales)) {
      for (const routeCase of routes) {
        const page = await context.newPage();
        try {
          report.cases.push(await runCase(page, matrixCase, routeCase, locale));
          await persist();
        } finally {
          await page.close();
        }
      }
    }
    if (matrixCase.name === 'chromium-desktop-1440') {
      const languagePage = await context.newPage();
      try {
        report.languageControl = await verifyLanguageControl(languagePage);
      } finally {
        await languagePage.close();
      }
      for (const locale of Object.keys(locales)) {
        const mfaPage = await context.newPage();
        try {
          report.mockedMfa.push(await verifyMockedMfaFlow(mfaPage, locale));
        } finally {
          await mfaPage.close();
        }
      }
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
  failedRequestCases: report.cases.filter((item) => item.failedRequests.length > 0).length,
  seriousOrCriticalAxeCases: report.cases.filter((item) => item.axeViolations.some((violation) => violation.impact === 'serious' || violation.impact === 'critical')).length,
  languageControlPassed: report.languageControl?.outcome === 'passed',
  mockedMfaFailures: report.mockedMfa.filter((item) => item.outcome !== 'passed').length,
};
await persist();
console.log(JSON.stringify(report.summary, null, 2));

if (
  report.summary.functionalFailures > 0 ||
  report.summary.consoleErrorCases > 0 ||
  report.summary.runtimeErrorCases > 0 ||
  report.summary.failedRequestCases > 0 ||
  !report.summary.languageControlPassed ||
  report.summary.mockedMfaFailures > 0
) process.exitCode = 1;
