import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const baseURL = process.env.BASE_URL || 'https://xn----8sbjf4befbjgs9b.xn--p1ai';
const artifactDir = path.resolve(process.cwd(), '../../', process.env.ARTIFACT_DIR || 'artifacts/public-entry-watch-v2');
fs.mkdirSync(artifactDir, { recursive: true });

const routes = ['/platform-v7', '/platform-v7/login', '/platform-v7/forgot-password'];
const locales = ['ru', 'en', 'zh'];
const profiles = [
  { name: 'desktop-1440', viewport: { width: 1440, height: 1000 }, isMobile: false, hasTouch: false },
  { name: 'mobile-390', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
];
const report = { checkedAt: new Date().toISOString(), baseURL, cases: [], failClosed: null, failures: [], fatal: null };

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function redirectCount(request) {
  let count = 0;
  for (let cursor = request.redirectedFrom(); cursor; cursor = cursor.redirectedFrom()) count += 1;
  return count;
}
function isRuntimeError(value) {
  return /(hydration|hydrated|react error|next-intl|missing message|chunkloaderror|referenceerror|typeerror|syntaxerror|uncaught|invariant|maximum update depth|too many redirects)/i.test(value);
}
function hasDemoStorage(value) {
  return /(demo|mock|fake)/i.test(JSON.stringify(value));
}
function safeName(route) {
  return route.split('/').filter(Boolean).join('-') || 'root';
}

let browser;
try {
  browser = await chromium.launch({ headless: true });

  for (const profile of profiles) {
    for (const locale of locales) {
      for (const route of routes) {
        const context = await browser.newContext({
          viewport: profile.viewport,
          isMobile: profile.isMobile,
          hasTouch: profile.hasTouch,
          locale: locale === 'ru' ? 'ru-RU' : locale === 'zh' ? 'zh-CN' : 'en-US',
        });
        const page = await context.newPage();
        const runtimeErrors = [];
        const pageErrors = [];
        const failedRequests = [];
        page.on('console', (message) => {
          if (message.type() === 'error' && isRuntimeError(message.text())) runtimeErrors.push(message.text());
        });
        page.on('pageerror', (error) => pageErrors.push(String(error?.stack || error)));
        page.on('requestfailed', (request) => {
          const failure = request.failure()?.errorText || 'unknown';
          if (!/ERR_ABORTED|NS_BINDING_ABORTED/.test(failure)) failedRequests.push({ url: request.url(), failure });
        });

        const result = { profile: profile.name, locale, route };
        try {
          const response = await page.goto(`${baseURL}${route}?lang=${locale}`, {
            waitUntil: 'domcontentloaded',
            timeout: 45_000,
          });
          assert(response, `${profile.name}/${locale}${route}: no document response`);
          assert(response.status() === 200, `${profile.name}/${locale}${route}: HTTP ${response.status()}`);
          const redirects = redirectCount(response.request());
          assert(redirects <= 3, `${profile.name}/${locale}${route}: redirect chain ${redirects}`);
          await page.waitForTimeout(1500);

          const finalURL = new URL(page.url());
          assert(finalURL.pathname.replace(/\/$/, '') === route, `${profile.name}/${locale}${route}: final path ${finalURL.pathname}`);
          assert(!finalURL.searchParams.has('role') && !finalURL.searchParams.has('as'), `${profile.name}/${locale}${route}: role/as URL parameter`);
          const htmlLang = (await page.locator('html').getAttribute('lang') || '').toLowerCase();
          assert(htmlLang.startsWith(locale), `${profile.name}/${locale}${route}: html lang ${htmlLang}`);

          const state = await page.evaluate(() => ({
            text: (document.body?.innerText || '').trim(),
            scrollWidth: document.documentElement.scrollWidth,
            clientWidth: document.documentElement.clientWidth,
            hrefs: Array.from(document.querySelectorAll('a[href*="lang="]')).map((item) => item.getAttribute('href') || ''),
            controls: Array.from(document.querySelectorAll('a,button')).map((item) => (item.textContent || '').trim()).filter(Boolean),
            roleSelectors: document.querySelectorAll('select[name*="role" i],select[id*="role" i],[data-role-selector]').length,
            localStorage: Object.fromEntries(Object.entries(localStorage)),
            sessionStorage: Object.fromEntries(Object.entries(sessionStorage)),
          }));
          assert(state.text.length > (route === '/platform-v7' ? 250 : 80), `${profile.name}/${locale}${route}: probable white screen (${state.text.length})`);
          assert(state.scrollWidth <= state.clientWidth + 2, `${profile.name}/${locale}${route}: horizontal overflow ${state.scrollWidth}/${state.clientWidth}`);

          const languageSignals = new Set();
          for (const href of state.hrefs) {
            try {
              const value = new URL(href, page.url()).searchParams.get('lang');
              if (value) languageSignals.add(value);
            } catch {}
          }
          const controls = state.controls.join(' | ');
          if (/\bRU\b|Рус/i.test(controls)) languageSignals.add('ru');
          if (/\bEN\b|English/i.test(controls)) languageSignals.add('en');
          if (/中文|简体|\bZH\b/i.test(controls)) languageSignals.add('zh');
          assert(['ru', 'en', 'zh'].every((value) => languageSignals.has(value)), `${profile.name}/${locale}${route}: RU/EN/ZH switch incomplete (${[...languageSignals].join(',')})`);
          assert(state.roleSelectors === 0, `${profile.name}/${locale}${route}: role selector detected`);
          assert(!hasDemoStorage(state.localStorage) && !hasDemoStorage(state.sessionStorage), `${profile.name}/${locale}${route}: demo/mock storage detected`);
          assert(runtimeErrors.length === 0, `${profile.name}/${locale}${route}: runtime console errors ${JSON.stringify(runtimeErrors)}`);
          assert(pageErrors.length === 0, `${profile.name}/${locale}${route}: page errors ${JSON.stringify(pageErrors)}`);
          assert(failedRequests.length === 0, `${profile.name}/${locale}${route}: failed requests ${JSON.stringify(failedRequests)}`);

          Object.assign(result, { ok: true, http: 200, redirects, finalURL: page.url(), htmlLang, textLength: state.text.length });
        } catch (error) {
          const message = String(error?.stack || error);
          report.failures.push(message);
          result.error = message;
          await page.screenshot({ path: path.join(artifactDir, `${profile.name}-${locale}-${safeName(route)}-failed.png`), fullPage: true }).catch(() => {});
        } finally {
          report.cases.push(result);
          await context.close();
        }
      }
    }
  }

  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'ru-RU' });
  const page = await context.newPage();
  const authResponses = [];
  const runtimeErrors = [];
  page.on('response', (response) => {
    if (response.url().startsWith(baseURL) && /\/api\/(auth|platform-v7)/.test(response.url())) {
      authResponses.push({ url: response.url(), status: response.status() });
    }
  });
  page.on('console', (message) => {
    if (message.type() === 'error' && isRuntimeError(message.text())) runtimeErrors.push(message.text());
  });
  try {
    const response = await page.goto(`${baseURL}/platform-v7/login?lang=ru`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    assert(response?.status() === 200, `fail-closed: login HTTP ${response?.status()}`);
    const email = page.locator('input[type="email"]').first();
    const password = page.locator('input[type="password"]').first();
    const submit = page.locator('button[type="submit"],input[type="submit"]').first();
    assert(await email.count() === 1 && await password.count() === 1 && await submit.count() === 1, 'fail-closed: login form incomplete');
    await email.fill('monitor-nonexistent@example.test');
    await password.fill('Invalid-Monitor-Password-2026!');
    await submit.click();
    await page.waitForTimeout(4500);

    const finalURL = new URL(page.url());
    assert(finalURL.pathname.replace(/\/$/, '') === '/platform-v7/login', `fail-closed: escaped login to ${finalURL.pathname}`);
    assert(!finalURL.searchParams.has('role') && !finalURL.searchParams.has('as'), 'fail-closed: role/as in URL');
    const cookies = await context.cookies();
    const forbiddenCookies = cookies.filter((cookie) => /(access|refresh|session|mfa|cabinet|demo|mock)/i.test(cookie.name));
    assert(forbiddenCookies.length === 0, `fail-closed: auth/demo cookies created ${forbiddenCookies.map((item) => item.name).join(',')}`);
    const state = await page.evaluate(() => ({
      body: document.body.innerText,
      localStorage: Object.fromEntries(Object.entries(localStorage)),
      sessionStorage: Object.fromEntries(Object.entries(sessionStorage)),
    }));
    assert(!hasDemoStorage(state.localStorage) && !hasDemoStorage(state.sessionStorage), 'fail-closed: demo/mock storage created');
    assert(runtimeErrors.length === 0, `fail-closed: runtime errors ${JSON.stringify(runtimeErrors)}`);
    const rejected = authResponses.some((item) => [400, 401, 403, 404, 409, 422, 429, 503].includes(item.status));
    const visibleFailure = /ошиб|недоступ|повтор|невер|invalid|unavailable|try again|失败|错误/i.test(state.body);
    assert(rejected || visibleFailure, `fail-closed: no explicit rejection observed; responses=${JSON.stringify(authResponses)}`);
    report.failClosed = { ok: true, finalURL: page.url(), authResponses, cookies: cookies.map((item) => item.name) };
  } catch (error) {
    const message = String(error?.stack || error);
    report.failures.push(message);
    report.failClosed = { ok: false, error: message, authResponses };
    await page.screenshot({ path: path.join(artifactDir, 'fail-closed-login-failed.png'), fullPage: true }).catch(() => {});
  } finally {
    await context.close();
  }
} catch (error) {
  report.fatal = String(error?.stack || error);
  report.failures.push(report.fatal);
} finally {
  if (browser) await browser.close().catch(() => {});
  report.ok = report.failures.length === 0;
  fs.writeFileSync(path.join(artifactDir, 'result.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ok: report.ok, cases: report.cases.length, failClosed: report.failClosed, fatal: report.fatal, failures: report.failures }, null, 2));
  if (!report.ok) process.exitCode = 1;
}
