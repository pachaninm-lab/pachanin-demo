import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, webkit, devices, request as playwrightRequest } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const TARGET_BASE_URL = process.env.TARGET_BASE_URL || 'https://6a5160af69a1500008f31813--vermillion-kitsune-0e7b97.netlify.app';
const PRIMARY_BASE_URL = process.env.PRIMARY_BASE_URL || 'https://xn----8sbjf4befbjgs9b.xn--p1ai';
const ARTIFACT_DIR = path.resolve(process.env.ARTIFACT_DIR || '../../artifacts/public-entry-postdeploy-c520');

const locales = {
  ru: { landing: 'Главный риск сделки', login: 'Войти в систему', forgot: 'Восстановить доступ' },
  en: { landing: 'The main transaction risk', login: 'Sign in', forgot: 'Restore access' },
  zh: { landing: '交易的主要风险', login: '登录系统', forgot: '恢复访问权限' },
};

const routes = [
  { key: 'landing', path: '/platform-v7', indexable: true },
  { key: 'login', path: '/platform-v7/login', indexable: false },
  { key: 'forgot', path: '/platform-v7/forgot-password', indexable: false },
];

const matrix = [
  {
    name: 'chromium-desktop-1440',
    engine: chromium,
    context: { viewport: { width: 1440, height: 1000 } },
    overflowTolerance: 4,
  },
  {
    name: 'chromium-mobile-390',
    engine: chromium,
    context: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } },
    overflowTolerance: 8,
  },
  {
    name: 'webkit-iphone-13',
    engine: webkit,
    context: devices['iPhone 13'],
    overflowTolerance: 8,
  },
];

const challengePattern = /We are verifying your connection|Security by Netlify|Checking your browser/i;
const visibleFailurePattern = /Application error|Unhandled Runtime Error|404 Not Found|Internal Server Error/i;
const staleLoginPattern = /Выберите один рабочий кабинет|Choose one workspace|选择一个工作空间/i;

