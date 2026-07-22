import fs from 'node:fs';
import path from 'node:path';
import { chromium, webkit } from '@playwright/test';

const baseURL = 'https://xn----8sbjf4befbjgs9b.xn--p1ai';
const routes = ['/platform-v7', '/platform-v7/login', '/platform-v7/forgot-password'];
const locales = ['ru', 'en', 'zh'];
const artifactDir = path.resolve(process.cwd(), process.env.ARTIFACT_DIR || '../../artifacts/public-entry-production-watch');
fs.mkdirSync(artifactDir, { recursive: true });

const report = {
  generatedAt: new Date().toISOString(),
  baseURL,
  http: [],
  browser: [],
  failClosed: [],
  failures: [],
};

function fail(message, details = {}) {
  report.failures.push({ message, ...details });
}

function assert(condition, message, details = {}) {
  if (!condition) {
    fail(message, details);
    throw new Error(message);
  }
}

async function fetchWithRedirectTrace(url, maxRedirects = 8) {
  const trace = [];
  let current = url;
  for (let index = 0; index <= maxRedirects; index += 1) {
    const response = await fetch(current, {
      redirect: 'manual',
      headers: { 'User-Agent': 'PC-Production-Watch/1.0', Accept: 'text/html,application/xhtml+xml' },
      signal: AbortSignal.timeout(20_000),
    });
    trace.push({ url: current, status: response.status, location: response.headers.get('location') });
    if (response.status < 300 || response.status >= 400) {
      const body = await response.text();
      return { response, body, finalUrl: current, trace };
    }
    const location = response.headers.get('location');
    if (!location) return { response, body: '', finalUrl: current, trace };
    current = new URL(location, current).toString();
    if (trace.some((item, itemIndex) => itemIndex < trace.length - 1 && item.url === current)) {
      throw new Error(`redirect loop detected for ${url}`);
    }
  }
  throw new Error(`redirect limit exceeded for ${url}`);
}

for (const route of routes) {
  try {
    const result = await fetchWithRedirectTrace(`${baseURL}${route}`);
    const final = new URL(result.finalUrl);
    assert(result.response.status === 200, `${route}: expected HTTP 200, received ${result.response.status}`);
    assert(final.hostname === new URL(baseURL).hostname, `${route}: redirected to unexpected host ${final.hostname}`);
    assert(result.trace.length <= 3, `${route}: excessive redirects ${result.trace.length - 1}`);
    assert(result.body.length > 1000, `${route}: probable empty/white response body (${result.body.length} bytes)`);
    assert(!final.searchParams.has('role') && !final.searchParams.has('as'), `${route}: role authority appeared in URL ${final.toString()}`);
    report.http.push({ route, status: result.response.status, finalUrl: final.toString(), redirects: result.trace.length - 1, bytes: result.body.length, trace: result.trace });
  } catch (error) {
    fail(`${route}: HTTP check failed`, { error: String(error?.stack || error) });
  }
}

