import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, webkit, devices } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const baseUrl = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000';
const artifactDir = path.resolve(process.env.ARTIFACT_DIR || '../../artifacts/public-entry-lcp-2337-v2');
const locales = {
  ru: { landing: 'Главный риск сделки', login: 'Войти в систему', forgot: 'Восстановить доступ', mfa: 'Подтвердить вход', backup: 'Сохраните резервные коды' },
  en: { landing: 'The main transaction risk', login: 'Sign in', forgot: 'Restore access', mfa: 'Verify sign-in', backup: 'Save your backup codes' },
  zh: { landing: '交易的主要风险', login: '登录系统', forgot: '恢复访问权限', mfa: '确认登录', backup: '保存备用代码' },
};
const routes = [
  { key: 'landing', path: '/platform-v7' },
  { key: 'login', path: '/platform-v7/login' },
  { key: 'forgot', path: '/platform-v7/forgot-password' },
];
const matrix = [
  { name: 'chromium-desktop-1440', engine: chromium, context: { viewport: { width: 1440, height: 1000 } } },
  { name: 'chromium-mobile-390', engine: chromium, context: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } },
  { name: 'webkit-iphone-13', engine: webkit, context: devices['iPhone 13'] },
];

await fs.mkdir(artifactDir, { recursive: true });
const report = { baseUrl, generatedAt: new Date().toISOString(), cases: [], language: null, mfa: [], summary: null };
const fail = (condition, message) => { if (!condition) throw new Error(message); };
const persist = () => fs.writeFile(path.join(artifactDir, 'browser-smoke-report.json'), JSON.stringify(report, null, 2));

async function runCase(page, device, route, locale) {
  const result = { device: device.name, route: route.path, locale, outcome: 'failed', consoleErrors: [], runtimeErrors: [], failedRequests: [], axe: [], failure: null };
  page.on('console', (message) => { if (message.type() === 'error') result.consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => result.runtimeErrors.push(String(error?.stack || error)));
  page.on('requestfailed', (request) => {
    const text = request.failure()?.errorText || '';
    if (!(request.url().includes('_rsc=') && /abort|cancel/i.test(text))) result.failedRequests.push({ url: request.url(), error: text });
  });
  try {
    const response = await page.goto(`${baseUrl}${route.path}?lang=${locale}`, { waitUntil: 'networkidle', timeout: 90_000 });
    fail(response?.ok(), `HTTP ${response?.status()}`);
    const text = await page.locator('body').innerText();
    fail(text.includes(locales[locale][route.key]), `missing locale copy ${route.key}/${locale}`);
    const layout = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      fixedHeader: getComputedStyle(document.querySelector('.pc-site-header')).position === 'fixed',
      brokenImages: [...document.images].filter((image) => image.offsetParent !== null && (!image.complete || image.naturalWidth === 0)).length,
      legacyExit: document.querySelectorAll('.p7-login-exit-button').length,
    }));
    fail(layout.overflow <= 8, `horizontal overflow ${layout.overflow}`);
    fail(layout.fixedHeader, 'header is not fixed');
    fail(layout.brokenImages === 0, `broken images ${layout.brokenImages}`);
    fail(layout.legacyExit === 0, 'legacy login exit control present');
    if (route.key === 'landing') {
      const roles = page.locator('.entry-role-tile');
      fail(await roles.count() === 12, 'role card count');
      const hrefs = await roles.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('href')));
      fail(hrefs.every((href) => href === '/platform-v7/login'), `role bypass ${JSON.stringify(hrefs)}`);
      fail(await page.locator('.entry-hero-actions a').count() === 2, 'hero CTA count');
    }
    if (route.key === 'login') {
      fail(await page.locator('[data-role-selector],.workspace-picker,select[name*=role i]').count() === 0, 'role selector present');
      fail(!page.url().includes('role='), 'role query present');
    }
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    result.axe = axe.violations.map(({ id, impact }) => ({ id, impact }));
    fail(!axe.violations.some(({ impact }) => impact === 'critical' || impact === 'serious'), `axe blocking ${JSON.stringify(result.axe)}`);
    await page.waitForTimeout(300);
    fail(result.consoleErrors.length === 0, `console ${JSON.stringify(result.consoleErrors)}`);
    fail(result.runtimeErrors.length === 0, `runtime ${JSON.stringify(result.runtimeErrors)}`);
    fail(result.failedRequests.length === 0, `requests ${JSON.stringify(result.failedRequests)}`);
    result.outcome = 'passed';
  } catch (error) {
    result.failure = error instanceof Error ? error.message : String(error);
  }
  await page.screenshot({ path: path.join(artifactDir, `${device.name}-${route.key}-${locale}-${result.outcome}.png`), fullPage: true }).catch(() => {});
  return result;
}

