import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const baseUrl = process.env.DIAGNOSTIC_BASE_URL || 'http://127.0.0.1:3000';
const outputDir = path.resolve(process.env.DIAGNOSTIC_OUT_DIR || '../../artifacts/platform-v7-dev-hydration');
const routes = [
  { key: 'landing-ru', path: '/platform-v7?lang=ru', expected: 'Главный риск сделки' },
  { key: 'login-ru', path: '/platform-v7/login?lang=ru', expected: 'Войти в систему' },
  { key: 'forgot-ru', path: '/platform-v7/forgot-password?lang=ru', expected: 'Восстановить доступ' },
  { key: 'landing-en', path: '/platform-v7?lang=en', expected: 'The main transaction risk' },
  { key: 'landing-zh', path: '/platform-v7?lang=zh', expected: '交易的主要风险' },
];

async function serializeConsoleArgument(handle) {
  try {
    return await handle.jsonValue();
  } catch {
    try {
      return await handle.evaluate((value) => {
        if (value instanceof Error) return { name: value.name, message: value.message, stack: value.stack };
        return String(value);
      });
    } catch {
      return '[unserializable]';
    }
  }
}

await fs.mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const report = {
  baseUrl,
  generatedAt: new Date().toISOString(),
  routes: [],
};

try {
  for (const route of routes) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    const consoleMessages = [];
    const pageErrors = [];
    const failedRequests = [];

    page.on('console', async (message) => {
      const args = [];
      for (const handle of message.args()) args.push(await serializeConsoleArgument(handle));
      consoleMessages.push({
        type: message.type(),
        text: message.text(),
        args,
        location: message.location(),
      });
    });
    page.on('pageerror', (error) => {
      pageErrors.push({ name: error.name, message: error.message, stack: error.stack });
    });
    page.on('requestfailed', (request) => {
      failedRequests.push({ url: request.url(), method: request.method(), failure: request.failure() });
    });

    const startedAt = Date.now();
    let response = null;
    let navigationError = null;
    try {
      response = await page.goto(`${baseUrl}${route.path}`, { waitUntil: 'networkidle', timeout: 90_000 });
      await page.waitForTimeout(2_000);
    } catch (error) {
      navigationError = error instanceof Error ? { message: error.message, stack: error.stack } : String(error);
    }

    const bodyText = await page.locator('body').innerText().catch(() => '');
    const html = await page.content().catch(() => '');
    const hydrationMessages = consoleMessages.filter((item) => /hydration|did not match|server html|text content|validateDOMNesting|extra attributes|hydrated/i.test(`${item.text} ${JSON.stringify(item.args)}`));
    const reactErrors = [...consoleMessages, ...pageErrors].filter((item) => /react|hydration|server|client|mismatch|425|422/i.test(JSON.stringify(item)));
    const domSnapshot = await page.evaluate(() => ({
      pathname: location.pathname,
      search: location.search,
      htmlLang: document.documentElement.lang,
      htmlTheme: document.documentElement.getAttribute('data-theme'),
      headerCount: document.querySelectorAll('.pc-site-header').length,
      publicEntryCount: document.querySelectorAll('.pc-v7-public-entry').length,
      legacyLoginCount: document.querySelectorAll('.pc-v7-login-single,.workspace-picker').length,
      authPageCount: document.querySelectorAll('.pc-auth-page').length,
      bodyClass: document.body.className,
      firstHeading: document.querySelector('h1')?.textContent?.trim() || null,
    })).catch(() => null);

    const result = {
      key: route.key,
      path: route.path,
      status: response?.status() ?? null,
      finalUrl: page.url(),
      navigationMs: Date.now() - startedAt,
      navigationError,
      expectedPresent: bodyText.includes(route.expected),
      staleWorkspacePickerPresent: /Выберите один рабочий кабинет|Choose one workspace|选择一个工作空间/i.test(bodyText),
      developmentOverlayPresent: /Unhandled Runtime Error|Application error|Hydration failed/i.test(bodyText),
      domSnapshot,
      consoleMessages,
      pageErrors,
      failedRequests,
      hydrationMessages,
      reactErrors,
      htmlSignals: {
        newLoginClass: html.includes('pc-auth-page'),
        legacyLoginClass: html.includes('pc-v7-login-single'),
      },
    };
    report.routes.push(result);

    await fs.writeFile(path.join(outputDir, `${route.key}.html`), html);
    await page.screenshot({ path: path.join(outputDir, `${route.key}.png`), fullPage: true }).catch(() => undefined);
    await fs.writeFile(path.join(outputDir, 'report.json'), JSON.stringify(report, null, 2));
    await context.close();
  }
} finally {
  await browser.close();
}

report.summary = {
  routes: report.routes.length,
  expectedTextFailures: report.routes.filter((item) => !item.expectedPresent).map((item) => item.key),
  staleLoginRoutes: report.routes.filter((item) => item.staleWorkspacePickerPresent).map((item) => item.key),
  hydrationRoutes: report.routes.filter((item) => item.hydrationMessages.length || item.pageErrors.length).map((item) => item.key),
  totalConsoleErrors: report.routes.reduce((sum, item) => sum + item.consoleMessages.filter((message) => message.type === 'error').length, 0),
  totalPageErrors: report.routes.reduce((sum, item) => sum + item.pageErrors.length, 0),
};
await fs.writeFile(path.join(outputDir, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report.summary, null, 2));

if (report.summary.expectedTextFailures.length || report.summary.staleLoginRoutes.length) process.exitCode = 1;
