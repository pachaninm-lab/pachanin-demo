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

const fail = (message) => { report.failures.push(message); console.error(message); };
const hasRoleParam = (url) => {
  const parsed = new URL(url);
  return parsed.searchParams.has('role') || parsed.searchParams.has('as');
};
const redirects = (request) => {
  let count = 0;
  let current = request;
  while (current.redirectedFrom()) { count += 1; current = current.redirectedFrom(); }
  return count;
};

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
      const prefix = `${project.name}/${locale}${route}`;
      try {
        const response = await page.goto(`${baseURL}${route}?lang=${locale}`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
        await page.waitForTimeout(1600);
        const finalUrl = page.url();
        const status = response?.status() ?? 0;
        const redirectCount = response ? redirects(response.request()) : 99;
        const body = await page.locator('body').innerText().catch(() => '');
        const bodyLength = body.trim().length;
        const htmlLang = (await page.locator('html').getAttribute('lang').catch(() => null)) || '';
        const visibleRoot = await page.locator('main, [role="main"], body').first().isVisible().catch(() => false);
        const productConsole = consoleErrors.filter((value) => !/favicon|extension|devtools/i.test(value));
        const hydrationErrors = [...productConsole, ...pageErrors].filter((value) => hydrationPattern.test(value));
        const storage = await page.evaluate(() => ({ local: Object.keys(localStorage), session: Object.keys(sessionStorage) })).catch(() => ({ local: [], session: [] }));
        report.cases.push({ project: project.name, locale, route, status, redirectCount, finalUrl, bodyLength, htmlLang, visibleRoot, consoleErrors: productConsole, pageErrors, failedRequests, badResponses, storage });

        if (status !== 200) fail(`${prefix}: HTTP ${status}`);
        if (redirectCount > 5) fail(`${prefix}: redirect chain ${redirectCount}`);
        if (!new URL(finalUrl).pathname.startsWith(route)) fail(`${prefix}: unexpected final URL ${finalUrl}`);
        if (hasRoleParam(finalUrl)) fail(`${prefix}: role authority appeared in URL ${finalUrl}`);
        if (!visibleRoot || bodyLength < (locale === 'zh' ? 45 : 100)) fail(`${prefix}: probable blank screen (${bodyLength} chars)`);
        if (!htmlLang.toLowerCase().startsWith(locale)) fail(`${prefix}: locale mismatch html[lang]=${htmlLang}`);
        if (hydrationErrors.length) fail(`${prefix}: hydration/runtime errors ${JSON.stringify(hydrationErrors)}`);
        if (pageErrors.length) fail(`${prefix}: page errors ${JSON.stringify(pageErrors)}`);
        if (failedRequests.length) fail(`${prefix}: failed requests ${JSON.stringify(failedRequests)}`);
        const unexpectedBad = badResponses.filter((item) => !item.url.includes('/api/auth/'));
        if (unexpectedBad.length) fail(`${prefix}: bad responses ${JSON.stringify(unexpectedBad)}`);
        if ([...storage.local, ...storage.session].some((key) => demoLike.test(key))) fail(`${prefix}: demo/mock browser storage key detected`);
      } catch (error) {
        fail(`${prefix}: navigation failure ${String(error?.stack || error)}`);
      } finally {
        await page.close();
      }
    }

    const page = await context.newPage();
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
    page.on('pageerror', (error) => pageErrors.push(String(error?.stack || error)));
    const prefix = `${project.name}/${locale}/fail-closed`;
    try {
      await page.goto(`${baseURL}/platform-v7/login?lang=${locale}`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
      await page.waitForTimeout(700);
      const beforeCookies = await context.cookies();
      const beforeNames = new Set(beforeCookies.map((cookie) => cookie.name));
      const email = page.locator('input[type="email"], input[name*="email" i], input[autocomplete="username"]').first();
      const password = page.locator('input[type="password"]').first();
      const submit = page.locator('button[type="submit"], input[type="submit"]').first();
      if (!await email.isVisible() || !await password.isVisible() || !await submit.isVisible()) throw new Error('login controls missing');
      await email.fill(`monitoring-${Date.now()}@example.invalid`);
      await password.fill(`Wrong-${Date.now()}-Password!`);
      const authResponsePromise = page.waitForResponse((response) => response.url().startsWith(baseURL) && /\/api\/auth\//.test(response.url()), { timeout: 12_000 }).catch(() => null);
      await submit.click();
      const authResponse = await authResponsePromise;
      await page.waitForTimeout(1600);
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

      if (!new URL(finalUrl).pathname.startsWith('/platform-v7/login')) fail(`${prefix}: login escaped to ${finalUrl}`);
      if (hasRoleParam(finalUrl)) fail(`${prefix}: role authority appeared in URL ${finalUrl}`);
      if (authStatus !== null && ![400, 401, 403, 404, 409, 422, 429, 500, 502, 503, 504].includes(authStatus)) fail(`${prefix}: unexpected auth status ${authStatus}`);
      if (authCookies.length) fail(`${prefix}: auth/session cookies created ${authCookies.map((cookie) => cookie.name).join(',')}`);
      if (demoArtifacts.length) fail(`${prefix}: demo/mock session artifacts ${JSON.stringify(demoArtifacts)}`);
      const hydrationErrors = [...consoleErrors, ...pageErrors].filter((value) => hydrationPattern.test(value));
      if (hydrationErrors.length) fail(`${prefix}: hydration/runtime errors ${JSON.stringify(hydrationErrors)}`);
    } catch (error) {
      fail(`${prefix}: ${String(error?.stack || error)}`);
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
