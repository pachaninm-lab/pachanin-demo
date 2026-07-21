import fs from 'node:fs';
import path from 'node:path';
import { chromium, webkit } from '@playwright/test';

const baseURL = 'https://xn----8sbjf4befbjgs9b.xn--p1ai';
const outputDir = path.resolve(process.cwd(), '../../artifacts/public-entry-watch');
fs.mkdirSync(outputDir, { recursive: true });
const routes = ['/platform-v7', '/platform-v7/login', '/platform-v7/forgot-password'];
const locales = ['ru', 'en', 'zh'];
const projects = [
  { name: 'chromium-desktop', browser: chromium, viewport: { width: 1440, height: 1000 } },
  { name: 'chromium-mobile-390', browser: chromium, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
  { name: 'webkit-iphone', browser: webkit, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
];
const report = { schemaVersion: 2, checkedAt: new Date().toISOString(), baseURL, cases: [], failClosedLogin: null, failures: [], pass: false };

function assert(condition, message) { if (!condition) throw new Error(message); }
function normalizePath(value) { const pathname = new URL(value).pathname.replace(/\/$/, ''); return pathname || '/'; }
function ignoredConsole(text) { return text.includes('favicon.ico') && text.includes('404'); }

async function inspectRoute(project, locale, route) {
  const browser = await project.browser.launch({ headless: true });
  const context = await browser.newContext({ viewport: project.viewport, isMobile: project.isMobile, hasTouch: project.hasTouch, locale: locale === 'ru' ? 'ru-RU' : locale === 'zh' ? 'zh-CN' : 'en-US' });
  const page = await context.newPage();
  const consoleErrors = [], pageErrors = [], failedRequests = [], badResponses = [], documentRequests = [];
  let dom = null;
  page.on('console', (message) => { if (message.type() === 'error' && !ignoredConsole(message.text())) consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => pageErrors.push(String(error?.stack || error)));
  page.on('request', (request) => { if (request.resourceType() === 'document') documentRequests.push(request.url()); });
  page.on('requestfailed', (request) => { const failure = request.failure()?.errorText || 'unknown'; if (!failure.includes('ERR_ABORTED')) failedRequests.push({ url: request.url(), failure }); });
  page.on('response', (response) => { if (response.url().startsWith(baseURL) && response.status() >= 400 && !response.url().includes('/favicon')) badResponses.push({ url: response.url(), status: response.status() }); });
  try {
    const response = await page.goto(`${baseURL}${route}?lang=${locale}&watch=${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    assert(response?.status() === 200, `${project.name}/${locale}${route}: HTTP ${response?.status()}`);
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined);
    const final = new URL(page.url());
    assert(normalizePath(page.url()) === route, `${project.name}/${locale}${route}: final path ${final.pathname}`);
    assert(!final.searchParams.has('role') && !final.searchParams.has('as'), `${project.name}/${locale}${route}: role/as in URL`);
    assert(documentRequests.length <= 4, `${project.name}/${locale}${route}: possible redirect loop ${documentRequests.length}`);

    dom = await page.evaluate((currentLocale) => {
      const body = document.body;
      const primary = document.querySelector('main') || document.querySelector('form') || body;
      const rect = primary?.getBoundingClientRect();
      const rows = [...document.querySelectorAll('a,button,option,select,[data-locale],[data-lang],[lang]')].map((node) => ({
        text: (node.textContent || '').trim(),
        href: node.getAttribute('href') || '',
        value: node.getAttribute('value') || '',
        locale: node.getAttribute('data-locale') || node.getAttribute('data-lang') || node.getAttribute('lang') || '',
        aria: node.getAttribute('aria-label') || '',
      }));
      const patterns = {
        ru: /(^|\s)(RU|РУ)(\s|$)|РУССК|RUSSIAN|俄语/i,
        en: /(^|\s)EN(\s|$)|ENGLISH|АНГЛИЙСК|英语/i,
        zh: /(^|\s)ZH(\s|$)|中文|汉语|CHINESE|КИТАЙСК/i,
      };
      const availability = { ru: false, en: false, zh: false };
      availability[currentLocale] = true;
      for (const code of Object.keys(availability)) {
        availability[code] ||= rows.some((row) => {
          let hrefLocale = '';
          try { hrefLocale = row.href ? new URL(row.href, location.href).searchParams.get('lang') || '' : ''; } catch {}
          return hrefLocale === code || row.value.toLowerCase() === code || row.locale.toLowerCase() === code || patterns[code].test(`${row.text} ${row.aria}`);
        });
      }
      const text = body?.innerText?.trim() || '';
      return {
        htmlLang: document.documentElement.lang,
        bodyTextLength: text.length,
        bodyPreview: text.slice(0, 500),
        bodyChildCount: body?.children?.length || 0,
        primaryVisible: Boolean(rect && rect.width > 0 && rect.height > 40),
        availability,
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        visibleRuntimeError: /Application error|Internal Server Error|Hydration failed|Minified React error/i.test(text),
      };
    }, locale);

    assert(dom.bodyChildCount > 0 && dom.bodyTextLength > 40 && dom.primaryVisible, `${project.name}/${locale}${route}: probable white screen ${JSON.stringify(dom)}`);
    assert(dom.htmlLang.toLowerCase().startsWith(locale), `${project.name}/${locale}${route}: html lang ${dom.htmlLang}`);
    assert(Object.values(dom.availability).every(Boolean), `${project.name}/${locale}${route}: incomplete language availability ${JSON.stringify(dom.availability)}`);
    assert(!dom.visibleRuntimeError, `${project.name}/${locale}${route}: visible runtime error`);
    assert(dom.scrollWidth <= dom.clientWidth + 2, `${project.name}/${locale}${route}: horizontal overflow ${dom.scrollWidth}/${dom.clientWidth}`);
    assert(consoleErrors.length === 0, `${project.name}/${locale}${route}: console errors ${JSON.stringify(consoleErrors)}`);
    assert(pageErrors.length === 0, `${project.name}/${locale}${route}: page errors ${JSON.stringify(pageErrors)}`);
    assert(failedRequests.length === 0, `${project.name}/${locale}${route}: failed requests ${JSON.stringify(failedRequests)}`);
    assert(badResponses.length === 0, `${project.name}/${locale}${route}: bad responses ${JSON.stringify(badResponses)}`);
    report.cases.push({ project: project.name, locale, route, status: 200, finalUrl: page.url(), documentRequests: documentRequests.length, ...dom, consoleErrors: 0, pageErrors: 0, failedRequests: 0, badResponses: 0, pass: true });
  } catch (error) {
    await page.screenshot({ path: path.join(outputDir, `${project.name}-${locale}-${route.replaceAll('/', '_')}.png`), fullPage: true }).catch(() => undefined);
    const failure = { project: project.name, locale, route, message: String(error?.stack || error), dom, consoleErrors, pageErrors, failedRequests, badResponses, documentRequests };
    report.failures.push(failure); report.cases.push({ ...failure, pass: false });
  } finally { await context.close(); await browser.close(); }
}

async function checkFailClosedLogin() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'ru-RU' });
  const page = await context.newPage();
  const consoleErrors = [], pageErrors = [];
  page.on('console', (message) => { if (message.type() === 'error' && !ignoredConsole(message.text())) consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => pageErrors.push(String(error?.stack || error)));
  try {
    const navigation = await page.goto(`${baseURL}/platform-v7/login?lang=ru&watch=${Date.now()}`, { waitUntil: 'networkidle', timeout: 60_000 });
    assert(navigation?.status() === 200, `fail-closed login page HTTP ${navigation?.status()}`);
    const email = page.locator('input[type="email"]').first();
    const password = page.locator('input[type="password"]').first();
    const submit = page.locator('button[type="submit"]').first();
    assert(await email.isVisible() && await password.isVisible() && await submit.isVisible(), 'fail-closed: login form incomplete');
    await email.fill(`nonexistent-watch-${Date.now()}@example.invalid`);
    await password.fill('Definitely-Wrong-Password-2026!');
    const responsePromise = page.waitForResponse((response) => response.url().includes('/api/auth/login'), { timeout: 20_000 }).catch(() => null);
    await submit.click();
    const authResponse = await responsePromise;
    await page.waitForTimeout(1200);
    const status = authResponse?.status() ?? null;
    assert(status !== null && [400, 401, 403, 429, 503].includes(status), `fail-closed: auth status ${status}`);
    assert(normalizePath(page.url()) === '/platform-v7/login', `fail-closed: redirected to ${page.url()}`);
    const final = new URL(page.url());
    assert(!final.searchParams.has('role') && !final.searchParams.has('as'), 'fail-closed: role/as in URL');
    const sensitiveCookies = (await context.cookies()).filter((cookie) => /(access|refresh|session|mfa|cabinet|demo)/i.test(cookie.name));
    assert(sensitiveCookies.length === 0, `fail-closed: sensitive cookies ${JSON.stringify(sensitiveCookies.map((cookie) => cookie.name))}`);
    const storage = await page.evaluate(() => ({ local: Object.keys(localStorage).filter((key) => /(demo|session|token)/i.test(key)), session: Object.keys(sessionStorage).filter((key) => /(demo|session|token)/i.test(key)) }));
    assert(storage.local.length === 0 && storage.session.length === 0, `fail-closed: storage ${JSON.stringify(storage)}`);
    const unexpectedConsole = consoleErrors.filter((entry) => !(status === 503 && entry.includes('503')) && !(status === 401 && entry.includes('401')) && !(status === 403 && entry.includes('403')) && !(status === 429 && entry.includes('429')) && !(status === 400 && entry.includes('400')));
    assert(unexpectedConsole.length === 0, `fail-closed: unexpected console errors ${JSON.stringify(unexpectedConsole)}`);
    assert(pageErrors.length === 0, `fail-closed: page errors ${JSON.stringify(pageErrors)}`);
    report.failClosedLogin = { status, finalUrl: page.url(), sensitiveCookies: [], storage, expectedNetworkConsoleErrors: consoleErrors, pageErrors: 0, pass: true };
  } catch (error) {
    await page.screenshot({ path: path.join(outputDir, 'fail-closed-login.png'), fullPage: true }).catch(() => undefined);
    const failure = { project: 'chromium-mobile-390', locale: 'ru', route: '/platform-v7/login#fail-closed', message: String(error?.stack || error), consoleErrors, pageErrors };
    report.failures.push(failure); report.failClosedLogin = { ...failure, pass: false };
  } finally { await context.close(); await browser.close(); }
}

for (const project of projects) for (const locale of locales) for (const route of routes) await inspectRoute(project, locale, route);
await checkFailClosedLogin();
report.pass = report.failures.length === 0 && report.cases.length === 27 && report.failClosedLogin?.pass === true;
fs.writeFileSync(path.join(outputDir, 'public-entry-watch.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ pass: report.pass, cases: report.cases.length, failures: report.failures.length, failClosed: report.failClosedLogin?.pass }, null, 2));
if (!report.pass) process.exit(1);
