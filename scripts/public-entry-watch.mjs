import fs from 'node:fs';
import path from 'node:path';
import { chromium, webkit } from '@playwright/test';

const base = 'https://xn----8sbjf4befbjgs9b.xn--p1ai';
const routes = ['/platform-v7', '/platform-v7/login', '/platform-v7/forgot-password'];
const locales = ['ru', 'en', 'zh'];
const artifactDir = path.resolve(process.cwd(), 'artifacts/public-entry-watch');
fs.mkdirSync(artifactDir, { recursive: true });

const report = {
  checkedAt: new Date().toISOString(),
  base,
  http: [],
  browser: [],
  failClosed: null,
  failures: [],
};

function fail(message) {
  report.failures.push(message);
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function hasRoleAuthority(url) {
  const parsed = new URL(url);
  return parsed.searchParams.has('role') || parsed.searchParams.has('as');
}

async function httpCheck(route) {
  let url = `${base}${route}`;
  const seen = new Set();
  const chain = [];

  for (let hop = 0; hop < 9; hop += 1) {
    if (seen.has(url)) fail(`${route}: redirect loop at ${url}`);
    seen.add(url);
    assert(!hasRoleAuthority(url), `${route}: role authority appeared in URL ${url}`);

    const response = await fetch(url, {
      redirect: 'manual',
      headers: {
        'user-agent': 'Transparent-Price-Public-Entry-Watch/1.0',
        accept: 'text/html,application/xhtml+xml',
        'accept-language': 'ru-RU,ru;q=0.9,en;q=0.8',
      },
      signal: AbortSignal.timeout(30_000),
    });
    const location = response.headers.get('location');
    chain.push({ url, status: response.status, location });

    if (response.status >= 300 && response.status < 400 && location) {
      url = new URL(location, url).toString();
      continue;
    }

    const body = await response.text();
    assert(response.status === 200, `${route}: expected HTTP 200, got ${response.status}`);
    assert(body.trim().length > 500, `${route}: suspiciously small HTML body (${body.length} bytes)`);
    assert(/text\/html/i.test(response.headers.get('content-type') || ''), `${route}: non-HTML content type`);
    report.http.push({ route, finalUrl: url, status: response.status, redirects: chain.length - 1, bodyBytes: body.length, chain });
    return;
  }

  fail(`${route}: more than 8 redirects`);
}

function errorPattern(value) {
  return /hydration|text content does not match|react(?:dom)? error|next-intl.*missing|missing message|uncaught|referenceerror|typeerror/i.test(value);
}

async function browserCase(browserType, browserName, viewport, route, locale) {
  const browser = await browserType.launch({ headless: true });
  const context = await browser.newContext({
    viewport,
    locale: locale === 'zh' ? 'zh-CN' : locale === 'en' ? 'en-GB' : 'ru-RU',
    isMobile: browserName.includes('webkit'),
    hasTouch: browserName.includes('webkit'),
  });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  const badResponses = [];

  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(String(error?.stack || error)));
  page.on('requestfailed', (request) => {
    const reason = request.failure()?.errorText || 'unknown';
    if (!reason.includes('ERR_ABORTED')) failedRequests.push({ url: request.url(), reason });
  });
  page.on('response', (response) => {
    if (response.url().startsWith(base) && response.status() >= 400 && !response.url().includes('favicon')) {
      badResponses.push({ url: response.url(), status: response.status() });
    }
  });

  const url = `${base}${route}?lang=${locale}&watch=${Date.now()}`;
  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => undefined);
  await page.waitForTimeout(600);

  assert(response?.status() === 200, `${browserName}/${locale}${route}: navigation status ${response?.status()}`);
  assert(page.url().includes(route), `${browserName}/${locale}${route}: redirected away to ${page.url()}`);
  assert(!hasRoleAuthority(page.url()), `${browserName}/${locale}${route}: role authority in final URL`);

  const state = await page.evaluate(() => ({
    lang: document.documentElement.lang,
    textLength: document.body?.innerText?.trim().length || 0,
    bodyRect: document.body?.getBoundingClientRect().toJSON?.() || null,
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    visibility: getComputedStyle(document.body).visibility,
    display: getComputedStyle(document.body).display,
    opacity: getComputedStyle(document.body).opacity,
    html: document.documentElement.innerHTML,
  }));

  assert(state.lang?.toLowerCase().startsWith(locale), `${browserName}/${locale}${route}: html lang=${state.lang}`);
  assert(state.textLength > 100, `${browserName}/${locale}${route}: probable white screen, text length ${state.textLength}`);
  assert(state.visibility !== 'hidden' && state.display !== 'none' && Number(state.opacity) > 0, `${browserName}/${locale}${route}: body hidden`);
  assert(state.scrollWidth <= state.clientWidth + 3, `${browserName}/${locale}${route}: horizontal overflow ${state.scrollWidth}/${state.clientWidth}`);
  assert(!consoleErrors.some(errorPattern), `${browserName}/${locale}${route}: hydration/runtime console error ${JSON.stringify(consoleErrors)}`);
  assert(pageErrors.length === 0, `${browserName}/${locale}${route}: page errors ${JSON.stringify(pageErrors)}`);
  assert(failedRequests.length === 0, `${browserName}/${locale}${route}: failed requests ${JSON.stringify(failedRequests)}`);
  assert(badResponses.length === 0, `${browserName}/${locale}${route}: bad resource responses ${JSON.stringify(badResponses)}`);

  if (route === '/platform-v7') {
    for (const language of locales) {
      assert(state.html.includes(`lang=${language}`) || state.html.includes(`lang%3D${language}`), `${browserName}/${locale}${route}: language switch lacks ${language}`);
    }
  }

  report.browser.push({
    browser: browserName,
    route,
    locale,
    finalUrl: page.url(),
    status: response.status(),
    textLength: state.textLength,
    consoleErrors,
    pageErrors,
    failedRequests,
    badResponses,
  });

  await context.close();
  await browser.close();
}