const projects = [
  { name: 'chromium-desktop', browserType: chromium, context: { viewport: { width: 1440, height: 1000 } } },
  { name: 'chromium-mobile-390', browserType: chromium, context: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  { name: 'webkit-iphone', browserType: webkit, context: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
];

const hydrationPatterns = [
  /hydration failed/i,
  /text content does not match/i,
  /there was an error while hydrating/i,
  /minified react error/i,
  /next-intl/i,
  /missing message/i,
];

for (const project of projects) {
  const browser = await project.browserType.launch({ headless: true });
  try {
    for (const locale of locales) {
      for (const route of routes) {
        const context = await browser.newContext({
          ...project.context,
          locale: locale === 'ru' ? 'ru-RU' : locale === 'zh' ? 'zh-CN' : 'en-US',
          serviceWorkers: 'block',
        });
        const page = await context.newPage();
        const consoleErrors = [];
        const hydrationErrors = [];
        const pageErrors = [];
        const failedRequests = [];
        const badResponses = [];
        page.on('console', (message) => {
          if (message.type() !== 'error') return;
          const text = message.text();
          consoleErrors.push(text);
          if (hydrationPatterns.some((pattern) => pattern.test(text))) hydrationErrors.push(text);
        });
        page.on('pageerror', (error) => pageErrors.push(String(error?.stack || error)));
        page.on('requestfailed', (request) => {
          const errorText = request.failure()?.errorText || 'unknown';
          if (!/ERR_ABORTED|cancelled/i.test(errorText)) failedRequests.push({ url: request.url(), errorText });
        });
        page.on('response', (response) => {
          if (response.url().startsWith(baseURL) && response.status() >= 400 && !response.url().includes('/favicon')) {
            badResponses.push({ url: response.url(), status: response.status() });
          }
        });

        const target = `${baseURL}${route}?lang=${locale}`;
        try {
          const response = await page.goto(target, { waitUntil: 'networkidle', timeout: 60_000 });
          assert(response?.status() === 200, `${project.name}/${locale}${route}: navigation status ${response?.status()}`);
          const redirectCount = (() => {
            let request = response?.request();
            let count = 0;
            while (request?.redirectedFrom()) { count += 1; request = request.redirectedFrom(); }
            return count;
          })();
          assert(redirectCount <= 3, `${project.name}/${locale}${route}: excessive redirects ${redirectCount}`);
          const current = new URL(page.url());
          assert(current.hostname === new URL(baseURL).hostname, `${project.name}/${locale}${route}: unexpected host ${current.hostname}`);
          assert(!current.searchParams.has('role') && !current.searchParams.has('as'), `${project.name}/${locale}${route}: role/as in URL ${current.toString()}`);

          const state = await page.evaluate(() => ({
            lang: document.documentElement.lang,
            textLength: document.body?.innerText?.trim().length || 0,
            scrollWidth: document.documentElement.scrollWidth,
            clientWidth: document.documentElement.clientWidth,
            mainCount: document.querySelectorAll('main').length,
            roleSelectors: document.querySelectorAll('select[name="role"], [data-role-selector], [data-testid*="role-selector"]').length,
            storage: {
              local: Object.entries(localStorage),
              session: Object.entries(sessionStorage),
            },
          }));
          assert(state.lang.toLowerCase().startsWith(locale), `${project.name}/${locale}${route}: html lang is ${state.lang}`);
          assert(state.textLength > 180, `${project.name}/${locale}${route}: probable white screen, text length ${state.textLength}`);
          assert(state.mainCount >= 1, `${project.name}/${locale}${route}: main landmark missing`);
          assert(state.scrollWidth <= state.clientWidth + 1, `${project.name}/${locale}${route}: horizontal overflow ${state.scrollWidth}/${state.clientWidth}`);
          assert(state.roleSelectors === 0, `${project.name}/${locale}${route}: role selector exposed`);
          const storageText = JSON.stringify(state.storage).toLowerCase();
          assert(!storageText.includes('demo') && !storageText.includes('mock-session'), `${project.name}/${locale}${route}: demo/mock state in browser storage`);
          const cookies = await context.cookies();
          const demoCookies = cookies.filter((cookie) => /demo|mock/i.test(`${cookie.name}=${cookie.value}`));
          assert(demoCookies.length === 0, `${project.name}/${locale}${route}: demo/mock cookies detected ${demoCookies.map((c) => c.name).join(',')}`);
          assert(hydrationErrors.length === 0, `${project.name}/${locale}${route}: hydration/i18n errors ${JSON.stringify(hydrationErrors)}`);
          assert(pageErrors.length === 0, `${project.name}/${locale}${route}: runtime page errors ${JSON.stringify(pageErrors)}`);
          assert(consoleErrors.length === 0, `${project.name}/${locale}${route}: console errors ${JSON.stringify(consoleErrors)}`);
          assert(failedRequests.length === 0, `${project.name}/${locale}${route}: failed requests ${JSON.stringify(failedRequests)}`);
          assert(badResponses.length === 0, `${project.name}/${locale}${route}: bad same-origin responses ${JSON.stringify(badResponses)}`);

          report.browser.push({ project: project.name, locale, route, status: response?.status(), finalUrl: page.url(), redirectCount, textLength: state.textLength, htmlLang: state.lang, consoleErrors: 0, pageErrors: 0, failedRequests: 0, badResponses: 0, demoCookies: 0 });
        } catch (error) {
          fail(`${project.name}/${locale}${route}: browser check failed`, { error: String(error?.stack || error), consoleErrors, hydrationErrors, pageErrors, failedRequests, badResponses });
        } finally {
          await context.close();
        }
      }
    }

    const context = await browser.newContext({ ...project.context, locale: 'ru-RU', serviceWorkers: 'block' });
    const page = await context.newPage();
    const beforeCookies = await context.cookies();
    const beforeNames = new Set(beforeCookies.map((cookie) => cookie.name));
    let loginResponseStatus = null;
    try {
      const responsePromise = page.waitForResponse((response) => response.url().includes('/api/auth/login') && response.request().method() === 'POST', { timeout: 20_000 });
      await page.goto(`${baseURL}/platform-v7/login?lang=ru`, { waitUntil: 'networkidle', timeout: 60_000 });
      await page.locator('#pc-auth-email').fill(`production-watch-${Date.now()}@invalid.example`);
      await page.locator('#pc-auth-password').fill('Invalid-Production-Watch-Password-9!');
      await page.locator('form.pc-auth-card button[type="submit"]').click();
      const loginResponse = await responsePromise;
      loginResponseStatus = loginResponse.status();
      assert(loginResponse.status() >= 400, `${project.name}: invalid login unexpectedly returned ${loginResponse.status()}`);
      await page.waitForTimeout(800);
      const current = new URL(page.url());
      assert(current.pathname === '/platform-v7/login', `${project.name}: invalid login left login route ${current.toString()}`);
      assert(!current.searchParams.has('role') && !current.searchParams.has('as'), `${project.name}: invalid login introduced role/as URL parameters`);
      const afterCookies = await context.cookies();
      const newSensitiveCookies = afterCookies.filter((cookie) => !beforeNames.has(cookie.name) && /access|refresh|session|mfa|cabinet|auth/i.test(cookie.name));
      assert(newSensitiveCookies.length === 0, `${project.name}: invalid login created sensitive cookies ${newSensitiveCookies.map((c) => c.name).join(',')}`);
      const demoCookies = afterCookies.filter((cookie) => /demo|mock/i.test(`${cookie.name}=${cookie.value}`));
      assert(demoCookies.length === 0, `${project.name}: invalid login created demo/mock cookies`);
      const storage = await page.evaluate(() => JSON.stringify({ local: Object.entries(localStorage), session: Object.entries(sessionStorage) }).toLowerCase());
      assert(!storage.includes('demo') && !storage.includes('mock-session'), `${project.name}: invalid login created demo/mock storage state`);
      report.failClosed.push({ project: project.name, responseStatus: loginResponse.status(), finalUrl: page.url(), newSensitiveCookies: [], demoCookies: [] });
    } catch (error) {
      fail(`${project.name}: fail-closed login check failed`, { responseStatus: loginResponseStatus, error: String(error?.stack || error) });
    } finally {
      await context.close();
    }
  } finally {
    await browser.close();
  }
}

const output = path.join(artifactDir, 'public-entry-production-watch.json');
fs.writeFileSync(output, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ httpCases: report.http.length, browserCases: report.browser.length, failClosedCases: report.failClosed.length, failures: report.failures.length, output }, null, 2));
if (report.failures.length > 0) process.exit(1);
