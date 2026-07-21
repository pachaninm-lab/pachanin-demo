import { chromium, webkit } from '@playwright/test';

const base = 'https://xn----8sbjf4befbjgs9b.xn--p1ai';
const routes = ['/platform-v7', '/platform-v7/login', '/platform-v7/forgot-password'];
const locales = ['ru', 'en', 'zh'];
const report = { checkedAt: new Date().toISOString(), http: [], browser: [], failClosed: null, failures: [] };

function roleInUrl(value) {
  const url = new URL(value);
  return url.searchParams.has('role') || url.searchParams.has('as');
}
function fail(message) {
  report.failures.push(message);
  throw new Error(message);
}
function assert(condition, message) {
  if (!condition) fail(message);
}
function productError(value) {
  return /hydration|text content does not match|next-intl.*missing|missing message|uncaught|referenceerror|typeerror/i.test(value);
}

async function checkHttp(route) {
  const seen = new Set();
  let url = `${base}${route}`;
  const chain = [];
  for (let hop = 0; hop < 8; hop += 1) {
    assert(!seen.has(url), `${route}: redirect loop at ${url}`);
    assert(!roleInUrl(url), `${route}: role/as authority in URL ${url}`);
    seen.add(url);
    const response = await fetch(url, {
      redirect: 'manual',
      headers: { accept: 'text/html', 'user-agent': 'Transparent-Price-Public-Entry-Watch/2.1' },
      signal: AbortSignal.timeout(20_000),
    });
    const location = response.headers.get('location');
    chain.push({ url, status: response.status, location });
    if (response.status >= 300 && response.status < 400 && location) {
      url = new URL(location, url).toString();
      continue;
    }
    const html = await response.text();
    assert(response.status === 200, `${route}: HTTP ${response.status}`);
    assert(/text\/html/i.test(response.headers.get('content-type') || ''), `${route}: non-HTML response`);
    assert(html.trim().length > 500, `${route}: probable empty HTML (${html.length} bytes)`);
    report.http.push({ route, finalUrl: url, status: response.status, redirects: chain.length - 1, bytes: html.length });
    return;
  }
  fail(`${route}: redirect chain exceeded 8 hops`);
}

