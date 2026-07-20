import fs from 'node:fs';
import path from 'node:path';
import { chromium, webkit } from '@playwright/test';

const baseURL = 'https://xn----8sbjf4befbjgs9b.xn--p1ai';
const routes = ['/platform-v7', '/platform-v7/login', '/platform-v7/forgot-password'];
const locales = ['ru', 'en', 'zh'];
const artifacts = path.resolve(process.cwd(), 'artifacts/public-entry-watch-20260720');
fs.mkdirSync(artifacts, { recursive: true });

const report = {
  checkedAt: new Date().toISOString(),
  baseURL,
  http: [],
  browser: [],
  failClosed: null,
  failures: [],
};

function fail(message, details = {}) {
  report.failures.push({ message, ...details });
}

async function fetchChain(initialUrl) {
  const visited = [];
  let url = initialUrl;
  for (let hop = 0; hop < 8; hop += 1) {
    if (visited.includes(url)) throw new Error(`redirect loop: ${[...visited, url].join(' -> ')}`);
    visited.push(url);
    const response = await fetch(url, {
      redirect: 'manual',
      headers: { 'user-agent': 'Transparent-Price-Public-Entry-Watch/1.0' },
      signal: AbortSignal.timeout(20_000),
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) throw new Error(`redirect ${response.status} without location`);
      url = new URL(location, url).toString();
      continue;
    }
    return { status: response.status, finalUrl: url, redirects: visited.length - 1 };
  }
  throw new Error('too many redirects');
}

for (const route of routes) {
  try {
    const result = await fetchChain(`${baseURL}${route}`);
    report.http.push({ route, ...result });
    if (result.status !== 200) fail(`${route}: expected HTTP 200, got ${result.status}`, result);
    const final = new URL(result.finalUrl);
    if (final.searchParams.has('role') || final.searchParams.has('as')) {
      fail(`${route}: role authority leaked into URL`, { finalUrl: result.finalUrl });
    }
  } catch (error) {
    fail(`${route}: HTTP check failed`, { error: String(error?.stack || error) });
  }
}

const projects = [
  { name: 'chromium-desktop', engine: chromium, viewport: { width: 1440, height: 1000 }, mobile: false },
  { name: 'chromium-mobile', engine: chromium, viewport: { width: 390, height: 844 }, mobile: true },
  { name: 'webkit-iphone', engine: webkit, viewport: { width: 390, height: 844 }, mobile: true },
];

const hydrationPatterns = [
  /hydration failed/i,
  /error while hydrating/i,
  /text content does not match/i,
  /minified react error #(418|423|425)/i,
  /next-intl.*missing/i,
  /application error/i,
  /chunkloaderror/i,
];

function isIgnoredResource(url) {
  return /favicon|apple-touch-icon|manifest\.webmanifest|robots\.txt/i.test(url);
}

