import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const baseURL = process.env.STAFF_EVIDENCE_BASE_URL || 'http://localhost:3000';
const artifactDir = path.resolve(process.cwd(), process.env.ARTIFACT_DIR || '../../artifacts/staff-hydration-diagnostics');
fs.mkdirSync(artifactDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'ru-RU' });
await context.addCookies([
  { name: 'pc_access_token', value: 'evidence-access-token', url: baseURL, httpOnly: true, sameSite: 'Lax' },
  { name: 'pc_csrf_token', value: 'evidence-csrf-token', url: baseURL, httpOnly: false, sameSite: 'Lax' },
  { name: 'pc_session_present', value: JSON.stringify({ role: 'operator', exp: Math.floor(Date.now() / 1000) + 3600 }), url: baseURL, httpOnly: false, sameSite: 'Lax' },
]);

const page = await context.newPage();
const consoleRows = [];
const pageErrors = [];
page.on('console', async (message) => {
  const args = [];
  for (const arg of message.args()) {
    try { args.push(await arg.jsonValue()); } catch { args.push(String(arg)); }
  }
  consoleRows.push({ type: message.type(), text: message.text(), location: message.location(), args });
});
page.on('pageerror', (error) => pageErrors.push({ name: error.name, message: error.message, stack: error.stack }));

await page.goto(`${baseURL}/platform-v7/staff?lang=ru`, { waitUntil: 'networkidle', timeout: 60_000 });
await page.waitForTimeout(2500);

const report = {
  url: page.url(),
  title: await page.title(),
  htmlLang: await page.locator('html').getAttribute('lang'),
  body: (await page.locator('body').innerText()).slice(0, 15000),
  html: (await page.locator('body').innerHTML()).slice(0, 40000),
  consoleRows,
  pageErrors,
};
fs.writeFileSync(path.join(artifactDir, 'hydration-diagnostics.json'), JSON.stringify(report, null, 2));
await page.screenshot({ path: path.join(artifactDir, 'hydration-diagnostics.png'), fullPage: true });
console.log(JSON.stringify({ pageErrors, consoleErrors: consoleRows.filter((row) => row.type === 'error') }, null, 2));
await browser.close();
