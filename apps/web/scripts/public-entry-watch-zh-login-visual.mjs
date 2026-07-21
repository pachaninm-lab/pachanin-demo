import fs from 'node:fs';
import path from 'node:path';
import { chromium, webkit } from '@playwright/test';

const origin = 'https://xn----8sbjf4befbjgs9b.xn--p1ai';
const outputDir = path.resolve(process.cwd(), '../../artifacts/public-entry-watch-zh-login');
fs.mkdirSync(outputDir, { recursive: true });
const results = [];

for (const project of [
  { name: 'chromium-mobile', type: chromium },
  { name: 'webkit-mobile', type: webkit },
]) {
  const browser = await project.type.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    locale: 'zh-CN',
  });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(String(error?.stack || error)));
  page.on('requestfailed', (request) => {
    if (request.url().startsWith(origin) && !String(request.failure()?.errorText || '').includes('ERR_ABORTED')) {
      failedRequests.push({ url: request.url(), error: request.failure()?.errorText || 'unknown' });
    }
  });

  let result;
  try {
    const response = await page.goto(`${origin}/platform-v7/login?lang=zh`, { waitUntil: 'networkidle', timeout: 60_000 });
    await page.waitForTimeout(500);
    const h1 = page.locator('h1').first();
    const form = page.locator('form').first();
    const email = page.locator('input[type="email"], input[name="email"]').first();
    const password = page.locator('input[type="password"], input[name="password"]').first();
    const submit = page.locator('button[type="submit"], input[type="submit"]').first();
    const localeSwitch = page.locator('.pc-site-locale-switch').first();
    await Promise.all([
      h1.waitFor({ state: 'visible', timeout: 15_000 }),
      form.waitFor({ state: 'visible', timeout: 15_000 }),
      email.waitFor({ state: 'visible', timeout: 15_000 }),
      password.waitFor({ state: 'visible', timeout: 15_000 }),
      submit.waitFor({ state: 'visible', timeout: 15_000 }),
      localeSwitch.waitFor({ state: 'visible', timeout: 15_000 }),
    ]);
    const boxes = {
      h1: await h1.boundingBox(),
      form: await form.boundingBox(),
      email: await email.boundingBox(),
      password: await password.boundingBox(),
      submit: await submit.boundingBox(),
      localeSwitch: await localeSwitch.boundingBox(),
    };
    const visual = await page.evaluate(() => ({
      bodyText: document.body.innerText.trim(),
      bodyTextLength: document.body.innerText.trim().length,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollHeight: document.documentElement.scrollHeight,
      clientHeight: document.documentElement.clientHeight,
      background: getComputedStyle(document.body).backgroundColor,
      formOpacity: getComputedStyle(document.querySelector('form')).opacity,
      formVisibility: getComputedStyle(document.querySelector('form')).visibility,
      formDisplay: getComputedStyle(document.querySelector('form')).display,
    }));
    await page.screenshot({ path: path.join(outputDir, `${project.name}.png`), fullPage: true });
    result = {
      project: project.name,
      status: response?.status() ?? null,
      finalUrl: page.url(),
      htmlLang: await page.locator('html').getAttribute('lang'),
      h1Text: (await h1.innerText()).trim(),
      submitText: (await submit.innerText()).trim(),
      currentLocale: await localeSwitch.getAttribute('data-current-locale'),
      nextLocale: await localeSwitch.getAttribute('data-next-locale'),
      boxes,
      visual,
      consoleErrors,
      pageErrors,
      failedRequests,
      pass: response?.status() === 200
        && Object.values(boxes).every(Boolean)
        && visual.scrollWidth <= visual.clientWidth + 1
        && visual.formOpacity !== '0'
        && visual.formVisibility !== 'hidden'
        && visual.formDisplay !== 'none'
        && consoleErrors.length === 0
        && pageErrors.length === 0
        && failedRequests.length === 0,
    };
  } catch (error) {
    result = { project: project.name, pass: false, error: String(error?.stack || error), consoleErrors, pageErrors, failedRequests };
  }
  results.push(result);
  await context.close();
  await browser.close();
}

const report = { generatedAt: new Date().toISOString(), results, allPass: results.every((item) => item.pass) };
fs.writeFileSync(path.join(outputDir, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (!report.allPass) process.exit(1);
