import fs from 'node:fs';
import path from 'node:path';
import { chromium, webkit } from '@playwright/test';

const baseURL = process.env.PRODUCTION_BASE_URL;
const artifactDir = path.resolve(process.cwd(), process.env.ARTIFACT_DIR || '../../artifacts/public-entry-production-critical-paths-bf32ecc');
if (!baseURL) throw new Error('PRODUCTION_BASE_URL is required');
fs.mkdirSync(artifactDir, { recursive: true });
const report = { localeCycles: [], failClosedLogin: null, failures: [] };
const save = () => fs.writeFileSync(path.join(artifactDir, 'critical-paths-report.json'), JSON.stringify(report, null, 2));
const assert = (condition, message) => { if (!condition) throw new Error(message); };

async function localeCycle(type, name, options) {
  const browser = await type.launch({ headless: true });
  const context = await browser.newContext(options);
  const page = await context.newPage();
  const sequence = [];
  try {
    await page.goto(`${baseURL}/platform-v7?lang=ru`, { waitUntil: 'networkidle', timeout: 45_000 });
    for (let index = 0; index < 4; index += 1) {
      const expected = ['ru', 'en', 'zh', 'ru'][index];
      const current = await page.locator('.pc-site-locale-switch').getAttribute('data-current-locale');
      sequence.push(current);
      assert(current === expected, `${name}: expected ${expected}, received ${current}`);
      if (index < 3) {
        await page.locator('.pc-site-locale-switch').click();
        await page.waitForLoadState('networkidle');
      }
    }
    report.localeCycles.push({ name, sequence });
    await page.screenshot({ path: path.join(artifactDir, `${name}.png`), fullPage: true });
  } catch (error) {
    report.failures.push({ check: name, error: String(error?.stack || error), sequence });
  } finally {
    save();
    await browser.close();
  }
}

async function failClosedLogin() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Mobile Safari/537.36',
  });
  const page = await context.newPage();
  try {
    const navigation = await page.goto(`${baseURL}/platform-v7/login?lang=ru`, { waitUntil: 'networkidle', timeout: 45_000 });
    assert(navigation?.status() === 200, `login HTTP ${navigation?.status()}`);
    await page.locator('#pc-auth-email').fill('production-smoke@example.invalid');
    await page.locator('#pc-auth-password').fill('not-a-real-password');
    const responsePromise = page.waitForResponse((response) => response.url().endsWith('/api/auth/login') && response.request().method() === 'POST', { timeout: 20_000 });
    await page.locator('.pc-auth-submit').click();
    const response = await responsePromise;
    await page.locator('.pc-auth-error').waitFor({ state: 'visible', timeout: 15_000 });
    const authCookies = (await context.cookies()).filter((cookie) => /access|refresh|session|cabinet|mfa/i.test(cookie.name));
    assert(response.status() === 503, `expected fail-closed 503, received ${response.status()}`);
    assert(page.url().includes('/platform-v7/login'), 'redirected away from login');
    assert(authCookies.length === 0, `auth cookies issued ${authCookies.map((cookie) => cookie.name).join(',')}`);
    report.failClosedLogin = { status: response.status(), remainedOnLogin: true, authCookies: [] };
    await page.screenshot({ path: path.join(artifactDir, 'fail-closed-login.png'), fullPage: true });
  } catch (error) {
    report.failures.push({ check: 'fail-closed-login', error: String(error?.stack || error) });
  } finally {
    save();
    await browser.close();
  }
}

await localeCycle(chromium, 'chromium-desktop-locale-cycle', { viewport: { width: 1440, height: 1000 } });
await localeCycle(webkit, 'webkit-iphone-locale-cycle', {
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
});
await failClosedLogin();
save();
console.log(JSON.stringify(report, null, 2));
if (report.failures.length) throw new Error(report.failures.map((failure) => `${failure.check}: ${failure.error}`).join(' | '));
