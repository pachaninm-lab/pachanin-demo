import fs from 'node:fs';
import path from 'node:path';
import { chromium, webkit } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const baseURL = process.env.PRODUCTION_BASE_URL;
const artifactDir = path.resolve(process.cwd(), process.env.ARTIFACT_DIR || '../../artifacts/public-entry-production-smoke-bf32ecc');
const expectedCommit = process.env.EXPECTED_PRODUCTION_COMMIT || '';
const deployId = process.env.EXPECTED_DEPLOY_ID || '';

if (!baseURL) throw new Error('PRODUCTION_BASE_URL is required');
fs.mkdirSync(artifactDir, { recursive: true });

const routes = [
  { key: 'landing', path: '/platform-v7' },
  { key: 'login', path: '/platform-v7/login' },
  { key: 'recovery', path: '/platform-v7/forgot-password' },
];
const locales = ['ru', 'en', 'zh'];
const projects = [
  { name: 'chromium-desktop-1440', browserType: chromium, viewport: { width: 1440, height: 1000 }, mobile: false },
  { name: 'chromium-mobile-390', browserType: chromium, viewport: { width: 390, height: 844 }, mobile: true, isMobile: true, hasTouch: true },
  { name: 'webkit-iphone-13', browserType: webkit, viewport: { width: 390, height: 844 }, mobile: true, isMobile: true, hasTouch: true },
];

