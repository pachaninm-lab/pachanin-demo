import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const baseURL = process.env.PRODUCTION_BASE_URL;
const artifactDir = path.resolve(process.cwd(), process.env.ARTIFACT_DIR || '../../artifacts/public-entry-production-diagnostic-bf32ecc');
if (!baseURL) throw new Error('PRODUCTION_BASE_URL is required');
fs.mkdirSync(artifactDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'zh-CN' });
const page = await context.newPage();
const report = { consoleErrors: [], pageErrors: [], failedRequests: [], badResponses: [], checks: {} };
page.on('console', (message) => { if (message.type() === 'error') report.consoleErrors.push(message.text()); });
page.on('pageerror', (error) => report.pageErrors.push(String(error?.stack || error)));
page.on('requestfailed', (request) => report.failedRequests.push({ url: request.url(), failure: request.failure()?.errorText || 'unknown' }));
page.on('response', (response) => { if (response.status() >= 400) report.badResponses.push({ url: response.url(), status: response.status() }); });

try {
  const response = await page.goto(`${baseURL}/platform-v7/forgot-password?lang=zh`, { waitUntil: 'networkidle', timeout: 45_000 });
  report.checks.status = response?.status() ?? null;
  report.checks.finalUrl = page.url();
  report.checks.htmlLang = await page.locator('html').getAttribute('lang');
  report.checks.bodyTextLength = (await page.locator('body').innerText()).trim().length;
  report.checks.headerPosition = await page.locator('.pc-site-header').evaluate((node) => getComputedStyle(node).position);
  report.checks.layout = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth, localStorageKeys: Object.keys(localStorage), sessionStorageKeys: Object.keys(sessionStorage) }));
  report.checks.serviceWorkers = await page.evaluate(async () => ('serviceWorker' in navigator ? (await navigator.serviceWorker.getRegistrations()).length : 0));
  report.checks.brokenImages = await page.locator('img').evaluateAll((images) => images.filter((image) => !image.complete || image.naturalWidth === 0).map((image) => image.getAttribute('src')));
  report.checks.localeCurrent = await page.locator('.pc-site-locale-switch').getAttribute('data-current-locale');
  report.checks.localeNext = await page.locator('.pc-site-locale-switch').getAttribute('data-next-locale');
  const axe = await new AxeBuilder({ page }).analyze();
  report.checks.axe = axe.violations.map((violation) => ({ id: violation.id, impact: violation.impact, help: violation.help, nodes: violation.nodes.length }));
  report.checks.emailInputs = await page.locator('.pc-recovery-card input[type="email"]').count();
  await page.locator('.pc-recovery-submit').click();
  report.checks.clientErrorVisible = await page.locator('.pc-recovery-error[role="alert"]').isVisible();
  await page.screenshot({ path: path.join(artifactDir, 'recovery-zh.png'), fullPage: true });
} catch (error) {
  report.error = String(error?.stack || error);
  await page.screenshot({ path: path.join(artifactDir, 'recovery-zh-error.png'), fullPage: true }).catch(() => {});
} finally {
  fs.writeFileSync(path.join(artifactDir, 'diagnostic.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
}

if (report.error) process.exitCode = 1;
