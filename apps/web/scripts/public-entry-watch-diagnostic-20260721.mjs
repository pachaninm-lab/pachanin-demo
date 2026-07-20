import fs from 'node:fs';
import path from 'node:path';
import { chromium, webkit } from '@playwright/test';

const base = 'https://xn----8sbjf4befbjgs9b.xn--p1ai';
const outputDir = path.resolve(process.cwd(), '../../artifacts/watch-v2');
fs.mkdirSync(outputDir, { recursive: true });
const routes = [
  ['/platform-v7', 'landing', 500],
  ['/platform-v7/login', 'login', 120],
  ['/platform-v7/forgot-password', 'recovery', 120],
];
const locales = ['ru', 'en', 'zh'];
const projects = [
  ['chromium-desktop', chromium, { viewport: { width: 1440, height: 1000 } }],
  ['chromium-mobile', chromium, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }],
  ['webkit-iphone', webkit, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }],
];
const localeMap = { ru: 'ru-RU', en: 'en-US', zh: 'zh-CN' };
const failures = [];
const cases = [];
const add = (scope, message, details = null) => failures.push({ scope, message, details });
const redirectCount = (response) => {
  let count = 0;
  let request = response?.request();
  while (request?.redirectedFrom()) {
    count += 1;
    request = request.redirectedFrom();
  }
  return count;
};

for (const [projectName, browserType, options] of projects) {
  const browser = await browserType.launch({ headless: true });
  for (const [route, kind, minText] of routes) {
    for (const locale of locales) {
      const scope = `${projectName}:${kind}:${locale}`;
      const context = await browser.newContext({ ...options, locale: localeMap[locale] });
      const page = await context.newPage();
      const consoleErrors = [];
      const runtimeErrors = [];
      const failedRequests = [];
      const badResponses = [];
      page.on('console', (message) => {
        if (message.type() === 'error') consoleErrors.push(message.text());
      });
      page.on('pageerror', (error) => runtimeErrors.push(String(error?.stack || error)));
      page.on('requestfailed', (request) => {
        const errorText = request.failure()?.errorText || 'unknown';
        if (!errorText.includes('ERR_ABORTED')) failedRequests.push({ url: request.url(), errorText });
      });
      page.on('response', (response) => {
        if (response.url().startsWith(base) && response.status() >= 400 && !response.url().includes('/favicon')) {
          badResponses.push({ url: response.url(), status: response.status() });
        }
      });
      try {
        const response = await page.goto(`${base}${route}?lang=${locale}`, { waitUntil: 'networkidle', timeout: 60_000 });
        const final = new URL(page.url());
        const metrics = await page.evaluate(() => ({
          textLength: (document.body?.innerText || '').trim().length,
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
          htmlLang: document.documentElement.lang,
          storageKeys: [...Object.keys(localStorage), ...Object.keys(sessionStorage)],
          hrefs: Array.from(document.querySelectorAll('a[href]')).map((node) => node.getAttribute('href') || ''),
        }));
        const localeLinks = Object.fromEntries(
          locales.map((code) => [code, metrics.hrefs.some((href) => new RegExp(`(?:\\?|&)lang=${code}(?:&|$)`).test(href))]),
        );
        const roleSelectors = await page.locator(
          'select[name*="role" i],input[name*="role" i],[data-role-selector],[data-testid*="role-selector" i]',
        ).count();
        const h1Visible = await page.locator('h1').first().isVisible().catch(() => false);
        const passwordVisible = kind !== 'login'
          || await page.locator('input[type="password"]').first().isVisible().catch(() => false);
        const emailVisible = kind !== 'recovery'
          || await page.locator('input[type="email"],input[name*="email" i]').first().isVisible().catch(() => false);
        const loginLinks = kind === 'landing'
          ? await page.locator('a[href*="/platform-v7/login"]').count()
          : 1;
        const status = response?.status() || 0;
        const redirects = redirectCount(response);

        if (status !== 200) add(scope, `HTTP ${status}`);
        if (redirects > 3) add(scope, `redirects ${redirects}`);
        if (final.pathname !== route) add(scope, `final path ${final.pathname}`);
        if (final.searchParams.has('role') || final.searchParams.has('as')) add(scope, `role context in URL ${final}`);
        if (metrics.textLength < minText) add(scope, `white/incomplete screen ${metrics.textLength}`);
        if (!h1Visible || !passwordVisible || !emailVisible || loginLinks < 1) add(scope, 'required public UI missing');
        if (metrics.scrollWidth > metrics.clientWidth + 2) add(scope, `overflow ${metrics.scrollWidth}/${metrics.clientWidth}`);
        if (!metrics.htmlLang.toLowerCase().startsWith(locale)) add(scope, `html lang ${metrics.htmlLang}`);
        if (!localeLinks.ru || !localeLinks.en || !localeLinks.zh) add(scope, 'RU/EN/ZH links incomplete', localeLinks);
        if (roleSelectors) add(scope, `role selector ${roleSelectors}`);
        if (consoleErrors.length) add(scope, 'console errors', consoleErrors);
        if (runtimeErrors.length) add(scope, 'runtime/hydration errors', runtimeErrors);
        if (failedRequests.length) add(scope, 'failed requests', failedRequests);
        if (badResponses.length) add(scope, 'bad responses', badResponses);
        if (metrics.storageKeys.some((key) => /demo|auth|session|token/i.test(key))) {
          add(scope, 'auth/demo browser storage', metrics.storageKeys);
        }
        cases.push({ scope, status, final: final.toString(), redirects, metrics, localeLinks, roleSelectors });
      } catch (error) {
        add(scope, 'navigation/redirect failure', String(error));
      }
      await context.close();
    }
  }
  await browser.close();
}