const report = {
  generatedAt: new Date().toISOString(),
  baseURL,
  expectedCommit,
  deployId,
  cases: [],
  localeCycles: [],
  failClosedLogin: null,
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sameOrigin(url) {
  try { return new URL(url).origin === new URL(baseURL).origin; } catch { return false; }
}

async function inspectPage(page, item, route, locale) {
  const result = {
    project: item.name,
    route: route.key,
    locale,
    url: '',
    status: null,
    axe: { serious: 0, critical: 0, violations: [] },
    consoleErrors: [],
    pageErrors: [],
    failedRequests: [],
    badResponses: [],
    checks: {},
  };

  page.on('console', (message) => {
    if (message.type() === 'error') result.consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => result.pageErrors.push(String(error?.stack || error)));
  page.on('requestfailed', (request) => {
    const failure = request.failure()?.errorText || 'unknown';
    if (!failure.includes('ERR_ABORTED')) result.failedRequests.push({ url: request.url(), failure });
  });
  page.on('response', (response) => {
    if (sameOrigin(response.url()) && response.status() >= 400) {
      result.badResponses.push({ url: response.url(), status: response.status() });
    }
  });

  const response = await page.goto(`${baseURL}${route.path}?lang=${locale}`, { waitUntil: 'networkidle', timeout: 45_000 });
  result.status = response?.status() ?? null;
  result.url = page.url();
  assert(result.status === 200, `${item.name} ${route.key} ${locale}: HTTP ${result.status}`);
  assert(!page.url().includes('role='), `${item.name} ${route.key} ${locale}: role leaked into URL`);

  const bodyText = await page.locator('body').innerText();
  const htmlLang = await page.locator('html').getAttribute('lang');
  assert(htmlLang?.startsWith(locale), `${item.name} ${route.key} ${locale}: html lang mismatch (${htmlLang})`);
  assert(bodyText.trim().length > 120, `${item.name} ${route.key} ${locale}: probable blank screen`);

  const header = page.locator('.pc-site-header');
  await header.waitFor({ state: 'visible', timeout: 15_000 });
  assert(await header.evaluate((node) => getComputedStyle(node).position) === 'fixed', `${item.name} ${route.key} ${locale}: header is not fixed`);

  const layout = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    serviceWorkers: 'serviceWorker' in navigator ? null : 0,
    localStorageKeys: Object.keys(localStorage),
    sessionStorageKeys: Object.keys(sessionStorage),
  }));
  if ('serviceWorker' in await page.evaluate(() => navigator)) {
    // Intentionally left to the explicit registration check below.
  }
  const registrations = await page.evaluate(async () => ('serviceWorker' in navigator ? (await navigator.serviceWorker.getRegistrations()).length : 0));
  assert(registrations === 0, `${item.name} ${route.key} ${locale}: unexpected service worker registrations ${registrations}`);
  assert(layout.scrollWidth <= layout.clientWidth + 1, `${item.name} ${route.key} ${locale}: horizontal overflow ${layout.scrollWidth}/${layout.clientWidth}`);
  assert(![...layout.localStorageKeys, ...layout.sessionStorageKeys].some((key) => /role|demo|cabinet/i.test(key)), `${item.name} ${route.key} ${locale}: client authority residue detected`);

  const brokenImages = await page.locator('img').evaluateAll((images) => images.filter((image) => !image.complete || image.naturalWidth === 0).map((image) => image.getAttribute('src')));
  assert(brokenImages.length === 0, `${item.name} ${route.key} ${locale}: broken images ${JSON.stringify(brokenImages)}`);

  const localeSwitch = page.locator('.pc-site-locale-switch');
  assert(await localeSwitch.getAttribute('data-current-locale') === locale, `${item.name} ${route.key} ${locale}: locale switch state mismatch`);

  const axe = await new AxeBuilder({ page }).analyze();
  const blocking = axe.violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical');
  result.axe.serious = axe.violations.filter((violation) => violation.impact === 'serious').length;
  result.axe.critical = axe.violations.filter((violation) => violation.impact === 'critical').length;
  result.axe.violations = blocking.map((violation) => ({ id: violation.id, impact: violation.impact, help: violation.help, nodes: violation.nodes.length }));
  assert(blocking.length === 0, `${item.name} ${route.key} ${locale}: Axe blockers ${JSON.stringify(result.axe.violations)}`);

  if (route.key === 'landing') {
    assert(await page.locator('.entry-hero-actions a').count() === 2, `${item.name} ${locale}: hero CTA count is not 2`);
    assert(await page.locator('.entry-role-tile').count() === 12, `${item.name} ${locale}: role tile count is not 12`);
    assert(await page.locator('a.entry-role-tile').count() === 0, `${item.name} ${locale}: role tiles remain authoritative links`);
    assert(await page.locator('.entry-role-access-cta[href="/platform-v7/login"]').count() === 1, `${item.name} ${locale}: unified login CTA missing`);
    assert(!bodyText.includes('DL-9102'), `${item.name} ${locale}: fake deal ID visible`);
    assert(await page.locator('.entry-footer').count() === 1, `${item.name} ${locale}: footer missing`);
    assert(await page.locator('select[name*="role" i], [data-role-selector], [aria-label*="role" i]').count() === 0, `${item.name} ${locale}: role selector visible`);
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
    result.checks = { heroActions: 2, roleTiles: 12, unifiedLogin: 1, footer: 1 };
  }

  if (route.key === 'login') {
    assert(await page.locator('#pc-auth-email[type="email"][autocomplete="username"]').count() === 1, `${item.name} ${locale}: email semantics missing`);
    assert(await page.locator('#pc-auth-password[type="password"][autocomplete="current-password"]').count() === 1, `${item.name} ${locale}: password semantics missing`);
    assert(await page.locator('.pc-auth-assurance span').count() === 3, `${item.name} ${locale}: assurance rail incomplete`);
    assert(await page.locator('select[name*="role" i], [data-role-selector]').count() === 0, `${item.name} ${locale}: role selector visible on login`);
    result.checks = { email: 1, password: 1, assuranceItems: 3, roleSelectors: 0 };
  }

  if (route.key === 'recovery') {
    assert(await page.locator('.pc-recovery-card input[type="email"]').count() === 1, `${item.name} ${locale}: recovery email missing`);
    await page.locator('.pc-recovery-submit').click();
    assert(await page.locator('.pc-recovery-error[role="alert"]').isVisible(), `${item.name} ${locale}: recovery validation missing`);
    result.checks = { email: 1, clientValidation: true };
  }

  assert(result.consoleErrors.length === 0, `${item.name} ${route.key} ${locale}: console errors ${JSON.stringify(result.consoleErrors)}`);
  assert(result.pageErrors.length === 0, `${item.name} ${route.key} ${locale}: page errors ${JSON.stringify(result.pageErrors)}`);
  assert(result.failedRequests.length === 0, `${item.name} ${route.key} ${locale}: failed requests ${JSON.stringify(result.failedRequests)}`);
  assert(result.badResponses.length === 0, `${item.name} ${route.key} ${locale}: bad responses ${JSON.stringify(result.badResponses)}`);

  await page.screenshot({ path: path.join(artifactDir, `${item.name}-${route.key}-${locale}.png`), fullPage: true });
  return result;
}