function compactAxe(violations) {
  return violations.map(({ id, impact, nodes }) => ({ id, impact, nodes: nodes.length }));
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

async function inspectCase(browser, matrixCase, routeCase, locale) {
  const context = await browser.newContext(matrixCase.context);
  const page = await context.newPage();
  const consoleErrors = [];
  const runtimeErrors = [];
  const failures = [];

  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => runtimeErrors.push(String(error?.stack || error)));

  const requestedUrl = new URL(routeCase.path, TARGET_BASE_URL);
  requestedUrl.searchParams.set('lang', locale);
  const startedAt = Date.now();
  let response = null;
  let navigationError = null;

  try {
    response = await page.goto(requestedUrl.toString(), { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => undefined);
    await page.waitForTimeout(750);
  } catch (error) {
    navigationError = error instanceof Error ? error.message : String(error);
  }

  const result = {
    matrix: matrixCase.name,
    route: routeCase.path,
    locale,
    requestedUrl: requestedUrl.toString(),
    finalUrl: page.url(),
    status: response?.status() ?? null,
    navigationMs: Date.now() - startedAt,
    outcome: 'failed',
    infrastructureChallenge: false,
    failures,
    consoleErrors,
    runtimeErrors,
    responseHeaders: response?.headers() ?? {},
    layout: null,
    seo: null,
    roleLinks: null,
    heroCtaCount: null,
    axeViolations: [],
    externalFontRequests: [],
    navigationError,
  };

  try {
    if (navigationError) failures.push(`navigation: ${navigationError}`);
    const bodyText = await page.locator('body').innerText().catch(() => '');

    if (challengePattern.test(bodyText)) {
      result.infrastructureChallenge = true;
      result.outcome = 'infrastructure_challenge';
      return result;
    }

    if (!response) failures.push('missing navigation response');
    else if (!response.ok()) failures.push(`HTTP ${response.status()}`);

    const expectedText = locales[locale][routeCase.key];
    if (!bodyText.includes(expectedText)) failures.push(`missing expected text: ${expectedText}`);
    if (visibleFailurePattern.test(bodyText)) failures.push('visible runtime failure');

    const xRobotsTag = (response?.headers()['x-robots-tag'] || '').toLowerCase();
    if (routeCase.indexable) {
      if (!xRobotsTag.includes('index') || xRobotsTag.includes('noindex')) failures.push(`landing robots header is not indexable: ${xRobotsTag || 'missing'}`);
    } else if (!xRobotsTag.includes('noindex')) {
      failures.push(`auth robots header is not noindex: ${xRobotsTag || 'missing'}`);
    }

    result.layout = await page.evaluate(() => {
      const header = document.querySelector('.pc-site-header');
      const brokenImages = Array.from(document.querySelectorAll('img'))
        .filter((image) => image instanceof HTMLImageElement)
        .filter((image) => image.offsetParent !== null)
        .filter((image) => !image.complete || image.naturalWidth === 0 || image.naturalHeight === 0)
        .map((image) => ({ src: image.getAttribute('src'), alt: image.getAttribute('alt') }));

      return {
        viewportWidth: document.documentElement.clientWidth,
        documentWidth: document.documentElement.scrollWidth,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        headerVisible: Boolean(header && header.getBoundingClientRect().height > 0),
        headerPosition: header ? getComputedStyle(header).position : null,
        htmlTheme: document.documentElement.getAttribute('data-theme'),
        headingCount: document.querySelectorAll('h1,h2').length,
        controlCount: document.querySelectorAll('a,button,input,select,textarea').length,
        brokenImages,
      };
    });

    if (!result.layout.headerVisible) failures.push('canonical public header is not visible');
    if (result.layout.headerPosition !== 'fixed') failures.push(`header is not fixed: ${result.layout.headerPosition}`);
    if (result.layout.overflow > matrixCase.overflowTolerance) failures.push(`horizontal overflow: ${result.layout.overflow}px`);
    if (result.layout.htmlTheme !== 'light') failures.push(`unexpected html theme: ${result.layout.htmlTheme}`);
    if (result.layout.headingCount < 1) failures.push('no page heading');
    if (result.layout.controlCount < 1) failures.push('no interactive controls');
    if (result.layout.brokenImages.length > 0) failures.push(`broken images: ${JSON.stringify(result.layout.brokenImages)}`);

    result.externalFontRequests = await page.evaluate(() => performance.getEntriesByType('resource')
      .map((entry) => entry.name)
      .filter((url) => /fonts\.googleapis\.com|fonts\.gstatic\.com/i.test(url)));
    if (result.externalFontRequests.length > 0) failures.push(`external Google font requests: ${result.externalFontRequests.join(', ')}`);

    if (routeCase.key === 'landing') {
      const roleLinks = page.locator('.entry-role-tile');
      result.roleLinks = await roleLinks.evaluateAll((links) => links.map((link) => link.getAttribute('href')));
      result.heroCtaCount = await page.locator('.entry-hero-actions a').count();
      if (result.roleLinks.length !== 12) failures.push(`role cards: ${result.roleLinks.length}, expected 12`);
      if (!result.roleLinks.every((href) => href === '/platform-v7/login')) failures.push(`role links bypass single entry: ${JSON.stringify(result.roleLinks)}`);
      if (result.roleLinks.some((href) => String(href).includes('?role='))) failures.push('role query leak');
      if (result.heroCtaCount !== 2) failures.push(`hero CTAs: ${result.heroCtaCount}, expected 2`);

      const canonical = await page.locator('link[rel="canonical"]').getAttribute('href').catch(() => null);
      const alternates = await page.locator('link[rel="alternate"][hreflang]').evaluateAll((links) => links.map((link) => ({
        lang: link.getAttribute('hreflang'),
        href: link.getAttribute('href'),
      })));
      result.seo = { xRobotsTag, canonical, alternates };
      if (!canonical || !canonical.includes('/platform-v7')) failures.push(`canonical missing or invalid: ${canonical}`);
      for (const requiredLocale of ['ru', 'en', 'zh']) {
        if (!alternates.some((item) => item.lang === requiredLocale)) failures.push(`hreflang missing: ${requiredLocale}`);
      }
      if ((await page.locator('.entry-process-row[tabindex="0"][role="region"]').count()) !== 1) failures.push('process rail is not keyboard focusable');
    }

    if (routeCase.key === 'login') {
      if (staleLoginPattern.test(bodyText)) failures.push('stale workspace-picker login is still deployed');
      if ((await page.locator('a[href="/platform-v7/forgot-password"]').count()) !== 1) failures.push('recovery link missing');
      if ((await page.locator('select[name*="role" i], [data-role-selector], .workspace-picker, [data-testid="role-selector"]').count()) !== 0) failures.push('public role selector present');
      if (page.url().includes('role=')) failures.push('role query present in login URL');
    }

    if (routeCase.key === 'forgot') {
      if ((await page.locator('form').count()) !== 1) failures.push('recovery form missing');
      if ((await page.locator('input[type="email"]').count()) !== 1) failures.push('recovery email field missing');
    }

    const axe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    result.axeViolations = compactAxe(axe.violations);
    const blockingAxe = axe.violations.filter((violation) => violation.impact === 'critical' || violation.impact === 'serious');
    if (blockingAxe.length > 0) failures.push(`serious/critical axe: ${JSON.stringify(compactAxe(blockingAxe))}`);

    const meaningfulConsoleErrors = unique(consoleErrors).filter((message) => !/favicon\.ico/i.test(message));
    const meaningfulRuntimeErrors = unique(runtimeErrors);
    result.consoleErrors = meaningfulConsoleErrors;
    result.runtimeErrors = meaningfulRuntimeErrors;
    if (meaningfulConsoleErrors.length > 0) failures.push(`console errors: ${JSON.stringify(meaningfulConsoleErrors)}`);
    if (meaningfulRuntimeErrors.length > 0) failures.push(`runtime errors: ${JSON.stringify(meaningfulRuntimeErrors)}`);

    result.outcome = failures.length === 0 ? 'passed' : 'failed';
    return result;
  } finally {
    await fs.mkdir(ARTIFACT_DIR, { recursive: true });
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, `${matrixCase.name}-${routeCase.key}-${locale}-${result.outcome}.png`),
      fullPage: true,
    }).catch(() => undefined);
    await context.close();
  }
}

