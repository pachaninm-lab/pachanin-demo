import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const BASE_URL = process.env.DEV_DIAGNOSTIC_URL || 'http://127.0.0.1:3000';
const ARTIFACT_DIR = path.resolve(process.env.ARTIFACT_DIR || '../../artifacts/public-entry-live-smoke-2318');
await fs.mkdir(ARTIFACT_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const consoleMessages = [];
const runtimeErrors = [];

page.on('console', (message) => {
  consoleMessages.push({ type: message.type(), text: message.text(), location: message.location() });
});
page.on('pageerror', (error) => runtimeErrors.push(String(error?.stack || error)));

let navigation = null;
let navigationError = null;
try {
  const response = await page.goto(`${BASE_URL}/platform-v7?lang=ru`, { waitUntil: 'networkidle', timeout: 90_000 });
  navigation = { status: response?.status() ?? null, ok: response?.ok() ?? false, finalUrl: page.url() };
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'development-hydration.png'), fullPage: true });
} catch (error) {
  navigationError = error instanceof Error ? error.message : String(error);
}

const hydrationSignals = consoleMessages.filter((message) => /hydration|did not match|server html|text content|validateDOMNesting|extra attributes/i.test(message.text));
const report = {
  baseUrl: BASE_URL,
  generatedAt: new Date().toISOString(),
  navigation,
  navigationError,
  hydrationSignals,
  consoleMessages,
  runtimeErrors,
};
await fs.writeFile(path.join(ARTIFACT_DIR, 'development-hydration-report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ navigation, hydrationSignals, runtimeErrors }, null, 2));

await context.close();
await browser.close();
