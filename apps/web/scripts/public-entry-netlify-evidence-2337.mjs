import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const BASE_URL = process.env.NETLIFY_PREVIEW_URL;
if (!BASE_URL) throw new Error('NETLIFY_PREVIEW_URL is required');
const OUT = path.resolve(process.env.NETLIFY_ARTIFACT_DIR || '../../artifacts/public-entry-lcp-evidence-2337/netlify');
const routes = [
  { key: 'landing', path: '/platform-v7?lang=ru', expected: 'Главный риск сделки' },
  { key: 'login', path: '/platform-v7/login?lang=ru', expected: 'Войти в систему' },
  { key: 'forgot', path: '/platform-v7/forgot-password?lang=ru', expected: 'Восстановить доступ' },
];
const isNoise = (text) => /app\.netlify\.com\/cdp|netlify-cdp|Netlify Drawer|Framing 'https:\/\/app\.netlify\.com\//i.test(text);
const isChallenge = (status, url, body) => status === 403 || status === 429 || url.includes('/.netlify/') || /verify you are human|submit-challenge|netlify challenge/i.test(body);
const isNetlifyAsset = (url) => {
  try {
    const parsed = new URL(url);
    return parsed.origin === new URL(BASE_URL).origin && (parsed.pathname.startsWith('/_next/') || parsed.pathname.startsWith('/.netlify/'));
  } catch {
    return false;
  }
};

await fs.mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const results = [];
try {
  for (const route of routes) {
    const page = await context.newPage();
    const consoleErrors = [];
    const runtimeErrors = [];
    const failedRequests = [];
    const badResponses = [];
    const responseInventory = [];
    page.on('console', (message) => {
      const text = message.text();
      if (message.type() === 'error' && !isNoise(text)) consoleErrors.push({ text, location: message.location() });
    });
    page.on('pageerror', (error) => runtimeErrors.push(String(error?.stack || error)));
    page.on('requestfailed', (request) => {
      const url = request.url();
      if (!isNoise(url)) failedRequests.push({ url, resourceType: request.resourceType(), error: request.failure()?.errorText || 'unknown' });
    });
    page.on('response', async (response) => {
      const status = response.status();
      const request = response.request();
      const item = {
        url: response.url(),
        status,
        resourceType: request.resourceType(),
        fromServiceWorker: response.fromServiceWorker(),
        contentType: response.headers()['content-type'] || null,
      };
      if (status >= 400 && !isNoise(item.url)) badResponses.push(item);
      if (isNetlifyAsset(item.url)) responseInventory.push(item);
    });

    const result = {
      ...route,
      requestedUrl: new URL(route.path, BASE_URL).toString(),
      finalUrl: null,
      status: null,
      outcome: 'failed',
      consoleErrors,
      runtimeErrors,
      failedRequests,
      badResponses,
      responseInventory,
      header: null,
      stylesheets: [],
      failure: null,
    };
    try {
      const response = await page.goto(result.requestedUrl, { waitUntil: 'networkidle', timeout: 90_000 });
      result.status = response?.status() ?? null;
      result.finalUrl = page.url();
      await page.locator('body').waitFor({ state: 'visible', timeout: 15_000 });
      const body = await page.locator('body').innerText();
      result.header = await page.locator('.pc-site-header').evaluate((node) => {
        const style = getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        return {
          position: style.position,
          display: style.display,
          visibility: style.visibility,
          opacity: style.opacity,
          top: style.top,
          zIndex: style.zIndex,
          width: rect.width,
          height: rect.height,
        };
      }).catch(() => null);
      result.stylesheets = await page.evaluate(() => Array.from(document.styleSheets).map((sheet) => ({
        href: sheet.href,
        disabled: sheet.disabled,
        ruleCount: (() => { try { return sheet.cssRules.length; } catch { return null; } })(),
      })));

      if (isChallenge(result.status, result.finalUrl, body)) {
        result.outcome = 'hosting-interference';
        result.failure = `Netlify challenge intercepted the request (HTTP ${result.status})`;
      } else {
        if (!response?.ok()) throw new Error(`HTTP ${result.status}`);
        if (!body.includes(route.expected)) throw new Error(`missing expected copy: ${route.expected}`);
        if (/Application error|Unhandled Runtime Error|MISSING_MESSAGE|Ошибка страницы|404 Not Found/i.test(body)) throw new Error('visible runtime failure');
        if (!result.header) throw new Error('canonical header missing');
        if (result.header.position !== 'fixed') throw new Error(`canonical header is not fixed: ${JSON.stringify(result.header)}`);
        if (badResponses.length || failedRequests.length) {
          const onlyNetlifyDelivery = badResponses.every((item) => item.status === 502 && isNetlifyAsset(item.url)) && failedRequests.length === 0;
          if (onlyNetlifyDelivery) {
            result.outcome = 'hosting-interference';
            result.failure = `Netlify returned 502 for deployed static assets: ${JSON.stringify(badResponses)}`;
          } else {
            throw new Error(`resource failures: ${JSON.stringify({ badResponses, failedRequests })}`);
          }
        } else if (consoleErrors.length || runtimeErrors.length) {
          throw new Error(`runtime signals: ${JSON.stringify({ consoleErrors, runtimeErrors })}`);
        } else {
          result.outcome = 'passed';
        }
      }
    } catch (error) {
      result.failure = error instanceof Error ? error.message : String(error);
      if (badResponses.length && badResponses.every((item) => item.status === 502 && isNetlifyAsset(item.url)) && runtimeErrors.length === 0) {
        result.outcome = 'hosting-interference';
        result.failure = `Netlify returned 502 for deployed static assets: ${JSON.stringify(badResponses)}`;
      }
    } finally {
      result.finalUrl = page.url();
      try { await page.screenshot({ path: path.join(OUT, `${route.key}-${result.outcome}.png`), fullPage: true }); } catch {}
      await fs.writeFile(path.join(OUT, `${route.key}-network.json`), JSON.stringify({
        requestedUrl: result.requestedUrl,
        finalUrl: result.finalUrl,
        status: result.status,
        header: result.header,
        stylesheets: result.stylesheets,
        badResponses,
        failedRequests,
        responseInventory,
        consoleErrors,
        runtimeErrors,
      }, null, 2));
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
await fs.writeFile(path.join(OUT, 'netlify-hosting-smoke.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
if (summary.appFailures) process.exitCode = 1;
