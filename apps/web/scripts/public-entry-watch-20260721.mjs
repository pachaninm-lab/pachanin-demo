import fs from 'node:fs';
import path from 'node:path';
import { chromium, webkit } from '@playwright/test';

const baseURL = process.env.BASE_URL || 'https://xn----8sbjf4befbjgs9b.xn--p1ai';
const outDir = path.resolve(process.cwd(), process.env.ARTIFACT_DIR || '../../artifacts/public-entry-watch-20260721');
const routes = ['/platform-v7', '/platform-v7/login', '/platform-v7/forgot-password'];
const locales = ['ru', 'en', 'zh'];
const projects = [
  { name: 'chromium-desktop', engine: chromium, viewport: { width: 1440, height: 1000 } },
  { name: 'chromium-mobile', engine: chromium, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
  { name: 'webkit-iphone', engine: webkit, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
];
const report = { generatedAt: new Date().toISOString(), baseURL, cases: [], failures: [] };
const fail = (message, detail = {}) => report.failures.push({ message, ...detail });
const authorityCookie = /(demo|mock|impersonat|auth|access|refresh|session|mfa|cabinet)/i;
const acceptableLoginStatus = new Set([400, 401, 403, 404, 409, 422, 429, 503]);
fs.mkdirSync(outDir, { recursive: true });

for (const project of projects) {
  const browser = await project.engine.launch({ headless: true });
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
      const serverErrors = [];
      page.on('console', (message) => {
        if (message.type() === 'error') consoleErrors.push(message.text());
      });
      page.on('pageerror', (error) => pageErrors.push(String(error?.stack || error)));
      page.on('requestfailed', (request) => {
        const errorText = request.failure()?.errorText || 'unknown';
        if (!/ERR_ABORTED|cancelled/i.test(errorText)) failedRequests.push({ url: request.url(), errorText });
      });
      page.on('response', (response) => {
        if (response.url().startsWith(baseURL) && response.status() >= 500) {
          serverErrors.push({ url: response.url(), status: response.status() });
        }
      });

      let response;
      try {
        response = await page.goto(`${baseURL}${route}?lang=${locale}`, { waitUntil: 'networkidle', timeout: 60_000 });
      } catch (error) {
        fail(`${project.name}/${locale}${route}: navigation failed`, { error: String(error) });
        await page.close();
        continue;
      }

      const status = response?.status() || 0;
      const finalUrl = page.url();
      const parsed = new URL(finalUrl);
      const snapshot = await page.evaluate(() => ({
        textLength: document.body.innerText.trim().length,
        htmlLang: document.documentElement.lang,
        headingCount: document.querySelectorAll('h1,h2').length,
        formCount: document.querySelectorAll('form').length,
        emailInputs: document.querySelectorAll('input[type="email"],input[name="email"]').length,
        passwordInputs: document.querySelectorAll('input[type="password"],input[name="password"]').length,
        roleSelectors: document.querySelectorAll('select[name="role"],select[id="role"],input[name="role"],[data-role-selector="true"]').length,
        localStorage: Object.entries(localStorage),
        sessionStorage: Object.entries(sessionStorage),
      }));

      if (status !== 200) fail(`${project.name}/${locale}${route}: HTTP ${status}`, { finalUrl });
      if (parsed.pathname !== route) fail(`${project.name}/${locale}${route}: unexpected final path`, { finalUrl });
      if (parsed.searchParams.has('role') || parsed.searchParams.has('as')) fail(`${project.name}/${locale}${route}: role leaked into URL`, { finalUrl });
      if (snapshot.textLength < 35 || snapshot.headingCount + snapshot.formCount === 0) {
        fail(`${project.name}/${locale}${route}: probable white screen`, { textLength: snapshot.textLength, headingCount: snapshot.headingCount, formCount: snapshot.formCount });
      }
      if (!String(snapshot.htmlLang || '').startsWith(locale)) fail(`${project.name}/${locale}${route}: html lang mismatch`, { htmlLang: snapshot.htmlLang });
      if (snapshot.roleSelectors > 0) fail(`${project.name}/${locale}${route}: role selector present`, { count: snapshot.roleSelectors });
      if (route === '/platform-v7/login' && (snapshot.emailInputs < 1 || snapshot.passwordInputs < 1 || snapshot.formCount < 1)) {
        fail(`${project.name}/${locale}${route}: login form missing`, snapshot);
      }
      if (route === '/platform-v7/forgot-password' && (snapshot.emailInputs < 1 || snapshot.formCount < 1)) {
        fail(`${project.name}/${locale}${route}: recovery form missing`, snapshot);
      }
      if (consoleErrors.length || pageErrors.length || failedRequests.length || serverErrors.length) {
        fail(`${project.name}/${locale}${route}: runtime/network errors`, { consoleErrors, pageErrors, failedRequests, serverErrors });
      }
      const storageText = JSON.stringify({ local: snapshot.localStorage, session: snapshot.sessionStorage });
      if (/demo.session|demoSession|mockSession|demo-user|demo_user/i.test(storageText)) {
        fail(`${project.name}/${locale}${route}: demo session in storage`);
      }
      const cookiesBeforeLogin = await context.cookies();
      if (cookiesBeforeLogin.some((cookie) => /demo|mock/i.test(cookie.name) || /demo.session|mockSession/i.test(cookie.value))) {
        fail(`${project.name}/${locale}${route}: demo cookie detected`);
      }

      if (route === '/platform-v7/login') {
        const email = page.locator('input[type="email"], input[name="email"]').first();
        const password = page.locator('input[type="password"], input[name="password"]').first();
        if ((await email.count()) && (await password.count())) {
          await email.fill(`watch-${Date.now()}@invalid.example`);
          await password.fill('Invalid-Watch-Password-2026!');
          const responsePromise = page.waitForResponse(
            (item) => /\/api\/(?:platform-v7\/)?auth\/login|\/auth\/login/.test(item.url()),
            { timeout: 15_000 },
          ).catch(() => null);
          await page.locator('button[type="submit"]').first().click();
          const loginResponse = await responsePromise;
          await page.waitForTimeout(1200);
          const loginStatus = loginResponse?.status() ?? null;
          const afterUrl = page.url();
          const cookies = await context.cookies();
          if (loginStatus !== null && !acceptableLoginStatus.has(loginStatus)) {
            fail(`${project.name}/${locale}: unexpected fail-closed login status`, { loginStatus });
          }
          if (/\/platform-v7\/(buyer|seller|driver|lab|bank|operator|control-tower|executive|compliance|arbitrator)/.test(new URL(afterUrl).pathname)) {
            fail(`${project.name}/${locale}: invalid credentials opened a cabinet`, { afterUrl, loginStatus });
          }
          const riskyCookies = cookies.filter((cookie) => authorityCookie.test(cookie.name) && !/csrf|locale|entry_seen/i.test(cookie.name));
          if (riskyCookies.length) fail(`${project.name}/${locale}: fail-closed login created authority cookies`, { loginStatus, cookies: riskyCookies.map((item) => item.name) });
          const afterStorage = await page.evaluate(() => JSON.stringify({ local: Object.entries(localStorage), session: Object.entries(sessionStorage) }));
          if (/demo.session|demoSession|mockSession|demo-user|demo_user/i.test(afterStorage)) {
            fail(`${project.name}/${locale}: fail-closed login created demo storage`);
          }
        }
      }

      report.cases.push({ project: project.name, locale, route, status, finalUrl, textLength: snapshot.textLength, htmlLang: snapshot.htmlLang });
      await page.close();
    }
    await context.close();
  }
  await browser.close();
}

const localeCoverage = new Set(report.cases.map((item) => item.htmlLang?.slice(0, 2)));
for (const locale of locales) {
  if (!localeCoverage.has(locale)) fail(`locale coverage missing: ${locale}`);
}
fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ cases: report.cases.length, failures: report.failures.length, failureDetails: report.failures }, null, 2));
if (report.failures.length) process.exit(1);