async function checkLocaleCycle(browserType, name, options) {
  const browser = await browserType.launch({ headless: true });
  const context = await browser.newContext(options);
  const page = await context.newPage();
  const sequence = [];
  await page.goto(`${baseURL}/platform-v7?lang=ru`, { waitUntil: 'networkidle', timeout: 45_000 });
  for (const expected of ['ru', 'en', 'zh', 'ru']) {
    await page.waitForLoadState('networkidle');
    const current = await page.locator('.pc-site-locale-switch').getAttribute('data-current-locale');
    sequence.push(current);
    assert(current === expected, `${name}: locale cycle expected ${expected}, received ${current}`);
    if (expected !== 'ru' || sequence.length === 1) await page.locator('.pc-site-locale-switch').click();
  }
  report.localeCycles.push({ name, sequence });
  await browser.close();
}

async function checkFailClosedLogin() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.goto(`${baseURL}/platform-v7/login?lang=ru`, { waitUntil: 'networkidle', timeout: 45_000 });
  await page.locator('#pc-auth-email').fill('production-smoke@example.invalid');
  await page.locator('#pc-auth-password').fill('not-a-real-password');
  const responsePromise = page.waitForResponse((response) => response.url().endsWith('/api/auth/login') && response.request().method() === 'POST');
  await page.locator('.pc-auth-submit').click();
  const response = await responsePromise;
  await page.locator('.pc-auth-error').waitFor({ state: 'visible', timeout: 15_000 });
  const cookies = await context.cookies();
  const authCookies = cookies.filter((cookie) => /access|refresh|session|cabinet|mfa/i.test(cookie.name));
  assert(response.status() === 503, `fail-closed login expected 503, received ${response.status()}`);
  assert(page.url().includes('/platform-v7/login'), 'fail-closed login redirected away from login');
  assert(authCookies.length === 0, `fail-closed login issued auth cookies ${authCookies.map((cookie) => cookie.name).join(',')}`);
  report.failClosedLogin = { status: response.status(), authCookies: [], remainedOnLogin: true };
  await page.screenshot({ path: path.join(artifactDir, 'fail-closed-login.png'), fullPage: true });
  await browser.close();
}

for (const item of projects) {
  const browser = await item.browserType.launch({ headless: true });
  const context = await browser.newContext({ viewport: item.viewport, isMobile: item.isMobile, hasTouch: item.hasTouch, locale: 'ru-RU' });
  for (const route of routes) {
    for (const locale of locales) {
      const page = await context.newPage();
      try {
        report.cases.push(await inspectPage(page, item, route, locale));
      } finally {
        await page.close();
      }
    }
  }
  await browser.close();
}

await checkLocaleCycle(chromium, 'chromium-desktop-locale-cycle', { viewport: { width: 1440, height: 1000 } });
await checkLocaleCycle(webkit, 'webkit-iphone-locale-cycle', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await checkFailClosedLogin();

fs.writeFileSync(path.join(artifactDir, 'production-smoke-report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ cases: report.cases.length, localeCycles: report.localeCycles, failClosedLogin: report.failClosedLogin }, null, 2));
