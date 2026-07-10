import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const BASE_URL = process.env.DEV_DIAGNOSTIC_URL || 'http://127.0.0.1:3000';
const ARTIFACT_DIR = path.resolve(process.env.ARTIFACT_DIR || '../../artifacts/public-entry-preview-smoke-2323');
const routes = ['/platform-v7?lang=ru', '/platform-v7/login?lang=ru', '/platform-v7/forgot-password?lang=ru'];
await fs.mkdir(ARTIFACT_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const reports = [];
for (const route of routes) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const consoleMessages = [];
  const runtimeErrors = [];
  page.on('console', (message) => consoleMessages.push({ type: message.type(), text: message.text(), location: message.location() }));
  page.on('pageerror', (error) => runtimeErrors.push(String(error?.stack || error)));
  let navigation = null;
  let navigationError = null;
  try {
    const response = await page.goto(`${BASE_URL}${route}`, { waitUntil: 'networkidle', timeout: 90_000 });
    navigation = { status: response?.status() ?? null, ok: response?.ok() ?? false, finalUrl: page.url() };
    await page.waitForTimeout(1800);
  } catch (error) {
    navigationError = error instanceof Error ? error.message : String(error);
  }
  const hydrationSignals = consoleMessages.filter((message) => /hydration|did not match|server html|text content|validateDOMNesting|extra attributes|expected server html/i.test(message.text));
  reports.push({ route, navigation, navigationError, hydrationSignals, consoleMessages, runtimeErrors });
  await context.close();
}
await browser.close();
await fs.writeFile(path.join(ARTIFACT_DIR, 'development-hydration-report.json'), JSON.stringify({ baseUrl: BASE_URL, generatedAt: new Date().toISOString(), reports }, null, 2));
console.log(JSON.stringify(reports.map(({ route, hydrationSignals, runtimeErrors }) => ({ route, hydrationSignals, runtimeErrors })), null, 2));
if (reports.some((report) => report.hydrationSignals.length || report.runtimeErrors.length)) process.exitCode = 1;