async function browserMatrix(browserType, name, viewport, mobile = false) {
  const browser = await browserType.launch({ headless: true });
  try {
    for (const locale of locales) {
      const context = await browser.newContext({
        viewport,
        isMobile: mobile,
        hasTouch: mobile,
        locale: locale === 'zh' ? 'zh-CN' : locale === 'en' ? 'en-GB' : 'ru-RU',
      });
      try {
        for (const route of routes) {
          const page = await context.newPage();
          const consoleErrors = [];
          const pageErrors = [];
          const failedRequests = [];
          page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
          page.on('pageerror', (error) => pageErrors.push(String(error?.stack || error)));
          page.on('requestfailed', (request) => {
            const reason = request.failure()?.errorText || 'unknown';
            if (!reason.includes('ERR_ABORTED')) failedRequests.push({ url: request.url(), reason });
          });
          const response = await page.goto(`${base}${route}?lang=${locale}&watch=${Date.now()}`, {
            waitUntil: 'domcontentloaded',
            timeout: 30_000,
          });
          await page.waitForTimeout(1_000);
          assert(response?.status() === 200, `${name}/${locale}${route}: HTTP ${response?.status()}`);
          assert(page.url().includes(route), `${name}/${locale}${route}: redirected to ${page.url()}`);
          assert(!roleInUrl(page.url()), `${name}/${locale}${route}: role/as in final URL`);
          const state = await page.evaluate(() => ({
            lang: document.documentElement.lang,
            text: document.body?.innerText?.trim() || '',
            width: document.documentElement.clientWidth,
            scrollWidth: document.documentElement.scrollWidth,
            display: getComputedStyle(document.body).display,
            visibility: getComputedStyle(document.body).visibility,
            opacity: Number(getComputedStyle(document.body).opacity),
            mainCount: document.querySelectorAll('main').length,
            formCount: document.querySelectorAll('form').length,
            emailCount: document.querySelectorAll('input[type="email"], input[name="email"]').length,
            passwordCount: document.querySelectorAll('input[type="password"], input[name="password"]').length,
            submitCount: document.querySelectorAll('button[type="submit"], input[type="submit"]').length,
          }));
          assert(state.lang.toLowerCase().startsWith(locale), `${name}/${locale}${route}: html lang ${state.lang}`);
          assert(state.text.length > 30 && state.mainCount > 0, `${name}/${locale}${route}: probable white screen (${state.text.length} chars, ${state.mainCount} main)`);
          if (route === '/platform-v7') assert(state.text.length > 500, `${name}/${locale}${route}: landing content incomplete (${state.text.length} chars)`);
          if (route === '/platform-v7/login') {
            assert(state.formCount > 0 && state.emailCount > 0 && state.passwordCount > 0 && state.submitCount > 0, `${name}/${locale}${route}: login form incomplete`);
          }
          if (route === '/platform-v7/forgot-password') {
            assert(state.formCount > 0 && state.emailCount > 0 && state.submitCount > 0, `${name}/${locale}${route}: recovery form incomplete`);
          }
          assert(state.display !== 'none' && state.visibility !== 'hidden' && state.opacity > 0, `${name}/${locale}${route}: hidden body`);
          assert(state.scrollWidth <= state.width + 3, `${name}/${locale}${route}: overflow ${state.scrollWidth}/${state.width}`);
          assert(pageErrors.length === 0, `${name}/${locale}${route}: page errors ${JSON.stringify(pageErrors)}`);
          assert(!consoleErrors.some(productError), `${name}/${locale}${route}: runtime/hydration errors ${JSON.stringify(consoleErrors)}`);
          assert(failedRequests.length === 0, `${name}/${locale}${route}: failed requests ${JSON.stringify(failedRequests)}`);
          report.browser.push({ browser: name, locale, route, status: response.status(), finalUrl: page.url(), textLength: state.text.length, consoleErrors, pageErrors, failedRequests });
          await page.close();
        }
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
}

async function failClosed() {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ru-RU' });
    try {
      const page = await context.newPage();
      const response = await page.goto(`${base}/platform-v7/login?lang=ru&watch=${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      assert(response?.status() === 200, `fail-closed: login page HTTP ${response?.status()}`);
      const before = new Set((await context.cookies()).map((cookie) => cookie.name));
      const result = await page.evaluate(async () => {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: `watch-${Date.now()}@example.invalid`, password: 'Wrong-Public-Watch-Password-93!' }),
        });
        const text = await response.text();
        let payload = {};
        try { payload = text ? JSON.parse(text) : {}; } catch { payload = { raw: text.slice(0, 300) }; }
        return { status: response.status, redirected: response.redirected, payload };
      });
      const created = (await context.cookies()).filter((cookie) => !before.has(cookie.name));
      const forbidden = created.filter((cookie) => /(access|refresh|session|mfa|cabinet|auth)/i.test(cookie.name));
      const storage = await page.evaluate(() => JSON.stringify({ local: localStorage, session: sessionStorage, href: location.href }));
      assert([400, 401, 403, 422, 429, 503].includes(result.status), `fail-closed: unexpected HTTP ${result.status}`);
      assert(!result.redirected, 'fail-closed: API redirected');
      assert(page.url().includes('/platform-v7/login'), `fail-closed: left login page ${page.url()}`);
      assert(!roleInUrl(page.url()), `fail-closed: role/as in URL ${page.url()}`);
      assert(forbidden.length === 0, `fail-closed: auth cookies created ${forbidden.map((cookie) => cookie.name).join(',')}`);
      assert(result.payload?.ok !== true, 'fail-closed: API returned success');
      assert(!/demo.{0,24}(session|auth|login)/i.test(storage), 'fail-closed: demo session marker in storage');
      report.failClosed = { status: result.status, createdCookies: created.map((cookie) => cookie.name), finalUrl: page.url(), payload: result.payload };
    } finally {
      await context.close();
    }
  } finally {
    await browser.close();
  }
}

try {
  for (const route of routes) await checkHttp(route);
  await browserMatrix(chromium, 'chromium-desktop', { width: 1440, height: 1000 });
  await browserMatrix(webkit, 'webkit-iphone', { width: 390, height: 844 }, true);
  await failClosed();
} catch (error) {
  const message = String(error?.message || error);
  if (!report.failures.includes(message)) report.failures.push(message);
}

console.log(JSON.stringify(report));
process.exit(report.failures.length ? 1 : 0);
