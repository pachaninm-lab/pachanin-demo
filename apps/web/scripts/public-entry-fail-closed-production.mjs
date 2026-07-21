import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const baseURL = process.env.BASE_URL || 'https://xn----8sbjf4befbjgs9b.xn--p1ai';
const artifactDir = path.resolve(process.cwd(), '../../', process.env.ARTIFACT_DIR || 'artifacts/public-entry-fail-closed');
fs.mkdirSync(artifactDir, { recursive: true });
const result = { checkedAt: new Date().toISOString(), baseURL, ok: false, fatal: null };
const runtimePattern = /(hydration|hydrated|react error|next-intl|missing message|chunkloaderror|referenceerror|typeerror|syntaxerror|uncaught|invariant|maximum update depth|too many redirects)/i;
const hasDemo = (value) => /(demo|mock|fake)/i.test(JSON.stringify(value));
const assert = (condition, message) => { if (!condition) throw new Error(message); };

let browser;
try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'ru-RU' });
  const page = await context.newPage();
  const authResponses = [];
  const failedRequests = [];
  const runtimeErrors = [];
  const pageErrors = [];
  page.on('response', (response) => {
    if (/\/api\/auth\/(login|mfa-login)/.test(response.url())) {
      authResponses.push({ url: response.url(), status: response.status() });
    }
  });
  page.on('requestfailed', (request) => {
    if (/\/api\/auth\/(login|mfa-login)/.test(request.url())) {
      failedRequests.push({ url: request.url(), failure: request.failure()?.errorText || 'unknown' });
    }
  });
  page.on('console', (message) => {
    if (message.type() === 'error' && runtimePattern.test(message.text())) runtimeErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(String(error?.stack || error)));

  try {
    const response = await page.goto(`${baseURL}/platform-v7/login?lang=ru`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    assert(response?.status() === 200, `login document HTTP ${response?.status()}`);
    const email = page.locator('#pc-auth-email');
    const password = page.locator('#pc-auth-password');
    const form = page.locator('form.pc-auth-card').first();
    const submit = form.locator('button.pc-auth-submit[type="submit"]');
    assert(await email.count() === 1 && await password.count() === 1 && await form.count() === 1 && await submit.count() === 1, 'canonical login form incomplete');
    await email.fill('monitor-nonexistent@example.test');
    await password.fill('Invalid-Monitor-Password-2026!');
    await submit.click();
    await page.waitForFunction(() => {
      const error = document.querySelector('#pc-auth-error');
      const button = document.querySelector('button.pc-auth-submit');
      return Boolean(error?.textContent?.trim()) || button?.getAttribute('aria-busy') === 'false';
    }, null, { timeout: 15_000 }).catch(() => {});
    await page.waitForTimeout(500);

    const finalURL = new URL(page.url());
    const state = await page.evaluate(() => ({
      errorText: document.querySelector('#pc-auth-error')?.textContent?.trim() || '',
      submitBusy: document.querySelector('button.pc-auth-submit')?.getAttribute('aria-busy'),
      body: document.body.innerText,
      localStorage: Object.fromEntries(Object.entries(localStorage)),
      sessionStorage: Object.fromEntries(Object.entries(sessionStorage)),
    }));
    const cookies = await context.cookies();
    const forbiddenCookies = cookies.filter((cookie) => /(access|refresh|session|mfa|cabinet|demo|mock)/i.test(cookie.name));
    const rejected = authResponses.some((item) => [400, 401, 403, 404, 409, 422, 429, 503].includes(item.status));

    assert(finalURL.pathname.replace(/\/$/, '') === '/platform-v7/login', `escaped login to ${finalURL.pathname}`);
    assert(!finalURL.searchParams.has('role') && !finalURL.searchParams.has('as'), 'role/as appeared in URL');
    assert(forbiddenCookies.length === 0, `auth/demo cookies created: ${forbiddenCookies.map((item) => item.name).join(',')}`);
    assert(!hasDemo(state.localStorage) && !hasDemo(state.sessionStorage), 'demo/mock storage created');
    assert(runtimeErrors.length === 0 && pageErrors.length === 0, `runtime errors: ${JSON.stringify({ runtimeErrors, pageErrors })}`);
    assert(rejected || failedRequests.length > 0 || state.errorText.length > 0, `no rejection or visible error; responses=${JSON.stringify(authResponses)} failed=${JSON.stringify(failedRequests)}`);

    Object.assign(result, {
      ok: true,
      documentHttp: 200,
      finalURL: page.url(),
      authResponses,
      failedRequests,
      errorText: state.errorText,
      cookies: cookies.map((item) => item.name),
      forbiddenCookies: [],
      demoStorage: false,
      runtimeErrors: 0,
    });
  } finally {
    await context.close();
  }
} catch (error) {
  result.fatal = String(error?.stack || error);
} finally {
  if (browser) await browser.close().catch(() => {});
  fs.writeFileSync(path.join(artifactDir, 'result.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
}
