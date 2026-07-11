import fs from 'node:fs';
import path from 'node:path';
import { chromium, webkit } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const baseURL = process.env.PRODUCTION_BASE_URL;
const artifactDir = path.resolve(process.cwd(), process.env.ARTIFACT_DIR || '../../artifacts/public-entry-production-smoke-bf32ecc');
if (!baseURL) throw new Error('PRODUCTION_BASE_URL is required');
fs.mkdirSync(artifactDir, { recursive: true });

const expectedCommit = process.env.EXPECTED_PRODUCTION_COMMIT || '';
const deployId = process.env.EXPECTED_DEPLOY_ID || '';
const routes = [
  { key: 'landing', path: '/platform-v7' },
  { key: 'login', path: '/platform-v7/login' },
  { key: 'recovery', path: '/platform-v7/forgot-password' },
];
const locales = ['ru', 'en', 'zh'];
const projects = [
  { name: 'chromium-desktop-1440', type: chromium, options: { viewport: { width: 1440, height: 1000 } }, mobile: false },
  { name: 'chromium-mobile-390', type: chromium, options: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, mobile: true },
  { name: 'webkit-iphone-13', type: webkit, options: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, mobile: true },
];

const report = {
  generatedAt: new Date().toISOString(),
  baseURL,
  expectedCommit,
  deployId,
  cases: [],
  localeCycles: [],
  failClosedLogin: null,
  failures: [],
};

const save = () => fs.writeFileSync(path.join(artifactDir, 'production-smoke-report.json'), JSON.stringify(report, null, 2));
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const sameOrigin = (url) => { try { return new URL(url).origin === new URL(baseURL).origin; } catch { return false; } };

