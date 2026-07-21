import fs from 'node:fs';
import path from 'node:path';
import { chromium, webkit } from '@playwright/test';

const origin = 'https://xn----8sbjf4befbjgs9b.xn--p1ai';
const routes = ['/platform-v7', '/platform-v7/login', '/platform-v7/forgot-password'];
const locales = ['ru', 'en', 'zh'];
const outDir = path.resolve(process.cwd(), '../../artifacts/public-entry-watch');
fs.mkdirSync(outDir, { recursive: true });

const report = {
  generatedAt: new Date().toISOString(),
  origin,
  http: [],
  browser: [],
  loginFailClosed: null,
  issues: [],
};

function issue(code, details) {
  report.issues.push({ code, ...details });
}

function redirectCount(request) {
  let count = 0;
  let current = request.redirectedFrom();
  while (current) {
    count += 1;
    current = current.redirectedFrom();
  }
  return count;
}

async function fetchWithRedirects(url, max = 10) {
  const chain = [];
  let current = url;
  for (let index = 0; index <= max; index += 1) {
    const response = await fetch(current, {
      redirect: 'manual',
      headers: { 'user-agent': 'Transparent-Price-Public-Entry-Watch/1.0', accept: 'text/html,*/*' },
      signal: AbortSignal.timeout(20_000),
    });
    chain.push({ url: current, status: response.status, location: response.headers.get('location') });
    if (response.status < 300 || response.status >= 400) {
      return { response, finalUrl: current, chain };
    }
    const location = response.headers.get('location');
    if (!location) return { response, finalUrl: current, chain };
    current = new URL(location, current).toString();
  }
  throw new Error(`redirect limit exceeded for ${url}`);
}

for (const route of routes) {
  const url = `${origin}${route}`;
  try {
    const result = await fetchWithRedirects(url);
    const body = await result.response.text();
    const final = new URL(result.finalUrl);
    const row = {
      route,
      status: result.response.status,
      finalUrl: result.finalUrl,
      redirects: result.chain.length - 1,
      bodyBytes: Buffer.byteLength(body),
      titlePresent: /<title[^>]*>[^<]+<\/title>/i.test(body),
    };
    report.http.push(row);
    if (row.status !== 200) issue('HTTP_NOT_200', row);
    if (row.redirects > 3) issue('REDIRECT_CHAIN_TOO_LONG', row);
    if (final.hostname !== new URL(origin).hostname || final.pathname.replace(/\/$/, '') !== route.replace(/\/$/, '')) {
      issue('UNEXPECTED_FINAL_URL', row);
    }
    if (final.searchParams.has('role') || final.searchParams.has('as')) issue('ROLE_IN_FINAL_URL', row);
    if (row.bodyBytes < 500) issue('SUSPICIOUSLY_SMALL_HTML', row);
  } catch (error) {
    issue('HTTP_CHECK_FAILED', { route, error: String(error?.stack || error) });
  }
}