async function failClosedLoginCheck() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ru-RU' });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => pageErrors.push(String(error?.stack || error)));

  const navigation = await page.goto(`${base}/platform-v7/login?lang=ru&watch=${Date.now()}`, { waitUntil: 'networkidle', timeout: 45_000 });
  assert(navigation?.status() === 200, `fail-closed login: page status ${navigation?.status()}`);

  const beforeCookies = await context.cookies();
  const result = await page.evaluate(async () => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `public-watch-${Date.now()}@example.invalid`,
        password: 'Definitely-Wrong-Public-Watch-Password-93!',
      }),
    });
    const text = await response.text();
    let payload = {};
    try { payload = text ? JSON.parse(text) : {}; } catch { payload = { raw: text.slice(0, 500) }; }
    return { status: response.status, redirected: response.redirected, url: response.url, payload };
  });
  await page.waitForTimeout(500);

  const afterCookies = await context.cookies();
  const storage = await page.evaluate(() => ({
    local: Object.fromEntries(Object.keys(localStorage).map((key) => [key, localStorage.getItem(key)])),
    session: Object.fromEntries(Object.keys(sessionStorage).map((key) => [key, sessionStorage.getItem(key)])),
    href: location.href,
  }));

  const acceptedStatuses = new Set([400, 401, 403, 422, 429, 503]);
  assert(acceptedStatuses.has(result.status), `fail-closed login: unexpected status ${result.status}`);
  assert(!result.redirected, `fail-closed login: response redirected to ${result.url}`);
  assert(storage.href.includes('/platform-v7/login'), `fail-closed login: left login page ${storage.href}`);
  assert(!hasRoleAuthority(storage.href), `fail-closed login: role authority in URL ${storage.href}`);

  const beforeNames = new Set(beforeCookies.map((cookie) => cookie.name));
  const createdCookies = afterCookies.filter((cookie) => !beforeNames.has(cookie.name));
  const forbiddenCookies = createdCookies.filter((cookie) => /(access|refresh|session|mfa|cabinet|auth)/i.test(cookie.name));
  assert(forbiddenCookies.length === 0, `fail-closed login: auth cookies created ${forbiddenCookies.map((cookie) => cookie.name).join(', ')}`);

  const serializedStorage = JSON.stringify(storage);
  assert(!/demo.{0,24}(session|auth|login)|controlled.{0,12}test/i.test(serializedStorage), `fail-closed login: demo session marker in storage`);
  const payload = result.payload && typeof result.payload === 'object' ? result.payload : {};
  assert(!(payload.ok === true), 'fail-closed login: payload reported success');
  assert(!(typeof payload.redirectTo === 'string' && payload.redirectTo.startsWith('/platform-v7/')), `fail-closed login: protected redirect returned ${payload.redirectTo}`);
  assert(!consoleErrors.some(errorPattern), `fail-closed login: runtime/hydration console error ${JSON.stringify(consoleErrors)}`);
  assert(pageErrors.length === 0, `fail-closed login: page errors ${JSON.stringify(pageErrors)}`);

  report.failClosed = {
    status: result.status,
    payload,
    finalUrl: storage.href,
    createdCookies: createdCookies.map((cookie) => cookie.name),
    consoleErrors,
    pageErrors,
  };

  await context.close();
  await browser.close();
}

async function main() {
  for (const route of routes) await httpCheck(route);

  const projects = [
    { type: chromium, name: 'chromium-desktop', viewport: { width: 1440, height: 1000 } },
    { type: webkit, name: 'webkit-iphone', viewport: { width: 390, height: 844 } },
  ];

  for (const project of projects) {
    for (const locale of locales) {
      for (const route of routes) {
        await browserCase(project.type, project.name, project.viewport, route, locale);
      }
    }
  }

  await failClosedLoginCheck();
}

try {
  await main();
} catch (error) {
  if (!report.failures.includes(String(error?.message || error))) report.failures.push(String(error?.message || error));
  process.exitCode = 1;
} finally {
  fs.writeFileSync(path.join(artifactDir, 'result.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ok: report.failures.length === 0, failures: report.failures, cases: report.browser.length, failClosed: report.failClosed?.status }, null, 2));
}