for (const project of projects) {
  const browser = await project.engine.launch({ headless: true });
  try {
    for (const locale of locales) {
      for (const route of routes) {
        const context = await browser.newContext({
          viewport: project.viewport,
          isMobile: project.mobile,
          hasTouch: project.mobile,
          locale: locale === 'ru' ? 'ru-RU' : locale === 'zh' ? 'zh-CN' : 'en-US',
          ignoreHTTPSErrors: false,
        });
        const page = await context.newPage();
        const consoleErrors = [];
        const pageErrors = [];
        const failedRequests = [];
        const badResponses = [];
        const navigations = [];

        page.on('console', (message) => {
          const text = message.text();
          if (message.type() === 'error' || hydrationPatterns.some((pattern) => pattern.test(text))) {
            consoleErrors.push(text);
          }
        });
        page.on('pageerror', (error) => pageErrors.push(String(error?.stack || error)));
        page.on('requestfailed', (request) => {
          const reason = request.failure()?.errorText || 'unknown';
          if (!reason.includes('ERR_ABORTED') && !isIgnoredResource(request.url())) {
            failedRequests.push({ url: request.url(), reason });
          }
        });
        page.on('response', (response) => {
          if (response.status() >= 400 && response.url().startsWith(baseURL) && !isIgnoredResource(response.url())) {
            badResponses.push({ url: response.url(), status: response.status() });
          }
        });
        page.on('framenavigated', (frame) => {
          if (frame === page.mainFrame()) navigations.push(frame.url());
        });

        const requestedUrl = `${baseURL}${route}?lang=${locale}`;
        try {
          const response = await page.goto(requestedUrl, { waitUntil: 'domcontentloaded', timeout: 45_000 });
          await page.waitForTimeout(1_500);
          const status = response?.status() ?? 0;
          const finalUrl = page.url();
          const final = new URL(finalUrl);
          const htmlLang = (await page.locator('html').getAttribute('lang')) || '';
          const layout = await page.evaluate(() => {
            const body = document.body;
            const text = body?.innerText?.trim() || '';
            const rect = body?.getBoundingClientRect();
            const visibleElements = [...document.querySelectorAll('main,form,h1,header')].filter((element) => {
              const style = getComputedStyle(element);
              const box = element.getBoundingClientRect();
              return style.display !== 'none' && style.visibility !== 'hidden' && box.width > 0 && box.height > 0;
            }).length;
            const languageTargets = new Set();
            for (const anchor of document.querySelectorAll('a[href]')) {
              const href = anchor.getAttribute('href') || '';
              const match = href.match(/[?&]lang=(ru|en|zh)(?:&|$)/i);
              if (match) languageTargets.add(match[1].toLowerCase());
            }
            for (const element of document.querySelectorAll('button,[role="button"]')) {
              const value = (element.textContent || '').trim().toLowerCase();
              if (['ru','en','zh'].includes(value)) languageTargets.add(value);
            }
            return {
              textLength: text.length,
              bodyWidth: rect?.width || 0,
              bodyHeight: rect?.height || 0,
              scrollWidth: document.documentElement.scrollWidth,
              clientWidth: document.documentElement.clientWidth,
              visibleElements,
              languageTargets: [...languageTargets],
              title: document.title,
              textSample: text.slice(0, 500),
            };
          });

          const minText = route === '/platform-v7' ? 400 : 100;
          if (status !== 200) fail(`${project.name}/${locale}${route}: expected HTTP 200, got ${status}`);
          if (!final.pathname.startsWith(route)) fail(`${project.name}/${locale}${route}: unexpected final URL`, { finalUrl });
          if (final.searchParams.has('role') || final.searchParams.has('as')) fail(`${project.name}/${locale}${route}: role/as found in URL`, { finalUrl });
          if (!htmlLang.toLowerCase().startsWith(locale)) fail(`${project.name}/${locale}${route}: html lang mismatch`, { htmlLang });
          if (layout.textLength < minText || layout.bodyWidth < 100 || layout.bodyHeight < 100 || layout.visibleElements < 1) {
            fail(`${project.name}/${locale}${route}: probable white or incomplete screen`, { layout });
          }
          if (layout.scrollWidth > layout.clientWidth + 2 && project.mobile) {
            fail(`${project.name}/${locale}${route}: horizontal overflow`, { scrollWidth: layout.scrollWidth, clientWidth: layout.clientWidth });
          }
          if (!['ru','en','zh'].every((value) => layout.languageTargets.includes(value))) {
            fail(`${project.name}/${locale}${route}: RU/EN/ZH controls incomplete`, { languageTargets: layout.languageTargets });
          }
          if (navigations.length > 6) fail(`${project.name}/${locale}${route}: excessive navigations`, { navigations });
          if (consoleErrors.length) fail(`${project.name}/${locale}${route}: console/hydration errors`, { consoleErrors });
          if (pageErrors.length) fail(`${project.name}/${locale}${route}: runtime page errors`, { pageErrors });
          if (failedRequests.length) fail(`${project.name}/${locale}${route}: failed requests`, { failedRequests });
          if (badResponses.length) fail(`${project.name}/${locale}${route}: bad same-origin responses`, { badResponses });

          const screenshotName = `${project.name}-${locale}-${route.split('/').filter(Boolean).pop() || 'root'}.png`;
          await page.screenshot({ path: path.join(artifacts, screenshotName), fullPage: true });
          report.browser.push({
            project: project.name,
            locale,
            route,
            status,
            finalUrl,
            htmlLang,
            layout,
            navigations,
            consoleErrors,
            pageErrors,
            failedRequests,
            badResponses,
          });
        } catch (error) {
          fail(`${project.name}/${locale}${route}: browser check failed`, { error: String(error?.stack || error), navigations });
        } finally {
          await context.close();
        }
      }
    }
  } finally {
    await browser.close();
  }
}