const projects = [
  { name: 'chromium-desktop', browserType: chromium, context: { viewport: { width: 1440, height: 1000 } } },
  { name: 'chromium-mobile', browserType: chromium, context: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  { name: 'webkit-mobile', browserType: webkit, context: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
];

function hasLanguageControls(texts) {
  const normalized = texts.map((value) => String(value || '').trim()).filter(Boolean);
  return {
    ru: normalized.some((value) => /^ru$/i.test(value) || /русск/i.test(value)),
    en: normalized.some((value) => /^en$/i.test(value) || /english/i.test(value)),
    zh: normalized.some((value) => /^zh$/i.test(value) || /中文|简体|繁體|chinese/i.test(value)),
  };
}

for (const project of projects) {
  const browser = await project.browserType.launch({ headless: true });
  try {
    for (const route of routes) {
      for (const locale of locales) {
        const context = await browser.newContext({
          ...project.context,
          locale: locale === 'ru' ? 'ru-RU' : locale === 'zh' ? 'zh-CN' : 'en-US',
        });
        const page = await context.newPage();
        const consoleErrors = [];
        const pageErrors = [];
        const failedRequests = [];
        const badResponses = [];
        page.on('console', (message) => {
          if (message.type() !== 'error') return;
          const value = message.text();
          if (/hydration|hydrated|react|next-intl|missing message|chunkload|referenceerror|typeerror|unhandled/i.test(value)) {
            consoleErrors.push(value);
          }
        });
        page.on('pageerror', (error) => pageErrors.push(String(error?.stack || error)));
        page.on('requestfailed', (request) => {
          if (request.url().startsWith(origin) && !String(request.failure()?.errorText || '').includes('ERR_ABORTED')) {
            failedRequests.push({ url: request.url(), error: request.failure()?.errorText || 'unknown' });
          }
        });
        page.on('response', (response) => {
          if (response.url().startsWith(origin) && response.status() >= 400 && !response.url().includes('favicon')) {
            badResponses.push({ url: response.url(), status: response.status() });
          }
        });

        const url = `${origin}${route}?lang=${locale}`;
        try {
          const navigation = await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });
          await page.waitForTimeout(500);
          const final = new URL(page.url());
          const bodyText = (await page.locator('body').innerText()).trim();
          const mainVisible = await page.locator('main').first().isVisible().catch(() => false);
          const h1OrForm = (await page.locator('h1, form').count()) > 0;
          const lang = await page.locator('html').getAttribute('lang');
          const controls = await page.locator('a,button,option').allTextContents();
          const languageControls = hasLanguageControls(controls);
          const row = {
            project: project.name,
            route,
            locale,
            status: navigation?.status() ?? null,
            redirects: navigation ? redirectCount(navigation.request()) : null,
            finalUrl: page.url(),
            htmlLang: lang,
            bodyTextLength: bodyText.length,
            mainVisible,
            h1OrForm,
            languageControls,
            consoleErrors,
            pageErrors,
            failedRequests,
            badResponses,
          };
          report.browser.push(row);

          if (row.status !== 200) issue('BROWSER_HTTP_NOT_200', row);
          if ((row.redirects ?? 0) > 3) issue('BROWSER_REDIRECT_CHAIN_TOO_LONG', row);
          if (final.hostname !== new URL(origin).hostname || final.pathname.replace(/\/$/, '') !== route.replace(/\/$/, '')) issue('BROWSER_UNEXPECTED_FINAL_URL', row);
          if (final.searchParams.has('role') || final.searchParams.has('as')) issue('BROWSER_ROLE_IN_URL', row);
          if (bodyText.length < 80 || !mainVisible || !h1OrForm) issue('POSSIBLE_WHITE_SCREEN', row);
          if (!lang?.toLowerCase().startsWith(locale)) issue('LOCALE_HTML_LANG_MISMATCH', row);
          if (!languageControls.ru || !languageControls.en || !languageControls.zh) issue('LANGUAGE_SWITCH_INCOMPLETE', row);
          if (consoleErrors.length || pageErrors.length || failedRequests.length || badResponses.length) issue('BROWSER_RUNTIME_DEGRADATION', row);
        } catch (error) {
          issue('BROWSER_CHECK_FAILED', { project: project.name, route, locale, error: String(error?.stack || error) });
        }
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
}

// Fail-closed login: invalid synthetic identity must never create a usable session or leave login.
{
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const authResponses = [];
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(String(error?.stack || error)));
  page.on('response', (response) => {
    const value = response.url();
    if (/\/api\/auth\/|\/auth\/login/i.test(value)) authResponses.push({ url: value, status: response.status() });
  });
  try {
    await page.goto(`${origin}/platform-v7/login?lang=ru`, { waitUntil: 'networkidle', timeout: 60_000 });
    const beforeCookies = await context.cookies();
    const beforeNames = new Set(beforeCookies.map((cookie) => cookie.name));
    const email = page.locator('input[type="email"], input[name="email"]').first();
    const password = page.locator('input[type="password"], input[name="password"]').first();
    const submit = page.locator('button[type="submit"], input[type="submit"]').first();
    if (!(await email.count()) || !(await password.count()) || !(await submit.count())) {
      throw new Error('login form fields were not found');
    }
    await email.fill('public-entry-watch-nonexistent@invalid.test');
    await password.fill('NotARealPassword!2026');
    await submit.click();
    await page.waitForTimeout(4_000);

    const afterCookies = await context.cookies();
    const newCookies = afterCookies.filter((cookie) => !beforeNames.has(cookie.name));
    const sensitiveNewCookies = newCookies.filter((cookie) => /(?:^|_|-)(?:access|refresh|session|auth|mfa|cabinet|demo|mock)(?:$|_|-)/i.test(cookie.name));
    const storage = await page.evaluate(() => ({
      local: Object.keys(localStorage),
      session: Object.keys(sessionStorage),
    }));
    const demoStorage = [...storage.local, ...storage.session].filter((key) => /demo|mock|fake/i.test(key));
    const final = new URL(page.url());
    const result = {
      finalUrl: page.url(),
      authResponses,
      newCookieNames: newCookies.map((cookie) => cookie.name),
      sensitiveNewCookieNames: sensitiveNewCookies.map((cookie) => cookie.name),
      demoStorage,
      pageErrors,
    };
    report.loginFailClosed = result;
    if (final.pathname.replace(/\/$/, '') !== '/platform-v7/login') issue('LOGIN_ESCAPED_FAIL_CLOSED_ROUTE', result);
    if (final.searchParams.has('role') || final.searchParams.has('as') || /demo/i.test(final.pathname)) issue('LOGIN_ROLE_OR_DEMO_URL', result);
    if (sensitiveNewCookies.length) issue('LOGIN_CREATED_SESSION_COOKIE', result);
    if (demoStorage.length) issue('LOGIN_CREATED_DEMO_STORAGE', result);
    if (pageErrors.length) issue('LOGIN_RUNTIME_ERROR', result);
    if (authResponses.length === 0) issue('LOGIN_AUTH_REQUEST_NOT_OBSERVED', result);
    if (authResponses.some((response) => response.status >= 200 && response.status < 300)) issue('INVALID_LOGIN_ACCEPTED', result);
  } catch (error) {
    issue('LOGIN_FAIL_CLOSED_CHECK_FAILED', { error: String(error?.stack || error), authResponses });
  } finally {
    await context.close();
    await browser.close();
  }
}

fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ generatedAt: report.generatedAt, issues: report.issues.length, issueCodes: [...new Set(report.issues.map((item) => item.code))] }, null, 2));
if (report.issues.length > 0) process.exit(1);
