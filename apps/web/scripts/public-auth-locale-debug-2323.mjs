import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL;
if (!BASE_URL) throw new Error('PLAYWRIGHT_BASE_URL is required');
const ARTIFACT_DIR = path.resolve(process.env.ARTIFACT_DIR || '../../artifacts/public-auth-preview-smoke-2323');
await fs.mkdir(ARTIFACT_DIR, { recursive: true });

function decode(value = '') {
  return value.replace(/<[^>]+>/g, ' ').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
}
function match(html, pattern) {
  return html.match(pattern)?.[1] ?? null;
}

const browser = await chromium.launch({ headless: true });
const report = { baseUrl: BASE_URL, generatedAt: new Date().toISOString(), cases: [] };
try {
  for (const locale of ['ru', 'en', 'zh']) {
    for (const route of ['/platform-v7', '/platform-v7/login', '/platform-v7/forgot-password']) {
      const context = await browser.newContext();
      const page = await context.newPage();
      const runtimeErrors = [];
      const consoleErrors = [];
      page.on('pageerror', (error) => runtimeErrors.push(String(error?.stack || error)));
      page.on('console', (message) => {
        const text = message.text();
        if (message.type() === 'error' && !text.includes('app.netlify.com/cdp') && !text.includes('netlify-cdp')) consoleErrors.push(text);
      });
      const url = new URL(route, BASE_URL);
      url.searchParams.set('lang', locale);
      const response = await page.goto(url.toString(), { waitUntil: 'domcontentloaded', timeout: 60_000 });
      const serverHtml = response ? await response.text().catch(() => '') : '';
      await page.waitForLoadState('networkidle').catch(() => {});
      await page.waitForTimeout(500);
      const hydrated = await page.evaluate(() => ({
        htmlLang: document.documentElement.lang,
        switchLocale: document.querySelector('.pc-site-locale-switch')?.getAttribute('data-current-locale') ?? null,
        switchText: document.querySelector('.pc-site-locale-switch')?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
        h1Text: document.querySelector('h1')?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
        bodyPrefix: document.body?.innerText?.replace(/\s+/g, ' ').trim().slice(0, 240) ?? null,
        cookie: document.cookie,
      }));
      report.cases.push({
        requestedLocale: locale,
        route,
        status: response?.status() ?? null,
        responseHeaders: response ? await response.allHeaders() : {},
        server: {
          htmlLang: match(serverHtml, /<html[^>]*\slang="([^"]+)"/i),
          switchLocale: match(serverHtml, /data-current-locale="([^"]+)"/i),
          switchText: decode(match(serverHtml, /<button[^>]*class="[^"]*pc-site-locale-switch[^"]*"[^>]*>([\s\S]*?)<\/button>/i) || ''),
          h1Text: decode(match(serverHtml, /<h1[^>]*>([\s\S]*?)<\/h1>/i) || ''),
          bodyPrefix: decode(match(serverHtml, /<body[^>]*>([\s\S]*?)<\/body>/i) || '').slice(0, 240),
        },
        hydrated,
        runtimeErrors,
        consoleErrors,
      });
      await context.close();
    }
  }
} finally {
  await browser.close();
}
await fs.writeFile(path.join(ARTIFACT_DIR, 'locale-hydration-debug.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report.cases.map(({ requestedLocale, route, server, hydrated, runtimeErrors }) => ({ requestedLocale, route, server, hydrated, runtimeErrorCount: runtimeErrors.length })), null, 2));