async function inspectCase(project, route, locale) {
  const browser = await project.type.launch({ headless: true });
  const context = await browser.newContext({ ...project.options, locale: locale === 'zh' ? 'zh-CN' : locale === 'en' ? 'en-US' : 'ru-RU' });
  const page = await context.newPage();
  const result = {
    project: project.name,
    route: route.key,
    locale,
    status: null,
    finalUrl: '',
    consoleErrors: [],
    pageErrors: [],
    failedRequests: [],
    badResponses: [],
    axe: [],
    checks: {},
  };

  page.on('console', (message) => { if (message.type() === 'error') result.consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => result.pageErrors.push(String(error?.stack || error)));
  page.on('requestfailed', (request) => {
    const failure = request.failure()?.errorText || 'unknown';
    if (!failure.includes('ERR_ABORTED')) result.failedRequests.push({ url: request.url(), failure });
  });
  page.on('response', (response) => {
    if (sameOrigin(response.url()) && response.status() >= 400) result.badResponses.push({ url: response.url(), status: response.status() });
  });

  try {
    const response = await page.goto(`${baseURL}${route.path}?lang=${locale}`, { waitUntil: 'networkidle', timeout: 45_000 });
    result.status = response?.status() ?? null;
    result.finalUrl = page.url();
    assert(result.status === 200, `HTTP ${result.status}`);
    assert(!page.url().includes('role='), 'role leaked into URL');

    const bodyText = (await page.locator('body').innerText()).trim();
    const htmlLang = await page.locator('html').getAttribute('lang');
    const minimumTextLength = locale === 'zh' ? 80 : 120;
    assert(htmlLang?.startsWith(locale), `html lang mismatch (${htmlLang})`);
    assert(bodyText.length >= minimumTextLength, `probable blank screen (${bodyText.length}/${minimumTextLength})`);

    const header = page.locator('.pc-site-header');
    await header.waitFor({ state: 'visible', timeout: 15_000 });
    assert(await header.evaluate((node) => getComputedStyle(node).position) === 'fixed', 'header is not fixed');

    const layout = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      localStorageKeys: Object.keys(localStorage),
      sessionStorageKeys: Object.keys(sessionStorage),
    }));
    const registrations = await page.evaluate(async () => ('serviceWorker' in navigator ? (await navigator.serviceWorker.getRegistrations()).length : 0));
    assert(registrations === 0, `unexpected service worker registrations ${registrations}`);
    assert(layout.scrollWidth <= layout.clientWidth + 1, `horizontal overflow ${layout.scrollWidth}/${layout.clientWidth}`);
    assert(![...layout.localStorageKeys, ...layout.sessionStorageKeys].some((key) => /role|demo|cabinet/i.test(key)), 'client authority residue detected');

    const brokenImages = await page.locator('img').evaluateAll((images) => images.filter((image) => !image.complete || image.naturalWidth === 0).map((image) => image.getAttribute('src')));
    assert(brokenImages.length === 0, `broken images ${JSON.stringify(brokenImages)}`);
    assert(await page.locator('.pc-site-locale-switch').getAttribute('data-current-locale') === locale, 'locale switch state mismatch');

    const axe = await new AxeBuilder({ page }).analyze();
    result.axe = axe.violations
      .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
      .map((violation) => ({ id: violation.id, impact: violation.impact, help: violation.help, nodes: violation.nodes.length }));
    assert(result.axe.length === 0, `Axe blockers ${JSON.stringify(result.axe)}`);

    if (route.key === 'landing') {
      assert(await page.locator('.entry-hero-actions a').count() === 2, 'hero CTA count is not 2');
      assert(await page.locator('.entry-role-tile').count() === 12, 'role tile count is not 12');
      assert(await page.locator('a.entry-role-tile').count() === 0, 'role tiles remain authoritative links');
      assert(await page.locator('.entry-role-access-cta[href="/platform-v7/login"]').count() === 1, 'unified login CTA missing');
      assert(!bodyText.includes('DL-9102'), 'fake deal ID visible');
      assert(await page.locator('.entry-footer').count() === 1, 'footer missing');
      assert(await page.locator('select[name*="role" i], [data-role-selector], [aria-label*="role" i]').count() === 0, 'role selector visible');
      const menu = page.locator('.pc-site-mobile-menu');
      if (project.mobile) {
        assert(await menu.isVisible(), 'mobile menu missing');
        await menu.locator('summary').click();
        assert(await menu.getAttribute('open') !== null, 'mobile menu did not open');
        assert(await menu.locator('.pc-site-mobile-nav a').count() >= 5, 'mobile navigation incomplete');
      } else {
        assert(!(await menu.isVisible()), 'mobile menu visible on desktop');
        assert(await page.locator('.pc-site-nav').isVisible(), 'desktop navigation hidden');
      }
      result.checks = { heroActions: 2, roleTiles: 12, unifiedLogin: 1, footer: 1 };
    }

    if (route.key === 'login') {
      assert(await page.locator('#pc-auth-email[type="email"][autocomplete="username"]').count() === 1, 'email semantics missing');
      assert(await page.locator('#pc-auth-password[type="password"][autocomplete="current-password"]').count() === 1, 'password semantics missing');
      assert(await page.locator('.pc-auth-assurance span').count() === 3, 'assurance rail incomplete');
      assert(await page.locator('select[name*="role" i], [data-role-selector]').count() === 0, 'role selector visible on login');
      result.checks = { email: 1, password: 1, assuranceItems: 3, roleSelectors: 0 };
    }

    if (route.key === 'recovery') {
      assert(await page.locator('.pc-recovery-card input[type="email"]').count() === 1, 'recovery email missing');
      await page.locator('.pc-recovery-submit').click();
      assert(await page.locator('.pc-recovery-error[role="alert"]').isVisible(), 'recovery validation missing');
      result.checks = { email: 1, clientValidation: true };
    }

    assert(result.consoleErrors.length === 0, `console errors ${JSON.stringify(result.consoleErrors)}`);
    assert(result.pageErrors.length === 0, `page errors ${JSON.stringify(result.pageErrors)}`);
    assert(result.failedRequests.length === 0, `failed requests ${JSON.stringify(result.failedRequests)}`);
    assert(result.badResponses.length === 0, `bad responses ${JSON.stringify(result.badResponses)}`);

    await page.screenshot({ path: path.join(artifactDir, `${project.name}-${route.key}-${locale}.png`), fullPage: true });
    report.cases.push(result);
  } catch (error) {
    result.error = String(error?.stack || error);
    report.failures.push(result);
    await page.screenshot({ path: path.join(artifactDir, `${project.name}-${route.key}-${locale}-failed.png`), fullPage: true }).catch(() => {});
  } finally {
    save();
    await browser.close();
  }
}