for (const [projectName, browserType, options] of projects) {
  const scope = `${projectName}:fail-closed-login`;
  const browser = await browserType.launch({ headless: true });
  const context = await browser.newContext({ ...options, locale: 'ru-RU' });
  const page = await context.newPage();
  const runtimeErrors = [];
  page.on('pageerror', (error) => runtimeErrors.push(String(error?.stack || error)));
  await page.route('**/api/auth/**', async (route) => {
    if (route.request().method() === 'POST') await route.abort('failed');
    else await route.continue();
  });
  try {
    await page.goto(`${base}/platform-v7/login?lang=ru`, { waitUntil: 'networkidle', timeout: 60_000 });
    await page.locator('input[type="email"],input[name*="email" i]').first().fill('watch-invalid@example.test');
    await page.locator('input[type="password"]').first().fill('Invalid-Watch-Password-2026!');
    await page.locator('button[type="submit"]').first().click();
    await page.waitForTimeout(2_500);
    const final = new URL(page.url());
    const cookies = await context.cookies();
    const forbiddenCookies = cookies
      .filter((cookie) => /(?:access|refresh|session|mfa|cabinet|demo)/i.test(cookie.name))
      .map((cookie) => cookie.name);
    const storageKeys = await page.evaluate(() => [...Object.keys(localStorage), ...Object.keys(sessionStorage)]);
    const bodyText = await page.locator('body').innerText();
    const hasFeedback = /недоступ|ошиб|повтор|unable|error|try again|不可用|错误|重试/i.test(bodyText);
    if (final.pathname !== '/platform-v7/login') add(scope, `left login ${final}`);
    if (final.searchParams.has('role') || final.searchParams.has('as')) add(scope, `role context in URL ${final}`);
    if (forbiddenCookies.length) add(scope, 'auth/session/demo cookies', forbiddenCookies);
    if (storageKeys.some((key) => /demo|auth|session|token/i.test(key))) add(scope, 'auth/demo storage', storageKeys);
    if (!hasFeedback) add(scope, 'no visible fail-closed feedback');
    if (runtimeErrors.length) add(scope, 'runtime errors', runtimeErrors);
    cases.push({ scope, final: final.toString(), forbiddenCookies, storageKeys, hasFeedback, runtimeErrors });
  } catch (error) {
    add(scope, 'fail-closed scenario failed', String(error));
  }
  await context.close();
  await browser.close();
}

const networkPath = path.join(outputDir, 'network.json');
const network = fs.existsSync(networkPath)
  ? JSON.parse(fs.readFileSync(networkPath, 'utf8'))
  : { dns: [], routes: [], failures: [{ scope: 'network', message: 'network.json missing' }] };
const report = {
  generatedAt: new Date().toISOString(),
  base,
  counts: { routeCases: routes.length * locales.length * projects.length, failClosedCases: projects.length },
  network,
  cases,
  failures: [...(network.failures || []), ...failures],
};
report.allGreen = report.failures.length === 0;
fs.writeFileSync(path.join(outputDir, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ allGreen: report.allGreen, failures: report.failures }, null, 2));
