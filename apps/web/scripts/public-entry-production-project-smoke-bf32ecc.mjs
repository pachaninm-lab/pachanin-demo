import fs from 'node:fs';
import path from 'node:path';
import { chromium, webkit } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const baseURL = process.env.PRODUCTION_BASE_URL;
const projectName = process.env.PROJECT_FILTER;
const artifactDir = path.resolve(process.cwd(), process.env.ARTIFACT_DIR || `../../artifacts/public-entry-production-${projectName}`);
if (!baseURL || !projectName) throw new Error('PRODUCTION_BASE_URL and PROJECT_FILTER are required');
fs.mkdirSync(artifactDir, { recursive: true });

const projects = {
  'chromium-desktop-1440': {
    type: chromium,
    options: { viewport: { width: 1440, height: 1000 } },
    mobile: false,
  },
  'chromium-mobile-390': {
    type: chromium,
    options: {
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      userAgent: 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Mobile Safari/537.36',
    },
    mobile: true,
  },
  'webkit-iphone-13': {
    type: webkit,
    options: {
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
    },
    mobile: true,
  },
};
const project = projects[projectName];
if (!project) throw new Error(`Unknown project ${projectName}`);

const routes = [
  { key: 'landing', path: '/platform-v7' },
  { key: 'login', path: '/platform-v7/login' },
  { key: 'recovery', path: '/platform-v7/forgot-password' },
];
const locales = ['ru', 'en', 'zh'];
const report = { project: projectName, cases: [], failures: [] };
const save = () => fs.writeFileSync(path.join(artifactDir, `${projectName}-report.json`), JSON.stringify(report, null, 2));
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const sameOrigin = (url) => { try { return new URL(url).origin === new URL(baseURL).origin; } catch { return false; } };

async function runCase(route, locale) {
  const browser = await project.type.launch({ headless: true });
  const context = await browser.newContext({ ...project.options, locale: locale === 'zh' ? 'zh-CN' : locale === 'en' ? 'en-US' : 'ru-RU' });
  const page = await context.newPage();
  const result = { route: route.key, locale, status: null, consoleErrors: [], pageErrors: [], failedRequests: [], badResponses: [], axe: [], checks: {} };
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
    assert(result.status === 200, `HTTP ${result.status}`);
    assert(!page.url().includes('role='), 'role leaked into URL');
    const bodyText = (await page.locator('body').innerText()).trim();
    const htmlLang = await page.locator('html').getAttribute('lang');
    assert(htmlLang?.startsWith(locale), `html lang mismatch ${htmlLang}`);
    assert(bodyText.length >= (locale === 'zh' ? 80 : 120), `probable blank screen ${bodyText.length}`);
    const header = page.locator('.pc-site-header');
    await header.waitFor({ state: 'visible' });
    assert(await header.evaluate((node) => getComputedStyle(node).position) === 'fixed', 'header is not fixed');
    const layout = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth, localStorageKeys: Object.keys(localStorage), sessionStorageKeys: Object.keys(sessionStorage) }));
    assert(layout.scrollWidth <= layout.clientWidth + 1, `horizontal overflow ${layout.scrollWidth}/${layout.clientWidth}`);
    assert(![...layout.localStorageKeys, ...layout.sessionStorageKeys].some((key) => /role|demo|cabinet/i.test(key)), 'client authority residue');
    const serviceWorkers = await page.evaluate(async () => ('serviceWorker' in navigator ? (await navigator.serviceWorker.getRegistrations()).length : 0));
    assert(serviceWorkers === 0, `service worker registrations ${serviceWorkers}`);
    const brokenImages = await page.locator('img').evaluateAll((images) => images.filter((image) => !image.complete || image.naturalWidth === 0).map((image) => image.getAttribute('src')));
    assert(brokenImages.length === 0, `broken images ${JSON.stringify(brokenImages)}`);
    assert(await page.locator('.pc-site-locale-switch').getAttribute('data-current-locale') === locale, 'locale switch mismatch');

    const axe = await new AxeBuilder({ page }).analyze();
    result.axe = axe.violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical').map((violation) => ({ id: violation.id, impact: violation.impact, nodes: violation.nodes.length }));
    assert(result.axe.length === 0, `Axe blockers ${JSON.stringify(result.axe)}`);

    if (route.key === 'landing') {
      assert(await page.locator('.entry-hero-actions a').count() === 2, 'hero CTA count');
      assert(await page.locator('.entry-role-tile').count() === 12, 'role tile count');
      assert(await page.locator('a.entry-role-tile').count() === 0, 'role tiles are links');
      assert(await page.locator('.entry-role-access-cta[href="/platform-v7/login"]').count() === 1, 'unified login missing');
      assert(!bodyText.includes('DL-9102'), 'fake deal ID');
      assert(await page.locator('.entry-footer').count() === 1, 'footer missing');
      assert(await page.locator('select[name*="role" i], [data-role-selector], [aria-label*="role" i]').count() === 0, 'role selector visible');
      const menu = page.locator('.pc-site-mobile-menu');
      if (project.mobile) {
        assert(await menu.isVisible(), 'mobile menu missing');
        await menu.locator('summary').click();
        assert(await menu.getAttribute('open') !== null, 'mobile menu did not open');
      } else {
        assert(!(await menu.isVisible()), 'mobile menu visible on desktop');
        assert(await page.locator('.pc-site-nav').isVisible(), 'desktop nav hidden');
      }
    }
    if (route.key === 'login') {
      assert(await page.locator('#pc-auth-email[type="email"][autocomplete="username"]').count() === 1, 'email semantics');
      assert(await page.locator('#pc-auth-password[type="password"][autocomplete="current-password"]').count() === 1, 'password semantics');
      assert(await page.locator('.pc-auth-assurance span').count() === 3, 'assurance rail');
      assert(await page.locator('select[name*="role" i], [data-role-selector]').count() === 0, 'role selector on login');
    }
    if (route.key === 'recovery') {
      assert(await page.locator('.pc-recovery-card input[type="email"]').count() === 1, 'recovery email');
      await page.locator('.pc-recovery-submit').click();
      assert(await page.locator('.pc-recovery-error[role="alert"]').isVisible(), 'recovery validation');
    }

    assert(result.consoleErrors.length === 0, `console errors ${JSON.stringify(result.consoleErrors)}`);
    assert(result.pageErrors.length === 0, `page errors ${JSON.stringify(result.pageErrors)}`);
    assert(result.failedRequests.length === 0, `failed requests ${JSON.stringify(result.failedRequests)}`);
    assert(result.badResponses.length === 0, `bad responses ${JSON.stringify(result.badResponses)}`);
    await page.screenshot({ path: path.join(artifactDir, `${projectName}-${route.key}-${locale}.png`), fullPage: true });
    report.cases.push(result);
  } catch (error) {
    result.error = String(error?.stack || error);
    report.failures.push(result);
    await page.screenshot({ path: path.join(artifactDir, `${projectName}-${route.key}-${locale}-failed.png`), fullPage: true }).catch(() => {});
  } finally {
    save();
    await browser.close();
  }
}

for (const route of routes) for (const locale of locales) await runCase(route, locale);
save();
console.log(JSON.stringify({ project: projectName, cases: report.cases.length, failures: report.failures.length }, null, 2));
if (report.failures.length) throw new Error(report.failures.map((failure) => `${failure.route}/${failure.locale}: ${failure.error}`).join(' | '));
