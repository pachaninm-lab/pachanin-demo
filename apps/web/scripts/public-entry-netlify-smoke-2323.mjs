import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const BASE_URL = process.env.NETLIFY_PREVIEW_URL;
if (!BASE_URL) throw new Error('NETLIFY_PREVIEW_URL is required');
const ARTIFACT_DIR = path.resolve(process.env.NETLIFY_ARTIFACT_DIR || '../../artifacts/public-entry-preview-smoke-2323/netlify');
const routes = [
  { key: 'landing', path: '/platform-v7?lang=ru', expected: 'Главный риск сделки' },
  { key: 'login', path: '/platform-v7/login?lang=ru', expected: 'Войти в систему' },
  { key: 'forgot', path: '/platform-v7/forgot-password?lang=ru', expected: 'Восстановить доступ' },
];

function isNetlifyNoise(text) {
  return /app\.netlify\.com\/cdp|netlify-cdp|Netlify Drawer|Framing 'https:\/\/app\.netlify\.com\//i.test(text);
}

function isChallenge(status, url, body) {
  return status === 403 || status === 429 || url.includes('/.netlify/') || /verify you are human|submit-challenge|netlify challenge/i.test(body);
}

await fs.mkdir(ARTIFACT_DIR, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const results = [];

try {
  for (const route of routes) {
    const page = await context.newPage();
    const consoleErrors = [];
    const runtimeErrors = [];
    page.on('console', (message) => {
      const text = message.text();
      if (message.type() === 'error' && !isNetlifyNoise(text)) consoleErrors.push(text);
    });
    page.on('pageerror', (error) => runtimeErrors.push(String(error?.stack || error)));

    const result = { ...route, requestedUrl: new URL(route.path, BASE_URL).toString(), finalUrl: null, status: null, outcome: 'failed', consoleErrors, runtimeErrors, failure: null };
    try {
      const response = await page.goto(result.requestedUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      result.status = response?.status() ?? null;
      result.finalUrl = page.url();
      await page.locator('body').waitFor({ state: 'visible', timeout: 15_000 });
      const body = await page.locator('body').innerText();

      if (isChallenge(result.status, result.finalUrl, body)) {
        result.outcome = 'hosting-interference';
        result.failure = `Netlify challenge intercepted the request (HTTP ${result.status})`;
      } else {
        if (!response?.ok()) throw new Error(`HTTP ${result.status}`);
        if (!body.includes(route.expected)) throw new Error(`missing expected copy: ${route.expected}`);
        if (/Application error|Unhandled Runtime Error|Ошибка страницы|404 Not Found/i.test(body)) throw new Error('visible runtime failure');
        const header = page.locator('.pc-site-header');
        if ((await header.count()) !== 1 || !(await header.isVisible())) throw new Error('canonical header missing');
        if ((await header.evaluate((node) => getComputedStyle(node).position)) !== 'fixed') throw new Error('canonical header is not fixed');
        if (consoleErrors.length || runtimeErrors.length) throw new Error(`runtime signals: ${JSON.stringify({ consoleErrors, runtimeErrors })}`);
        result.outcome = 'passed';
      }
    } catch (error) {
      result.failure = error instanceof Error ? error.message : String(error);
    } finally {
      result.finalUrl = page.url();
      try { await page.screenshot({ path: path.join(ARTIFACT_DIR, `${route.key}-${result.outcome}.png`), fullPage: true }); } catch {}
      await page.close();
    }
    results.push(result);
  }
} finally {
  await context.close();
  await browser.close();
}

const summary = {
  baseUrl: BASE_URL,
  generatedAt: new Date().toISOString(),
  passed: results.filter((item) => item.outcome === 'passed').length,
  appFailures: results.filter((item) => item.outcome === 'failed').length,
  hostingInterference: results.filter((item) => item.outcome === 'hosting-interference').length,
  results,
};
await fs.writeFile(path.join(ARTIFACT_DIR, 'netlify-hosting-smoke.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
if (summary.appFailures > 0) process.exitCode = 1;