async function verifyLanguageSwitch() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const result = { outcome: 'failed', steps: [], failure: null, finalUrl: null };

  try {
    await page.goto(`${TARGET_BASE_URL}/platform-v7?lang=ru`, { waitUntil: 'networkidle', timeout: 60_000 });
    let switcher = page.locator('.pc-site-locale-switch');
    await switcher.waitFor({ state: 'visible', timeout: 15_000 });
    result.steps.push({ locale: await switcher.getAttribute('data-current-locale'), url: page.url() });

    await Promise.all([page.waitForURL(/lang=en/, { timeout: 30_000 }), switcher.click()]);
    await page.waitForLoadState('networkidle').catch(() => undefined);
    if (!(await page.locator('body').innerText()).includes(locales.en.landing)) throw new Error('RU → EN content did not render');
    switcher = page.locator('.pc-site-locale-switch');
    result.steps.push({ locale: await switcher.getAttribute('data-current-locale'), url: page.url() });

    await Promise.all([page.waitForURL(/lang=zh/, { timeout: 30_000 }), switcher.click()]);
    await page.waitForLoadState('networkidle').catch(() => undefined);
    if (!(await page.locator('body').innerText()).includes(locales.zh.landing)) throw new Error('EN → ZH content did not render');
    switcher = page.locator('.pc-site-locale-switch');
    result.steps.push({ locale: await switcher.getAttribute('data-current-locale'), url: page.url() });

    result.outcome = 'passed';
    result.finalUrl = page.url();
  } catch (error) {
    result.failure = error instanceof Error ? error.message : String(error);
    result.finalUrl = page.url();
  } finally {
    await context.close();
    await browser.close();
  }

  return result;
}

async function verifyPrimaryDomain() {
  const api = await playwrightRequest.newContext({
    extraHTTPHeaders: {
      'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126 Safari/537.36',
      accept: 'text/html,application/xhtml+xml',
    },
  });
  const results = [];

  try {
    for (const routeCase of routes) {
      const url = `${PRIMARY_BASE_URL}${routeCase.path}?lang=ru`;
      const response = await api.get(url, { timeout: 30_000, failOnStatusCode: false });
      const body = await response.text();
      const challenge = challengePattern.test(body);
      const xRobotsTag = (response.headers()['x-robots-tag'] || '').toLowerCase();
      results.push({
        route: routeCase.path,
        status: response.status(),
        challenge,
        xRobotsTag,
        expectedTextPresent: body.includes(locales.ru[routeCase.key]),
      });
      await new Promise((resolve) => setTimeout(resolve, 600));
    }
  } finally {
    await api.dispose();
  }

  return results;
}

await fs.mkdir(ARTIFACT_DIR, { recursive: true });
const reportPath = path.join(ARTIFACT_DIR, 'browser-report.json');
const report = {
  targetBaseUrl: TARGET_BASE_URL,
  primaryBaseUrl: PRIMARY_BASE_URL,
  generatedAt: new Date().toISOString(),
  deployCommit: 'c520c59b32df290b8ce1a72f6601e3a4ee326584',
  cases: [],
  languageSwitch: null,
  primaryDomain: null,
  summary: null,
};

for (const matrixCase of matrix) {
  const browser = await matrixCase.engine.launch({ headless: true });
  try {
    for (const locale of Object.keys(locales)) {
      for (const routeCase of routes) {
        report.cases.push(await inspectCase(browser, matrixCase, routeCase, locale));
        await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }
  } finally {
    await browser.close();
  }
}

report.languageSwitch = await verifyLanguageSwitch();
report.primaryDomain = await verifyPrimaryDomain();
report.summary = {
  totalCases: report.cases.length,
  passedCases: report.cases.filter((item) => item.outcome === 'passed').length,
  failedCases: report.cases.filter((item) => item.outcome === 'failed').length,
  infrastructureChallenges: report.cases.filter((item) => item.outcome === 'infrastructure_challenge').length,
  consoleErrorCases: report.cases.filter((item) => item.consoleErrors.length > 0).length,
  runtimeErrorCases: report.cases.filter((item) => item.runtimeErrors.length > 0).length,
  seriousOrCriticalAxeCases: report.cases.filter((item) => item.axeViolations.some((violation) => violation.impact === 'serious' || violation.impact === 'critical')).length,
  languageSwitchPassed: report.languageSwitch.outcome === 'passed',
  primaryDomainChallenges: report.primaryDomain.filter((item) => item.challenge).length,
};
await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report.summary, null, 2));

if (report.summary.failedCases > 0 || report.summary.infrastructureChallenges > 0 || !report.summary.languageSwitchPassed) {
  process.exitCode = 1;
}