for (const device of matrix) {
  const browser = await device.engine.launch({ headless: true });
  const context = await browser.newContext(device.context);
  for (const locale of Object.keys(locales)) for (const route of routes) {
    const page = await context.newPage();
    report.cases.push(await runCase(page, device, route, locale));
    await page.close();
    await persist();
  }
  if (device.name === 'chromium-desktop-1440') {
    const page = await context.newPage();
    try {
      await page.goto(`${baseUrl}/platform-v7?lang=ru`, { waitUntil: 'networkidle' });
      await Promise.all([page.waitForURL(/lang=en/), page.locator('.pc-site-locale-switch').click()]);
      fail((await page.locator('body').innerText()).includes(locales.en.landing), 'RU→EN');
      await Promise.all([page.waitForURL(/lang=zh/), page.locator('.pc-site-locale-switch').click()]);
      fail((await page.locator('body').innerText()).includes(locales.zh.landing), 'EN→ZH');
      report.language = { outcome: 'passed', finalUrl: page.url() };
    } catch (error) { report.language = { outcome: 'failed', failure: String(error) }; }
    await page.close();
    for (const locale of Object.keys(locales)) {
      const mfa = { locale, outcome: 'failed', failure: null };
      const mfaPage = await context.newPage();
      try {
        await mfaPage.route('**/api/auth/login', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, mfaRequired: true, enrollmentRequired: true, setupSecret: 'JBSWY3DPEHPK3PXP', methods: ['totp', 'backup_code'] }) }));
        await mfaPage.route('**/api/auth/mfa-login', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, redirectTo: '/platform-v7/buyer', backupCodes: ['BACKUP-ONE', 'BACKUP-TWO'] }) }));
        await mfaPage.goto(`${baseUrl}/platform-v7/login?lang=${locale}`, { waitUntil: 'networkidle' });
        await mfaPage.locator('input[type=email]').fill('buyer@example.test');
        await mfaPage.locator('input[type=password]').fill('strong-password');
        await mfaPage.locator('form button[type=submit]').click();
        await mfaPage.getByRole('heading', { name: locales[locale].mfa }).waitFor();
        await mfaPage.locator('input[autocomplete=one-time-code]').fill('123456');
        await mfaPage.locator('form button[type=submit]').click();
        await mfaPage.getByRole('heading', { name: locales[locale].backup }).waitFor();
        mfa.outcome = 'passed';
      } catch (error) { mfa.failure = String(error); }
      report.mfa.push(mfa);
      await mfaPage.close();
    }
  }
  await context.close();
  await browser.close();
}

report.summary = {
  totalCases: report.cases.length,
  failures: report.cases.filter((item) => item.outcome !== 'passed').length,
  languagePassed: report.language?.outcome === 'passed',
  mfaFailures: report.mfa.filter((item) => item.outcome !== 'passed').length,
};
await persist();
console.log(JSON.stringify(report.summary, null, 2));
if (report.summary.failures || !report.summary.languagePassed || report.summary.mfaFailures) process.exit(1);
