import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const origin = 'https://xn----8sbjf4befbjgs9b.xn--p1ai';
const routes = ['/platform-v7', '/platform-v7/login', '/platform-v7/forgot-password'];
const locales = ['ru', 'en', 'zh'];
const nextLocale = { ru: 'en', en: 'zh', zh: 'ru' };
const shortLabel = { ru: 'RU', en: 'EN', zh: 'ZH' };
const reportPath = path.resolve(process.cwd(), '../../artifacts/public-entry-watch/report.json');
const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
const cases = [];
const failures = [];

const browser = await chromium.launch({ headless: true });
try {
  for (const viewport of [{ name: 'desktop', width: 1440, height: 1000 }, { name: 'mobile', width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, isMobile: viewport.name === 'mobile', hasTouch: viewport.name === 'mobile' });
    const page = await context.newPage();
    for (const route of routes) {
      for (const locale of locales) {
        try {
          await page.goto(`${origin}${route}?lang=${locale}`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
          const control = page.locator('.pc-site-locale-switch').first();
          await control.waitFor({ state: 'visible', timeout: 15_000 });
          const current = await control.getAttribute('data-current-locale');
          const next = await control.getAttribute('data-next-locale');
          const label = (await control.innerText()).trim().toUpperCase();
          const aria = await control.getAttribute('aria-label');
          const row = { viewport: viewport.name, route, locale, current, next, label, aria, finalUrl: page.url() };
          cases.push(row);
          if (current !== locale || next !== nextLocale[locale] || !label.includes(shortLabel[locale]) || !aria) {
            failures.push({ code: 'LANGUAGE_CYCLE_CONTROL_INVALID', ...row });
          }
        } catch (error) {
          failures.push({ code: 'LANGUAGE_CYCLE_CONTROL_CHECK_FAILED', viewport: viewport.name, route, locale, error: String(error?.stack || error) });
        }
      }
    }
    await context.close();
  }
} finally {
  await browser.close();
}

report.languageCycle = { cases, failures };
if (failures.length === 0) {
  report.issues = (report.issues || []).filter((item) => item.code !== 'LANGUAGE_SWITCH_INCOMPLETE');
} else {
  report.issues = [...(report.issues || []).filter((item) => item.code !== 'LANGUAGE_SWITCH_INCOMPLETE'), ...failures];
}
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ languageCycleCases: cases.length, languageCycleFailures: failures.length, remainingIssues: report.issues.length, issueCodes: [...new Set(report.issues.map((item) => item.code))] }, null, 2));