// Real fail-closed authentication check with invalid credentials.
{
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'ru-RU' });
  const page = await context.newPage();
  const authResponses = [];
  const consoleErrors = [];
  page.on('response', (response) => {
    if (/\/api\/(auth|platform-v7\/auth)|\/login/i.test(response.url())) {
      authResponses.push({ url: response.url(), status: response.status() });
    }
  });
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  try {
    await page.goto(`${baseURL}/platform-v7/login?lang=ru`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    const beforeCookies = await context.cookies();
    const email = page.locator('input[type="email"],input[name*="email" i],input[autocomplete="username"]').first();
    const password = page.locator('input[type="password"],input[autocomplete="current-password"]').first();
    const submit = page.locator('button[type="submit"],input[type="submit"]').first();
    if (!(await email.count()) || !(await password.count()) || !(await submit.count())) {
      fail('fail-closed login: login form controls not found');
    } else {
      await email.fill(`watch-${Date.now()}@example.invalid`);
      await password.fill('Invalid-Password-For-Fail-Closed-Check-2026!');
      await submit.click();
      await page.waitForTimeout(5_000);
      const afterCookies = await context.cookies();
      const beforeNames = new Set(beforeCookies.map((cookie) => cookie.name));
      const newSensitiveCookies = afterCookies.filter((cookie) => {
        const key = `${cookie.name}=${cookie.value}`.toLowerCase();
        return !beforeNames.has(cookie.name) && /(access|refresh|jwt|mfa|cabinet|auth[-_]?session|demo)/.test(key);
      });
      const storage = await page.evaluate(() => ({
        local: Object.fromEntries(Object.entries(localStorage)),
        session: Object.fromEntries(Object.entries(sessionStorage)),
        body: document.body.innerText.slice(0, 1000),
      }));
      const finalUrl = page.url();
      const apiFailure = authResponses.some((item) => [400, 401, 403, 409, 422, 429, 503].includes(item.status));
      const successLikeUrl = /\/platform-v7\/(buyer|seller|driver|bank|lab|elevator|surveyor|logistics|executive|control-tower|operator|deals)/i.test(new URL(finalUrl).pathname);
      const demoMaterial = JSON.stringify({ cookies: afterCookies, storage }).match(/demo[_-]?(session|user|role)|"demo"/i);
      if (successLikeUrl) fail('fail-closed login: invalid credentials reached a cabinet', { finalUrl });
      if (newSensitiveCookies.length) fail('fail-closed login: sensitive session cookies were created', { newSensitiveCookies });
      if (demoMaterial) fail('fail-closed login: demo session material detected');
      if (!apiFailure) fail('fail-closed login: no explicit rejected/unavailable auth response observed', { authResponses, finalUrl, body: storage.body });
      if (consoleErrors.some((value) => hydrationPatterns.some((pattern) => pattern.test(value)))) {
        fail('fail-closed login: runtime/hydration error during submission', { consoleErrors });
      }
      report.failClosed = { finalUrl, authResponses, newSensitiveCookies, demoMaterial: Boolean(demoMaterial), bodySample: storage.body };
      await page.screenshot({ path: path.join(artifacts, 'fail-closed-login.png'), fullPage: true });
    }
  } catch (error) {
    fail('fail-closed login check failed', { error: String(error?.stack || error) });
  } finally {
    await context.close();
    await browser.close();
  }
}

fs.writeFileSync(path.join(artifacts, 'public-entry-watch.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ checkedAt: report.checkedAt, http: report.http, browserCases: report.browser.length, failClosed: report.failClosed, failures: report.failures }, null, 2));
if (report.failures.length) process.exit(1);
