import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const baseURL = process.env.STAFF_EVIDENCE_BASE_URL || 'http://localhost:3000';
const output = path.resolve(process.cwd(), process.env.ARTIFACT_DIR || '../../artifacts/staff-control-center-probe');
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'ru-RU' });
await context.addCookies([
  { name: 'pc_access_token', value: 'evidence-access-token', url: baseURL, httpOnly: true, sameSite: 'Lax' },
  { name: 'pc_csrf_token', value: 'evidence-csrf-token', url: baseURL, httpOnly: false, sameSite: 'Lax' },
  { name: 'pc_session_present', value: JSON.stringify({ role: 'operator', exp: Math.floor(Date.now() / 1000) + 3600 }), url: baseURL, httpOnly: false, sameSite: 'Lax' },
]);
const page = await context.newPage();
const responses = [];
page.on('response', async (response) => {
  if (response.url().includes('/api/staff')) responses.push({ url: response.url(), status: response.status() });
});
await page.goto(`${baseURL}/platform-v7/staff?lang=ru`, { waitUntil: 'networkidle', timeout: 60_000 });
const control = page.locator('main[data-staff-control-center]');
await control.getByRole('button', { name: 'Доступ', exact: true }).first().click();
await control.locator('input[maxlength="128"]').first().fill('PROBE-2353');
await control.locator('textarea[maxlength="2000"]').first().fill('Focused protected staff workspace probe session');
await control.getByRole('button', { name: 'Создать запрос', exact: true }).click();
const activate = control.getByRole('button', { name: 'Активировать защищённую сессию', exact: true }).first();
await activate.waitFor({ state: 'visible', timeout: 20_000 });
await activate.click();
await page.waitForTimeout(2500);
const probe = await page.evaluate(async () => {
  const read = async (url) => {
    const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store' });
    return { status: response.status, body: await response.text() };
  };
  return {
    cookie: document.cookie,
    session: await read('/api/staff/session-context'),
    support: await read('/api/staff/workspaces/support'),
    cases: await read('/api/staff/workspaces/support/cases?limit=300'),
  };
});
const operational = page.locator('section[aria-labelledby="staff-operational-workspaces-title"]');
const result = {
  url: page.url(),
  probe,
  responses,
  operationalText: await operational.innerText(),
  body: (await page.locator('body').innerText()).slice(0, 16000),
  cookies: await context.cookies(baseURL),
};
fs.writeFileSync(path.join(output, 'probe.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
await page.screenshot({ path: path.join(output, 'probe.png'), fullPage: true });
await browser.close();
