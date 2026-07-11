import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const baseURL = process.env.STAFF_EVIDENCE_BASE_URL || 'http://localhost:3000';
const artifactDir = path.resolve(process.cwd(), process.env.ARTIFACT_DIR || '../../artifacts/staff-control-center-axe-diagnostics');
fs.mkdirSync(artifactDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'ru-RU' });
await context.addCookies([
  { name: 'pc_access_token', value: 'evidence-access-token', url: baseURL, httpOnly: true, sameSite: 'Lax' },
  { name: 'pc_csrf_token', value: 'evidence-csrf-token', url: baseURL, httpOnly: false, sameSite: 'Lax' },
  { name: 'pc_session_present', value: JSON.stringify({ role: 'operator', exp: Math.floor(Date.now() / 1000) + 3600 }), url: baseURL, httpOnly: false, sameSite: 'Lax' },
]);

const page = await context.newPage();
const consoleErrors = [];
const pageErrors = [];
page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
page.on('pageerror', (error) => pageErrors.push(error?.message || 'pageerror'));

try {
  await page.goto(`${baseURL}/platform-v7/staff?lang=ru`, { waitUntil: 'networkidle', timeout: 60_000 });
  const control = page.locator('main[data-staff-control-center]');
  await control.waitFor({ state: 'visible', timeout: 30_000 });
  await control.getByRole('button', { name: 'Доступ', exact: true }).first().click();
  await control.locator('input[maxlength="128"]').first().fill('AXE-2353');
  await control.locator('textarea[maxlength="2000"]').first().fill('Axe diagnostics for protected Staff Control Center');
  await control.getByRole('button', { name: 'Создать запрос', exact: true }).click();
  const activate = control.getByRole('button', { name: 'Активировать защищённую сессию', exact: true }).first();
  await activate.waitFor({ state: 'visible', timeout: 20_000 });
  await activate.click();
  await control.locator('code').filter({ hasText: 'support-case:read' }).first().waitFor({ state: 'visible', timeout: 30_000 });

  const axe = await new AxeBuilder({ page }).analyze();
  const blockers = axe.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact));
  const report = {
    url: page.url(),
    title: await page.title(),
    blockers,
    allViolations: axe.violations,
    consoleErrors,
    pageErrors,
    body: (await page.locator('body').innerText()).slice(0, 20000),
  };
  fs.writeFileSync(path.join(artifactDir, 'axe-diagnostics.json'), JSON.stringify(report, null, 2));
  await page.screenshot({ path: path.join(artifactDir, 'axe-diagnostics.png'), fullPage: true });
  console.log(JSON.stringify(blockers.map((item) => ({ id: item.id, impact: item.impact, nodes: item.nodes.map((node) => ({ target: node.target, html: node.html, failureSummary: node.failureSummary })) })), null, 2));
  if (blockers.length > 0) throw new Error(`Axe serious/critical blockers: ${blockers.map((item) => item.id).join(', ')}`);
  if (consoleErrors.length > 0 || pageErrors.length > 0) throw new Error(`Runtime errors: ${JSON.stringify({ consoleErrors, pageErrors })}`);
} catch (error) {
  fs.writeFileSync(path.join(artifactDir, 'axe-error.json'), JSON.stringify({ message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : null, consoleErrors, pageErrors }, null, 2));
  await page.screenshot({ path: path.join(artifactDir, 'axe-error.png'), fullPage: true }).catch(() => undefined);
  throw error;
} finally {
  await browser.close();
}
