import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, webkit, devices } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const BASE_URL = process.env.PREVIEW_BASE_URL;
if (!BASE_URL) throw new Error('PREVIEW_BASE_URL is required');

const OUT = path.resolve(process.env.ARTIFACT_DIR || '../../artifacts/public-entry-industrial-evidence-2345');
const IMPLEMENTATION_SHA = process.env.IMPLEMENTATION_SHA || null;
const DEPLOY_ID = process.env.DEPLOY_ID || null;

const locales = ['ru', 'en', 'zh'];
const routes = [
  { key: 'landing', path: '/platform-v7' },
  { key: 'login', path: '/platform-v7/login' },
];
const matrix = [
  { name: 'chromium-desktop-1440', engine: chromium, context: { viewport: { width: 1440, height: 1000 }, reducedMotion: 'no-preference' }, mobile: false },
  { name: 'chromium-mobile-390', engine: chromium, context: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 }, mobile: true },
  { name: 'webkit-iphone-13', engine: webkit, context: { ...devices['iPhone 13'], reducedMotion: 'no-preference' }, mobile: true },
];

const copy = {
  ru: { landing: 'Главный риск сделки', login: 'Вход в рабочую платформу' },
  en: { landing: 'The main transaction risk', login: 'Sign in to the working platform' },
  zh: { landing: '交易的主要风险', login: '登录工作平台' },
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function isPreviewToolbarNoise(text = '', url = '') {
  const value = `${text} ${url}`;
  return value.includes('/.netlify/scripts/cdp') || value.includes('app.netlify.com') || value.includes('Netlify Drawer');
}

async function runCase(item, route, locale) {
  const browser = await item.engine.launch({ headless: true });
  const context = await browser.newContext(item.context);
  const page = await context.newPage();
  const diagnostics = {
    consoleErrors: [],
    runtimeErrors: [],
    failedRequests: [],
    badResponses: [],
    previewToolbarNoise: [],
  };
  const result = {
    engine: item.name,
    route: route.key,
    locale,
    outcome: 'failed',
    status: null,
    finalUrl: null,
    axe: { serious: 0, critical: 0, violations: [] },
    diagnostics,
    checks: {},
    failure: null,
  };

  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const entry = { text: message.text(), location: message.location() };
    if (isPreviewToolbarNoise(entry.text, entry.location?.url)) diagnostics.previewToolbarNoise.push(entry);
    else diagnostics.consoleErrors.push(entry);
  });
  page.on('pageerror', (error) => diagnostics.runtimeErrors.push(String(error?.stack || error)));
  page.on('requestfailed', (request) => {
    const entry = { url: request.url(), error: request.failure()?.errorText || 'unknown' };
    if (isPreviewToolbarNoise('', entry.url)) diagnostics.previewToolbarNoise.push(entry);
    else diagnostics.failedRequests.push(entry);
  });
  page.on('response', (response) => {
    if (response.status() < 400) return;
    const entry = { url: response.url(), status: response.status(), type: response.request().resourceType() };
    if (isPreviewToolbarNoise('', entry.url)) diagnostics.previewToolbarNoise.push(entry);
    else diagnostics.badResponses.push(entry);
  });

  try {
    const url = new URL(route.path, BASE_URL);
    url.searchParams.set('lang', locale);
    const response = await page.goto(url.toString(), { waitUntil: 'networkidle', timeout: 90_000 });
    result.status = response?.status() ?? null;
    result.finalUrl = page.url();
    assert(response?.ok(), `${item.name} ${route.key} ${locale}: HTTP ${response?.status()}`);

    const bodyText = await page.locator('body').innerText();
    assert(bodyText.includes(copy[locale][route.key]), `${item.name} ${route.key} ${locale}: localized primary copy missing`);
    const htmlLang = await page.locator('html').getAttribute('lang');
    assert(htmlLang?.startsWith(locale), `${item.name} ${route.key} ${locale}: html lang mismatch (${htmlLang})`);

    const header = page.locator('.pc-site-header');
    await header.waitFor({ state: 'visible', timeout: 15_000 });
    const headerPosition = await header.evaluate((node) => getComputedStyle(node).position);
    assert(headerPosition === 'fixed', `${item.name} ${route.key} ${locale}: header is not fixed`);

    const layout = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollHeight: document.documentElement.scrollHeight,
      bodyTextLength: document.body.innerText.trim().length,
    }));
    assert(layout.scrollWidth <= layout.clientWidth + 1, `${item.name} ${route.key} ${locale}: horizontal overflow ${layout.scrollWidth}/${layout.clientWidth}`);
    assert(layout.bodyTextLength > 120, `${item.name} ${route.key} ${locale}: probable blank screen`);

    const brokenImages = await page.locator('img').evaluateAll((images) => images.filter((image) => !image.complete || image.naturalWidth === 0).map((image) => image.getAttribute('src')));
    assert(brokenImages.length === 0, `${item.name} ${route.key} ${locale}: broken images ${JSON.stringify(brokenImages)}`);

    const axe = await new AxeBuilder({ page }).analyze();
    const blocking = axe.violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical');
    result.axe.serious = axe.violations.filter((violation) => violation.impact === 'serious').length;
    result.axe.critical = axe.violations.filter((violation) => violation.impact === 'critical').length;
    result.axe.violations = blocking.map((violation) => ({ id: violation.id, impact: violation.impact, help: violation.help, nodes: violation.nodes.length }));
    assert(blocking.length === 0, `${item.name} ${route.key} ${locale}: Axe blockers ${JSON.stringify(result.axe.violations)}`);

    if (route.key === 'landing') {
      const heroActions = page.locator('.entry-hero-actions a');
      assert(await heroActions.count() === 2, `${item.name} ${locale}: hero CTA count is not 2`);
      assert(await page.locator('.entry-role-tile').count() === 12, `${item.name} ${locale}: role tile count is not 12`);
      assert(await page.locator('a.entry-role-tile').count() === 0, `${item.name} ${locale}: role tiles remain authoritative links`);
      assert(await page.locator('.entry-role-access-cta[href="/platform-v7/login"]').count() === 1, `${item.name} ${locale}: unified login CTA missing`);
      assert(!bodyText.includes('DL-9102'), `${item.name} ${locale}: fake deal ID visible`);
      assert(await page.locator('.entry-footer').count() === 1, `${item.name} ${locale}: footer missing`);

      const menu = page.locator('.pc-site-mobile-menu');
      if (item.mobile) {
        assert(await menu.isVisible(), `${item.name} ${locale}: mobile menu missing`);
        await menu.locator('summary').click();
        assert(await menu.getAttribute('open') !== null, `${item.name} ${locale}: mobile menu did not open`);
        assert(await menu.locator('.pc-site-mobile-nav a').count() >= 5, `${item.name} ${locale}: mobile navigation incomplete`);
      } else {
        assert(!(await menu.isVisible()), `${item.name} ${locale}: mobile menu visible on desktop`);
        assert(await page.locator('.pc-site-nav').isVisible(), `${item.name} ${locale}: desktop navigation hidden`);
      }

      result.checks = {
        heroActions: await heroActions.count(),
        roleTiles: await page.locator('.entry-role-tile').count(),
        roleTileLinks: await page.locator('a.entry-role-tile').count(),
        unifiedLoginCta: await page.locator('.entry-role-access-cta').count(),
        mobileMenuVisible: await menu.isVisible(),
        footer: await page.locator('.entry-footer').count(),
      };
    } else {
      assert(await page.locator('.pc-auth-card').count() === 1, `${item.name} ${locale}: login card missing`);
      assert(await page.locator('#pc-auth-email[name="email"][autocomplete="username"]').count() === 1, `${item.name} ${locale}: email semantics invalid`);
      assert(await page.locator('#pc-auth-password[name="password"][autocomplete="current-password"]').count() === 1, `${item.name} ${locale}: password semantics invalid`);
      assert(await page.locator('[data-step="password"] .pc-auth-assurance span').count() === 3, `${item.name} ${locale}: assurance rail incomplete`);
      assert(await page.locator('select, [data-role-selector], [name="role"]').count() === 0, `${item.name} ${locale}: role selector found`);
      assert(await page.locator('#pc-auth-email').getAttribute('placeholder') === null, `${item.name} ${locale}: email relies on placeholder`);
      assert(await page.locator('#pc-auth-password').getAttribute('placeholder') === null, `${item.name} ${locale}: password relies on placeholder`);

      await page.locator('#pc-auth-email').fill('invalid');
      await page.locator('#pc-auth-password').fill('x');
      await page.locator('.pc-auth-submit').click();
      await page.locator('#pc-auth-error').waitFor({ state: 'visible', timeout: 10_000 });
      assert(await page.locator('#pc-auth-email').getAttribute('aria-invalid') === 'true', `${item.name} ${locale}: invalid email not associated with field`);

      result.checks = {
        loginCard: await page.locator('.pc-auth-card').count(),
        assuranceItems: await page.locator('.pc-auth-assurance span').count(),
        roleSelectors: await page.locator('select, [data-role-selector], [name="role"]').count(),
        fieldErrorLinked: await page.locator('#pc-auth-email').getAttribute('aria-errormessage'),
      };
    }

    await page.waitForTimeout(250);
    assert(diagnostics.consoleErrors.length === 0, `${item.name} ${route.key} ${locale}: console errors ${JSON.stringify(diagnostics.consoleErrors)}`);
    assert(diagnostics.runtimeErrors.length === 0, `${item.name} ${route.key} ${locale}: runtime errors ${JSON.stringify(diagnostics.runtimeErrors)}`);
    assert(diagnostics.failedRequests.length === 0, `${item.name} ${route.key} ${locale}: failed requests ${JSON.stringify(diagnostics.failedRequests)}`);
    assert(diagnostics.badResponses.length === 0, `${item.name} ${route.key} ${locale}: bad responses ${JSON.stringify(diagnostics.badResponses)}`);

    await page.screenshot({ path: path.join(OUT, `${item.name}-${route.key}-${locale}.png`), fullPage: true });
    result.outcome = 'passed';
  } catch (error) {
    result.failure = error instanceof Error ? error.message : String(error);
    await page.screenshot({ path: path.join(OUT, `${item.name}-${route.key}-${locale}-failed.png`), fullPage: true }).catch(() => {});
  } finally {
    await context.close();
    await browser.close();
  }

  return result;
}

