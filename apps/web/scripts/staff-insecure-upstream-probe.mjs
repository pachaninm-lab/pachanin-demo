import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const baseURL = process.env.STAFF_EVIDENCE_BASE_URL || 'http://localhost:3000';
const output = path.resolve(process.cwd(), process.env.ARTIFACT_DIR || '../../artifacts/staff-control-center-http-rejection');
fs.mkdirSync(output, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'ru-RU' });
await context.addCookies([
  { name: 'pc_access_token', value: 'evidence-access-token', url: baseURL, httpOnly: true, sameSite: 'Lax' },
  { name: 'pc_csrf_token', value: 'evidence-csrf-token', url: baseURL, httpOnly: false, sameSite: 'Lax' },
  { name: 'pc_session_present', value: JSON.stringify({ role: 'operator', exp: Math.floor(Date.now() / 1000) + 3600 }), url: baseURL, httpOnly: false, sameSite: 'Lax' },
]);

const page = await context.newPage();
const responses = [];
page.on('response', (response) => {
  if (response.url().includes('/api/staff')) responses.push({ url: response.url(), status: response.status() });
});
await page.goto(`${baseURL}/platform-v7/staff?lang=ru`, { waitUntil: 'networkidle', timeout: 60_000 });

const shell = page.locator('[data-staff-platform-shell]');
await shell.waitFor({ state: 'visible', timeout: 30_000 });
await shell.getByText('Контур управления недоступен', { exact: true }).waitFor({ state: 'visible', timeout: 30_000 });

const body = await page.locator('body').innerText();
const result = {
  url: page.url(),
  body,
  responses,
  hasControlCenter: await page.locator('main[data-staff-control-center]').count() > 0,
  hasOperationalWorkspaces: await page.locator('section[aria-labelledby="staff-operational-workspaces-title"]').count() > 0,
  width: await page.evaluate(() => document.documentElement.clientWidth),
  scrollWidth: await page.evaluate(() => document.documentElement.scrollWidth),
};

if (result.hasControlCenter || result.hasOperationalWorkspaces) throw new Error('privileged Staff data surface rendered over insecure API origin');
for (const forbidden of ['Отсутствует ЭПД', 'bank-sandbox', '12500000', 'TP-2026-001']) {
  if (body.includes(forbidden)) throw new Error(`privileged data leaked over insecure API origin: ${forbidden}`);
}
if (!body.includes('fail-closed')) throw new Error('fail-closed reason is not visible');
if (result.scrollWidth > result.width + 1) throw new Error(`horizontal overflow ${result.scrollWidth}/${result.width}`);

fs.writeFileSync(path.join(output, 'http-rejection.json'), JSON.stringify(result, null, 2));
await page.screenshot({ path: path.join(output, 'http-rejection.png'), fullPage: true });
console.log(JSON.stringify({ insecureApiRejected: true, privilegedDataRendered: false, horizontalOverflow: false }, null, 2));
await browser.close();
