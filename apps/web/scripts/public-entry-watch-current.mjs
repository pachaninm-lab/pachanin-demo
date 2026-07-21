import fs from 'node:fs';
import path from 'node:path';
import { chromium, webkit } from '@playwright/test';

const baseURL = 'https://xn----8sbjf4befbjgs9b.xn--p1ai';
const outputDir = path.resolve(process.cwd(), '../../artifacts/public-entry-watch');
fs.mkdirSync(outputDir, { recursive: true });

const routes = [
  '/platform-v7',
  '/platform-v7/login',
  '/platform-v7/forgot-password',
];
const locales = ['ru', 'en', 'zh'];
const projects = [
  { name: 'chromium-desktop', browser: chromium, viewport: { width: 1440, height: 1000 } },
  { name: 'chromium-mobile-390', browser: chromium, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
  { name: 'webkit-iphone', browser: webkit, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
];

const report = {
  schemaVersion: 1,
  checkedAt: new Date().toISOString(),
  baseURL,
  cases: [],
  failClosedLogin: null,
  failures: [],
  pass: false,
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function normalizePath(value) {
  const pathname = new URL(value).pathname.replace(/\/$/, '');
  return pathname || '/';
}

function isProductConsoleError(text) {
  return ![
    'favicon.ico',
    'Failed to load resource: the server responded with a status of 404',
  ].some((known) => text.includes(known));
}

async function inspectRoute(project, locale, route) {
  const browser = await project.browser.launch({ headless: true });
  const context = await browser.newContext({
    viewport: project.viewport,
    isMobile: project.isMobile,
    hasTouch: project.hasTouch,
    locale: locale === 'ru' ? 'ru-RU' : locale === 'zh' ? 'zh-CN' : 'en-US',
  });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  const badResponses = [];
  const documentRequests = [];

  page.on('console', (message) => {
    if (message.type() === 'error' && isProductConsoleError(message.text())) consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(String(error?.stack || error)));
  page.on('request', (request) => {
    if (request.resourceType() === 'document') documentRequests.push(request.url());
  });
  page.on('requestfailed', (request) => {
    const failure = request.failure()?.errorText || 'unknown';
    if (!failure.includes('ERR_ABORTED')) failedRequests.push({ url: request.url(), failure });
  });
  page.on('response', (response) => {
    if (response.url().startsWith(baseURL) && response.status() >= 400 && !response.url().includes('/favicon')) {
      badResponses.push({ url: response.url(), status: response.status() });
    }
  });

  const url = `${baseURL}${route}?lang=${locale}&watch=${Date.now()}`;
  try {
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    assert(response, `${project.name}/${locale}${route}: no navigation response`);
    assert(response.status() === 200, `${project.name}/${locale}${route}: HTTP ${response.status()}`);
    await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => undefined);

    const finalUrl = page.url();
    const final = new URL(finalUrl);
    assert(normalizePath(finalUrl) === route, `${project.name}/${locale}${route}: unexpected final path ${final.pathname}`);
    assert(!final.searchParams.has('role') && !final.searchParams.has('as'), `${project.name}/${locale}${route}: role authority leaked into URL ${final.search}`);
    assert(documentRequests.length <= 4, `${project.name}/${locale}${route}: possible redirect loop (${documentRequests.length} document requests)`);

    const dom = await page.evaluate(() => {
      const body = document.body;
      const root = document.querySelector('main') || document.querySelector('#__next') || body;
      const rect = root?.getBoundingClientRect();
      const controls = [...document.querySelectorAll('a,button,option')]
        .map((node) => `${node.textContent || ''} ${node.getAttribute('href') || ''} ${node.getAttribute('aria-label') || ''}`)
        .join(' | ')
        .toUpperCase();
      return {
        htmlLang: document.documentElement.lang,
        bodyText: body?.innerText?.trim() || '',
        bodyChildCount: body?.children?.length || 0,
        rootVisible: Boolean(rect && rect.width > 0 && rect.height > 80),
        controls,
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        reactErrorText: (body?.innerText || '').match(/Application error|Internal Server Error|Hydration failed|Minified React error/i)?.[0] || null,
      };
    });

    assert(dom.bodyChildCount > 0 && dom.bodyText.length > 180 && dom.rootVisible, `${project.name}/${locale}${route}: probable white screen`);
    assert(dom.htmlLang.toLowerCase().startsWith(locale), `${project.name}/${locale}${route}: html lang ${dom.htmlLang}`);
    for (const code of ['RU', 'EN', 'ZH']) assert(dom.controls.includes(code), `${project.name}/${locale}${route}: language switch missing ${code}`);
    assert(!dom.reactErrorText, `${project.name}/${locale}${route}: visible runtime error ${dom.reactErrorText}`);
    assert(dom.scrollWidth <= dom.clientWidth + 2, `${project.name}/${locale}${route}: horizontal overflow ${dom.scrollWidth}/${dom.clientWidth}`);
    assert(consoleErrors.length === 0, `${project.name}/${locale}${route}: console errors ${JSON.stringify(consoleErrors)}`);
    assert(pageErrors.length === 0, `${project.name}/${locale}${route}: page errors ${JSON.stringify(pageErrors)}`);
    assert(failedRequests.length === 0, `${project.name}/${locale}${route}: failed requests ${JSON.stringify(failedRequests)}`);
    assert(badResponses.length === 0, `${project.name}/${locale}${route}: bad responses ${JSON.stringify(badResponses)}`);

    const cacheState = await page.evaluate(async () => ({
      serviceWorkers: 'serviceWorker' in navigator ? (await navigator.serviceWorker.getRegistrations()).length : 0,
      cacheKeys: 'caches' in window ? (await caches.keys()).length : 0,
    }));

    report.cases.push({
      project: project.name,
      locale,
      route,
      status: response.status(),
      finalUrl,
      documentRequests: documentRequests.length,
      bodyTextLength: dom.bodyText.length,
      htmlLang: dom.htmlLang,
      consoleErrors: 0,
      pageErrors: 0,
      failedRequests: 0,
      badResponses: 0,
      serviceWorkers: cacheState.serviceWorkers,
      cacheKeys: cacheState.cacheKeys,
      pass: true,
    });
  } catch (error) {
    const id = `${project.name}-${locale}-${route.replaceAll('/', '_')}`;
    await page.screenshot({ path: path.join(outputDir, `${id}.png`), fullPage: true }).catch(() => undefined);
    const failure = { project: project.name, locale, route, message: String(error?.stack || error), consoleErrors, pageErrors, failedRequests, badResponses, documentRequests };
    report.failures.push(failure);
    report.cases.push({ ...failure, pass: false });
  } finally {
    await context.close();
    await browser.close();
  }
}

async function checkFailClosedLogin() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'ru-RU' });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (message) => { if (message.type() === 'error' && isProductConsoleError(message.text())) consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => pageErrors.push(String(error?.stack || error)));

  try {
    const navigation = await page.goto(`${baseURL}/platform-v7/login?lang=ru&watch=${Date.now()}`, { waitUntil: 'networkidle', timeout: 60_000 });
    assert(navigation?.status() === 200, `fail-closed login page HTTP ${navigation?.status()}`);
    const email = page.locator('input[type="email"]').first();
    const password = page.locator('input[type="password"]').first();
    const submit = page.locator('button[type="submit"]').first();
    assert(await email.isVisible(), 'fail-closed: email input missing');
    assert(await password.isVisible(), 'fail-closed: password input missing');
    assert(await submit.isVisible(), 'fail-closed: submit button missing');
    await email.fill(`nonexistent-watch-${Date.now()}@example.invalid`);
    await password.fill('Definitely-Wrong-Password-2026!');

    const responsePromise = page.waitForResponse((response) => response.url().includes('/api/auth/login'), { timeout: 20_000 }).catch(() => null);
    await submit.click();
    const authResponse = await responsePromise;
    await page.waitForTimeout(1500);
    const status = authResponse?.status() ?? null;
    assert(status !== null, 'fail-closed: auth response was not observed');
    assert([400, 401, 403, 429, 503].includes(status), `fail-closed: unexpected auth status ${status}`);
    assert(normalizePath(page.url()) === '/platform-v7/login', `fail-closed: redirected away from login to ${page.url()}`);
    const final = new URL(page.url());
    assert(!final.searchParams.has('role') && !final.searchParams.has('as'), `fail-closed: role in URL ${final.search}`);

    const cookies = await context.cookies();
    const sensitiveCookies = cookies.filter((cookie) => /(access|refresh|session|mfa|cabinet|demo)/i.test(cookie.name));
    assert(sensitiveCookies.length === 0, `fail-closed: sensitive cookies created ${JSON.stringify(sensitiveCookies.map((cookie) => cookie.name))}`);
    const storage = await page.evaluate(() => ({
      local: Object.keys(localStorage).filter((key) => /(demo|session|token)/i.test(key)),
      session: Object.keys(sessionStorage).filter((key) => /(demo|session|token)/i.test(key)),
    }));
    assert(storage.local.length === 0 && storage.session.length === 0, `fail-closed: demo/session storage ${JSON.stringify(storage)}`);
    assert(consoleErrors.length === 0, `fail-closed: console errors ${JSON.stringify(consoleErrors)}`);
    assert(pageErrors.length === 0, `fail-closed: page errors ${JSON.stringify(pageErrors)}`);

    report.failClosedLogin = {
      status,
      finalUrl: page.url(),
      sensitiveCookies: [],
      storage,
      consoleErrors: 0,
      pageErrors: 0,
      pass: true,
    };
  } catch (error) {
    await page.screenshot({ path: path.join(outputDir, 'fail-closed-login.png'), fullPage: true }).catch(() => undefined);
    report.failures.push({ project: 'chromium-mobile-390', locale: 'ru', route: '/platform-v7/login#fail-closed', message: String(error?.stack || error), consoleErrors, pageErrors });
    report.failClosedLogin = { pass: false, message: String(error?.stack || error), consoleErrors, pageErrors };
  } finally {
    await context.close();
    await browser.close();
  }
}

for (const project of projects) {
  for (const locale of locales) {
    for (const route of routes) await inspectRoute(project, locale, route);
  }
}
await checkFailClosedLogin();

report.pass = report.failures.length === 0 && report.cases.length === 27 && report.failClosedLogin?.pass === true;
fs.writeFileSync(path.join(outputDir, 'public-entry-watch.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ pass: report.pass, cases: report.cases.length, failures: report.failures.length, failClosed: report.failClosedLogin?.pass }, null, 2));
if (!report.pass) process.exit(1);