async function runLanguageCycle() {
  const browser = await webkit.launch({ headless: true });
  const context = await browser.newContext(devices['iPhone 13']);
  await context.addCookies([{ name: 'pc-v7-locale', value: 'zh', domain: new URL(BASE_URL).hostname, path: '/', secure: true, sameSite: 'Lax' }]);
  const page = await context.newPage();
  const cycle = { outcome: 'failed', steps: [], failure: null };
  try {
    const start = new URL('/platform-v7', BASE_URL);
    start.searchParams.set('lang', 'ru');
    await page.goto(start.toString(), { waitUntil: 'networkidle', timeout: 90_000 });
    for (const target of ['en', 'zh', 'ru']) {
      const switcher = page.locator('.pc-site-locale-switch');
      assert(await switcher.getAttribute('data-next-locale') === target, `language cycle expected ${target}`);
      await Promise.all([
        page.waitForURL((url) => url.searchParams.get('lang') === target, { timeout: 45_000 }),
        switcher.click(),
      ]);
      await page.waitForLoadState('networkidle');
      assert((await page.locator('html').getAttribute('lang'))?.startsWith(target), `language cycle html lang did not reach ${target}`);
      assert(await page.locator('.pc-site-locale-switch').getAttribute('data-current-locale') === target, `language switch did not reach ${target}`);
      cycle.steps.push({ target, url: page.url() });
    }
    cycle.outcome = 'passed';
  } catch (error) {
    cycle.failure = error instanceof Error ? error.message : String(error);
  } finally {
    await context.close();
    await browser.close();
  }
  return cycle;
}

