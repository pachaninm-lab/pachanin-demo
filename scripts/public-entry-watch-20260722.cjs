const fs = require('fs');
const { chromium, webkit } = require('playwright');

const base = 'https://xn----8sbjf4befbjgs9b.xn--p1ai';
const routes = ['/platform-v7', '/platform-v7/login', '/platform-v7/forgot-password'];
const locales = ['ru', 'en', 'zh'];
const projects = [
  { name: 'chromium-desktop', type: chromium, viewport: { width: 1440, height: 1000 } },
  { name: 'chromium-mobile', type: chromium, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
  { name: 'webkit-mobile', type: webkit, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
];
const localeMap = { ru: 'ru-RU', en: 'en-GB', zh: 'zh-CN' };
const report = { generatedAt: new Date().toISOString(), base, cases: [], failClosed: null, failures: [] };
const badRuntime = /(hydration|text content does not match|react error #418|react error #423|client-side exception|chunkloaderror|uncaught referenceerror|uncaught typeerror|next-intl.*missing)/i;
const sensitiveCookie = /(access|refresh|auth|mfa|cabinet|session)/i;

function failure(scope, message, details) { report.failures.push({ scope, message, details }); }
function redirects(response) { let n = 0; let req = response?.request(); while (req?.redirectedFrom()) { n += 1; req = req.redirectedFrom(); } return n; }
function languages(hrefs, body) {
  const all = hrefs.join(' ');
  return {
    ru: /(?:\?|&)lang=ru(?:&|$)/.test(all) || /(^|\s)RU(\s|$)/.test(body),
    en: /(?:\?|&)lang=en(?:&|$)/.test(all) || /(^|\s)EN(\s|$)/.test(body),
    zh: /(?:\?|&)lang=zh(?:&|$)/.test(all) || /中文|简体|ZH/.test(body),
  };
}

(async () => {
  for (const project of projects) {
    const browser = await project.type.launch({ headless: true });
    try {
      for (const locale of locales) {
        for (const route of routes) {
          const context = await browser.newContext({ viewport: project.viewport, isMobile: project.isMobile, hasTouch: project.hasTouch, locale: localeMap[locale] });
          const page = await context.newPage();
          const consoleErrors = [];
          const pageErrors = [];
          const requestFailures = [];
          page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
          page.on('pageerror', (e) => pageErrors.push(String(e?.stack || e)));
          page.on('requestfailed', (r) => {
            const reason = r.failure()?.errorText || 'unknown';
            if (r.url().startsWith(base) && !r.url().includes('/favicon') && !reason.includes('ERR_ABORTED')) requestFailures.push({ url: r.url(), reason });
          });
          let response = null;
          let navigationError = null;
          try {
            response = await page.goto(`${base}${route}?lang=${locale}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
            await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {});
            await page.waitForTimeout(500);
          } catch (error) { navigationError = String(error?.stack || error); }
          const finalUrl = page.url();
          const final = new URL(finalUrl);
          const body = await page.locator('body').innerText().catch(() => '');
          const htmlLang = await page.locator('html').getAttribute('lang').catch(() => null);
          const hrefs = await page.locator('a[href]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('href') || '')).catch(() => []);
          const lang = languages(hrefs, body);
          const runtimeErrors = [...consoleErrors, ...pageErrors].filter((value) => badRuntime.test(value));
          const authorityParams = ['role', 'as', 'workspace', 'tenant'].filter((key) => final.searchParams.has(key));
          const item = { project: project.name, locale, route, status: response?.status() ?? null, finalUrl, redirectCount: redirects(response), bodyLength: body.trim().length, htmlLang, languages: lang, authorityParams, consoleErrors, pageErrors, requestFailures, runtimeErrors, navigationError };
          report.cases.push(item);
          const scope = `${project.name}/${locale}${route}`;
          if (navigationError) failure(scope, 'navigation failed', navigationError);
          if (item.status !== 200) failure(scope, `expected HTTP 200, got ${item.status}`, finalUrl);
          if (item.redirectCount > 4) failure(scope, `redirect chain too long: ${item.redirectCount}`, finalUrl);
          if (final.pathname.replace(/\/$/, '') !== route.replace(/\/$/, '')) failure(scope, 'unexpected final route', finalUrl);
          if (authorityParams.length) failure(scope, 'role or tenant appeared in URL', authorityParams);
          if (item.bodyLength < 120) failure(scope, 'probable white screen', { bodyLength: item.bodyLength });
          if (!htmlLang || !htmlLang.toLowerCase().startsWith(locale)) failure(scope, 'html lang mismatch', { locale, htmlLang });
          if (!lang.ru || !lang.en || !lang.zh) failure(scope, 'RU/EN/ZH controls incomplete', lang);
          if (runtimeErrors.length) failure(scope, 'runtime or hydration error', runtimeErrors);
          if (requestFailures.length) failure(scope, 'same-origin request failure', requestFailures);
          if (/demo session|demo-session|демо[- ]сес|mock session/i.test(body)) failure(scope, 'demo session marker found', null);
          await context.close();
        }
      }
    } finally { await browser.close(); }
  }

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ru-RU' });
    const page = await context.newPage();
    const posts = [];
    page.on('response', (response) => {
      if (response.request().method() === 'POST' && response.url().startsWith(base)) posts.push({ url: response.url(), status: response.status() });
    });
    const response = await page.goto(`${base}/platform-v7/login?lang=ru`, { waitUntil: 'networkidle', timeout: 45000 });
    const before = await context.cookies();
    const email = page.locator('input[type="email"], input[name="email"]').first();
    const password = page.locator('input[type="password"]').first();
    const submit = page.locator('button[type="submit"], input[type="submit"]').first();
    const formVisible = await email.isVisible().catch(() => false) && await password.isVisible().catch(() => false) && await submit.isVisible().catch(() => false);
    if (formVisible) {
      await email.fill('monitor-invalid-20260722@example.test');
      await password.fill('Invalid-monitor-password-9!');
      await submit.click();
      await page.waitForTimeout(3000);
    }
    const after = await context.cookies();
    const beforeNames = new Set(before.map((cookie) => cookie.name));
    const newSensitive = after.filter((cookie) => !beforeNames.has(cookie.name) && sensitiveCookie.test(cookie.name));
    const demoCookies = after.filter((cookie) => /(demo|mock|fake)/i.test(`${cookie.name}=${cookie.value}`));
    const body = await page.locator('body').innerText().catch(() => '');
    const visibleError = await page.locator('[role="alert"], [aria-live="assertive"], .error, [data-error]').count().catch(() => 0);
    const accepted = posts.filter((item) => [400, 401, 403, 409, 422, 429, 500, 502, 503, 504].includes(item.status));
    report.failClosed = { initialStatus: response?.status() ?? null, formVisible, finalUrl: page.url(), posts, visibleError, newSensitiveCookies: newSensitive.map((c) => c.name), demoCookies: demoCookies.map((c) => c.name), demoMarker: /demo session|demo-session|демо[- ]сес|mock session/i.test(body) };
    if (response?.status() !== 200) failure('fail-closed-login', `login page expected HTTP 200, got ${response?.status()}`, null);
    if (!formVisible) failure('fail-closed-login', 'login form missing', null);
    if (!new URL(page.url()).pathname.startsWith('/platform-v7/login')) failure('fail-closed-login', 'invalid credentials escaped login route', page.url());
    if (newSensitive.length) failure('fail-closed-login', 'invalid login created sensitive cookies', newSensitive.map((c) => c.name));
    if (demoCookies.length || report.failClosed.demoMarker) failure('fail-closed-login', 'demo or mock session evidence detected', report.failClosed);
    if (formVisible && posts.length === 0 && visibleError === 0) failure('fail-closed-login', 'submission produced no failed response and no visible error', null);
    if (posts.length && accepted.length === 0) failure('fail-closed-login', 'invalid login did not fail closed', posts);
    await context.close();
  } finally { await browser.close(); }

  fs.mkdirSync('artifacts/public-entry-watch', { recursive: true });
  fs.writeFileSync('artifacts/public-entry-watch/report.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ cases: report.cases.length, failures: report.failures.length, failClosed: report.failClosed }, null, 2));
  if (report.failures.length) process.exit(1);
})().catch((error) => {
  report.failures.push({ scope: 'harness', message: 'unhandled monitoring error', details: String(error?.stack || error) });
  fs.mkdirSync('artifacts/public-entry-watch', { recursive: true });
  fs.writeFileSync('artifacts/public-entry-watch/report.json', JSON.stringify(report, null, 2));
  console.error(error);
  process.exit(1);
});