async function localeCycle(type, name, options) {
  const browser = await type.launch({ headless: true });
  const context = await browser.newContext(options);
  const page = await context.newPage();
  const sequence = [];
  try {
    await page.goto(`${baseURL}/platform-v7?lang=ru`, { waitUntil: 'networkidle', timeout: 45_000 });
    for (let index = 0; index < 4; index += 1) {
      const expected = ['ru', 'en', 'zh', 'ru'][index];
      const current = await page.locator('.pc-site-locale-switch').getAttribute('data-current-locale');
      sequence.push(current);
      assert(current === expected, `${name}: expected ${expected}, received ${current}`);
      if (index < 3) {
        await page.locator('.pc-site-locale-switch').click();
        await page.waitForLoadState('networkidle');
      }
    }
    report.localeCycles.push({ name, sequence });
  } catch (error) {
    report.failures.push({ project: name, route: 'locale-cycle', error: String(error?.stack || error), sequence });
  } finally {
    save();
    await browser.close();
  }
}

async function failClosedLogin() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  try {
    await page.goto(`${baseURL}/platform-v7/login?lang=ru`, { waitUntil: 'networkidle', timeout: 45_000 });
    await page.locator('#pc-auth-email').fill('production-smoke@example.invalid');
    await page.locator('#pc-auth-password').fill('not-a-real-password');
    const responsePromise = page.waitForResponse((response) => response.url().endsWith('/api/auth/login') && response.request().method() === 'POST');
    await page.locator('.pc-auth-submit').click();
    const response = await responsePromise;
    await page.locator('.pc-auth-error').waitFor({ state: 'visible', timeout: 15_000 });
    const authCookies = (await context.cookies()).filter((cookie) => /access|refresh|session|cabinet|mfa/i.test(cookie.name));
    assert(response.status() === 503, `expected 503, received ${response.status()}`);
    assert(page.url().includes('/platform-v7/login'), 'redirected away from login');
    assert(authCookies.length === 0, `auth cookies issued ${authCookies.map((cookie) => cookie.name).join(',')}`);
    report.failClosedLogin = { status: response.status(), authCookies: [], remainedOnLogin: true };
    await page.screenshot({ path: path.join(artifactDir, 'fail-closed-login.png'), fullPage: true });
  } catch (error) {
    report.failures.push({ project: 'chromium-mobile-390', route: 'fail-closed-login', error: String(error?.stack || error) });
  } finally {
    save();
    await browser.close();
  }
}

for (const project of projects) {
  for (const route of routes) {
    for (const locale of locales) await inspectCase(project, route, locale);
  }
}
await localeCycle(chromium, 'chromium-desktop-locale-cycle', { viewport: { width: 1440, height: 1000 } });
await localeCycle(webkit, 'webkit-iphone-locale-cycle', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await failClosedLogin();

save();
console.log(JSON.stringify({ cases: report.cases.length, failures: report.failures.length, localeCycles: report.localeCycles, failClosedLogin: report.failClosedLogin }, null, 2));
if (report.failures.length > 0) throw new Error(`Production smoke failures: ${report.failures.map((failure) => `${failure.project}/${failure.route}/${failure.locale || ''}: ${failure.error}`).join(' | ')}`);
