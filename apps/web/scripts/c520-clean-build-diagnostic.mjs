import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, request as playwrightRequest } from '@playwright/test';

const BASE_URL = process.env.DIAGNOSTIC_BASE_URL || 'http://127.0.0.1:3000';
const OUT_DIR = path.resolve(process.env.DIAGNOSTIC_OUT_DIR || '../../artifacts/c520-clean-build-diagnostic');
const routes = [
  { key: 'landing', path: '/platform-v7?lang=ru', expected: 'Главный риск сделки' },
  { key: 'login', path: '/platform-v7/login?lang=ru', expected: 'Войти в систему' },
  { key: 'forgot', path: '/platform-v7/forgot-password?lang=ru', expected: 'Восстановить доступ' },
  { key: 'landing-en', path: '/platform-v7?lang=en', expected: 'The main transaction risk' },
  { key: 'landing-zh', path: '/platform-v7?lang=zh', expected: '交易的主要风险' },
];
const staleLogin = 'Выберите один рабочий кабинет';

await fs.mkdir(OUT_DIR, { recursive: true });
const api = await playwrightRequest.newContext({ extraHTTPHeaders: { accept: 'text/html,application/xhtml+xml' } });
const raw = [];
for (const route of routes) {
  const response = await api.get(`${BASE_URL}${route.path}`, { failOnStatusCode: false, timeout: 60_000 });
  const html = await response.text();
  await fs.writeFile(path.join(OUT_DIR, `${route.key}-raw.html`), html);
  raw.push({
    key: route.key,
    status: response.status(),
    headers: response.headers(),
    expectedPresent: html.includes(route.expected),
    staleLoginPresent: html.includes(staleLogin),
    newLoginClassPresent: html.includes('pc-auth-page'),
    oldLoginClassPresent: html.includes('pc-v7-login-single'),
    byteLength: Buffer.byteLength(html),
  });
}
await api.dispose();

async function inspectBrowser(javaScriptEnabled) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, javaScriptEnabled });
  const results = [];
  try {
    for (const route of routes) {
      const page = await context.newPage();
      const consoleErrors = [];
      const runtimeErrors = [];
      page.on('console', (message) => {
        if (message.type() === 'error') consoleErrors.push(message.text());
      });
      page.on('pageerror', (error) => runtimeErrors.push(String(error?.stack || error)));
      const response = await page.goto(`${BASE_URL}${route.path}`, { waitUntil: javaScriptEnabled ? 'networkidle' : 'domcontentloaded', timeout: 90_000 });
      if (javaScriptEnabled) await page.waitForTimeout(750);
      const bodyText = await page.locator('body').innerText();
      const html = await page.content();
      results.push({
        key: route.key,
        status: response?.status() ?? null,
        expectedPresent: bodyText.includes(route.expected),
        staleLoginPresent: bodyText.includes(staleLogin),
        newLoginClassPresent: html.includes('pc-auth-page'),
        oldLoginClassPresent: html.includes('pc-v7-login-single'),
        consoleErrors,
        runtimeErrors,
        title: await page.title(),
      });
      await page.screenshot({ path: path.join(OUT_DIR, `${route.key}-${javaScriptEnabled ? 'hydrated' : 'no-js'}.png`), fullPage: true });
      await page.close();
    }
  } finally {
    await context.close();
    await browser.close();
  }
  return results;
}

const report = {
  generatedAt: new Date().toISOString(),
  baseUrl: BASE_URL,
  raw,
  noJs: await inspectBrowser(false),
  hydrated: await inspectBrowser(true),
};
await fs.writeFile(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));

const failures = [];
for (const item of report.raw) {
  if (item.status !== 200) failures.push(`raw ${item.key}: HTTP ${item.status}`);
  if (!item.expectedPresent) failures.push(`raw ${item.key}: expected text missing`);
}
for (const item of report.hydrated) {
  if (!item.expectedPresent) failures.push(`hydrated ${item.key}: expected text missing`);
  if (item.runtimeErrors.length) failures.push(`hydrated ${item.key}: ${item.runtimeErrors.length} runtime errors`);
}
if (report.raw.find((item) => item.key === 'login')?.staleLoginPresent) failures.push('raw login contains stale workspace picker');
if (failures.length) {
  console.error(JSON.stringify({ failures }, null, 2));
  process.exitCode = 1;
}