await fs.mkdir(OUT, { recursive: true });
const results = [];
for (const item of matrix) {
  for (const route of routes) {
    for (const locale of locales) results.push(await runCase(item, route, locale));
  }
}
const languageCycle = await runLanguageCycle();
const report = {
  baseUrl: BASE_URL,
  implementation: IMPLEMENTATION_SHA,
  deployId: DEPLOY_ID,
  generatedAt: new Date().toISOString(),
  results,
  languageCycle,
  summary: {
    cases: results.length,
    passed: results.filter((result) => result.outcome === 'passed').length,
    failed: results.filter((result) => result.outcome !== 'passed').length,
    axeSerious: results.reduce((sum, result) => sum + result.axe.serious, 0),
    axeCritical: results.reduce((sum, result) => sum + result.axe.critical, 0),
    productConsoleErrors: results.reduce((sum, result) => sum + result.diagnostics.consoleErrors.length, 0),
    runtimeErrors: results.reduce((sum, result) => sum + result.diagnostics.runtimeErrors.length, 0),
    failedRequests: results.reduce((sum, result) => sum + result.diagnostics.failedRequests.length, 0),
    badResponses: results.reduce((sum, result) => sum + result.diagnostics.badResponses.length, 0),
    previewToolbarNoise: results.reduce((sum, result) => sum + result.diagnostics.previewToolbarNoise.length, 0),
    languageCycle: languageCycle.outcome,
  },
};
await fs.writeFile(path.join(OUT, 'browser-accessibility-report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report.summary, null, 2));
if (report.summary.failed || languageCycle.outcome !== 'passed') process.exitCode = 1;
