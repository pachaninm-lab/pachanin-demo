import fs from 'node:fs';
import path from 'node:path';
import { chromium, webkit } from '@playwright/test';

const baseURL = process.env.WATCH_BASE_URL || 'https://xn----8sbjf4befbjgs9b.xn--p1ai';
const artifactDir = path.resolve(process.cwd(), process.env.WATCH_ARTIFACT_DIR || '../../artifacts/prod-public-entry-watch');
fs.mkdirSync(artifactDir, { recursive: true });

const routes = ['/platform-v7', '/platform-v7/login', '/platform-v7/forgot-password'];
const locales = ['ru', 'en', 'zh'];
const projects = [
  { name: 'chromium-desktop', browserType: chromium, viewport: { width: 1440, height: 1000 } },
  { name: 'chromium-mobile', browserType: chromium, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
  { name: 'webkit-mobile', browserType: webkit, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
];
const report = { generatedAt: new Date().toISOString(), baseURL, cases: [], failClosed: [], failures: [] };
const hydrationPattern = /(hydration|hydrated|react error|text content does not match|next-intl.*missing|missing message|maximum update depth|too many re-renders)/i;
const authLike = /(access|refresh|session|mfa|cabinet|auth|token)/i;
const demoLike = /(demo|mock|fake)/i;

function roleParam(url) {
  const parsed = new URL(url);
  return parsed.searchParams.has('role') || parsed.searchParams.has('as');
}
function redirectCount(request) {
  let count = 0;
  let current = request;
  while (current.redirectedFrom()) { count += 1; current = current.redirectedFrom(); }
  return count;
}
function recordFailure(message) {
  report.failures.push(message);
  console.error(message);
}
async function languageControls(page) {
  return page.locator('a,button').evaluateAll((nodes) => nodes.map((node) => ({
    text: (node.textContent || '').trim().toLowerCase(),
    href: node instanceof HTMLAnchorElement ? node.href : '',
    aria: (node.getAttribute('aria-label') || '').toLowerCase(),
  })));
}
function containsLanguage(controls, locale) {
  return controls.some((item) => {
    const haystack = `${item.text} ${item.href} ${item.aria}`;
    if (locale === 'ru') return /(^|\W)(ru|рус|русский)(\W|$)|[?&]lang=ru(?:&|$)/i.test(haystack);
    if (locale === 'en') return /(^|\W)(en|eng|english)(\W|$)|[?&]lang=en(?:&|$)/i.test(haystack);
    return /(^|\W)(zh|中文|汉语|中國|中国)(\W|$)|[?&]lang=zh(?:&|$)/i.test(haystack);
  });
}

for (const project of projects) {
  const browser = await project.browserType.launch({ headless: true });
  for (const locale of locales) {
    const context = await browser.newContext({
      viewport: project.viewport,
      isMobile: project.isMobile,
      hasTouch: project.hasTouch,
      locale: locale === 'ru' ? 'ru-RU' : locale === 'zh' ? 'zh-CN' : 'en-US',
    });

    for (const route of routes) {
      const page = await context.newPage();
      const consoleErrors = [];
      const pageErrors = [];
      const failedRequests = [];
      const badResponses = [];
      page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
      page.on('pageerror', (error) => pageErrors.push(String(error?.stack || error)));
      page.on('requestfailed', (request) => {
        const reason = request.failure()?.errorText || 'unknown';
        if (!reason.includes('ERR_ABORTED')) failedRequests.push({ url: request.url(), reason });
      });
      page.on('response', (response) => {
        if (response.url().startsWith(baseURL) && response.status() >= 400 && !response.url().includes('/favicon')) {
          badResponses.push({ url: response.url(), status: response.status() });
        }
      });
      const target = `${baseURL}${route}?lang=${locale}`;
      try {
        const response = await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 45_000 });
        await page.waitForTimeout(1800);
        const finalUrl = page.url();
        const status = response?.status() ?? 0;
        const redirects = response ? redirectCount(response.request()) : 99;
        const body = await page.locator('body').innerText().catch(() => '');
        const bodyLength = body.trim().length;
        const visibleMain = await page.locator('main, [role="main"], body').first().isVisible().catch(() => false);
        const controls = await languageControls(page);
        const languages = { ru: containsLanguage(controls, 'ru'), en: containsLanguage(controls, 'en'), zh: containsLanguage(controls, 'zh') };
        const storage = await page.evaluate(() => ({ local: Object.keys(localStorage), session: Object.keys(sessionStorage) })).catch(() => ({ local: [], session: [] }));
        const productConsole = consoleErrors.filter((value) => !/favicon|extension|devtools/i.test(value));
        const hydrationErrors = [...productConsole, ...pageErrors].filter((value) => hydrationPattern.test(value));
        report.cases.push({ project: project.name, locale, route, status, redirects, finalUrl, bodyLength, visibleMain, languages, consoleErrors: productConsole, pageErrors, failedRequests, badResponses, storage });
        const prefix = `${project.name}/${locale}${route}`;
        if (status !== 200) recordFailure(`${prefix}: HTTP ${status}`);
        if (redirects > 5) recordFailure(`${prefix}: redirect chain ${redirects}`);
        if (!new URL(finalUrl).pathname.startsWith(route)) recordFailure(`${prefix}: unexpected final URL ${finalUrl}`);
        if (roleParam(finalUrl)) recordFailure(`${prefix}: role authority appeared in URL ${finalUrl}`);
        if (!visibleMain || bodyLength < 100) recordFailure(`${prefix}: probable blank screen (${bodyLength} chars)`);
        if (!languages.ru || !languages.en || !languages.zh) recordFailure(`${prefix}: RU/EN/ZH controls incomplete ${JSON.stringify(languages)}`);
        if (hydrationErrors.length) recordFailure(`${prefix}: hydration/runtime errors ${JSON.stringify(hydrationErrors)}`);
        if (pageErrors.length) recordFailure(`${prefix}: page errors ${JSON.stringify(pageErrors)}`);
        if (failedRequests.length) recordFailure(`${prefix}: failed requests ${JSON.stringify(failedRequests)}`);
        const unexpectedBad = badResponses.filter((item) => !item.url.includes('/api/auth/'));
        if (unexpectedBad.length) recordFailure(`${prefix}: bad responses ${JSON.stringify(unexpectedBad)}`);
        if ([...storage.local, ...storage.session].some((key) => demoLike.test(key))) recordFailure(`${prefix}: demo/mock browser storage key detected`);
      } catch (error) {
        recordFailure(`${project.name}/${locale}${route}: navigation failure ${String(error?.stack || error)}`);
      } finally {
        await page.close();
      }
    }

    const page = await context.newPage();
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
    page.on('pageerror', (error) => pageErrors.push(String(error?.stack || error)));
    try {
      await page.goto(`${baseURL}/platform-v7/login?lang=${locale}`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
      await page.waitForTimeout(800);
      const beforeCookies = await context.cookies();
      const beforeNames = new Set(beforeCookies.map((cookie) => cookie.name));
      const email = page.locator('input[type="email"], input[name*="email" i], input[autocomplete="username"]').first();
      const password = page.locator('input[type="password"]').first();
      const submit = page.locator('button[type="submit"], input[type="submit"]').first();
      if (!await email.isVisible() || !await password.isVisible() || !await submit.isVisible()) throw new Error('login controls missing');
      await email.fill(`monitoring-${Date.now()}@example.invalid`);
      await password.fill(`Wrong-${Date.now()}-Password!`);
      const responsePromise = page.waitForResponse((response) => response.url().startsWith(baseURL) && /\/api\/auth\//.test(response.url()), { timeout: 12_000 }).catch(() => null);
      await submit.click();
      const authResponse = await responsePromise;
      await page.waitForTimeout(1800);
      const afterCookies = await context.cookies();
      const newCookies = afterCookies.filter((cookie) => !beforeNames.has(cookie.name));
      const storage = await page.evaluate(() => ({ local: Object.entries(localStorage), session: Object.entries(sessionStorage) }));
      const finalUrl = page.url();
      const authStatus = authResponse?.status() ?? null;
      const authCookies = newCookies.filter((cookie) => authLike.test(cookie.name));
      const demoArtifacts = [
        ...newCookies.map((cookie) => `${cookie.name}=${cookie.value}`),
        ...storage.local.flatMap((entry) => entry),
        ...storage.session.flatMap((entry) => entry),
      ].filter((value) => demoLike.test(value));
      report.failClosed.push({ project: project.name, locale, authStatus, finalUrl, newCookies: newCookies.map((cookie) => cookie.name), authCookies: authCookies.map((cookie) => cookie.name), demoArtifacts, consoleErrors, pageErrors });
      const prefix = `${project.name}/${locale}/fail-closed`;
      if (!new URL(finalUrl).pathname.startsWith('/platform-v7/login')) recordFailure(`${prefix}: login escaped to ${finalUrl}`);
      if (roleParam(finalUrl)) recordFailure(`${prefix}: role authority appeared in URL ${finalUrl}`);
      if (authStatus !== null && ![400, 401, 403, 404, 409, 422, 429, 500, 502, 503, 504].includes(authStatus)) recordFailure(`${prefix}: unexpected auth status ${authStatus}`);
      if (authCookies.length) recordFailure(`${prefix}: auth/session cookies created ${authCookies.map((cookie) => cookie.name).join(',')}`);
      if (demoArtifacts.length) recordFailure(`${prefix}: demo/mock session artifacts ${JSON.stringify(demoArtifacts)}`);
      const hydrationErrors = [...consoleErrors, ...pageErrors].filter((value) => hydrationPattern.test(value));
      if (hydrationErrors.length) recordFailure(`${prefix}: hydration/runtime errors ${JSON.stringify(hydrationErrors)}`);
    } catch (error) {
      recordFailure(`${project.name}/${locale}/fail-closed: ${String(error?.stack || error)}`);
    } finally {
      await page.close();
      await context.close();
    }
  }
  await browser.close();
}

fs.writeFileSync(path.join(artifactDir, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ cases: report.cases.length, failClosed: report.failClosed.length, failures: report.failures }, null, 2));
if (report.failures.length) process.exit(1);
