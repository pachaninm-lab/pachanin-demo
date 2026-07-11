import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { chromium, webkit } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const baseURL = process.env.STAFF_EVIDENCE_BASE_URL || 'http://127.0.0.1:3000';
const secret = process.env.JWT_SECRET || 'staff-evidence-jwt-secret-32-characters-minimum';
const artifactDir = path.resolve(process.cwd(), process.env.ARTIFACT_DIR || '../../artifacts/staff-control-center-evidence');
fs.mkdirSync(artifactDir, { recursive: true });

function base64url(value) {
  return Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64url');
}

function jwt() {
  const header = base64url({ alg: 'HS256', typ: 'JWT' });
  const now = Math.floor(Date.now() / 1000);
  const payload = base64url({ sub: 'owner-evidence', sid: 'session-evidence', iat: now, exp: now + 3600 });
  const signature = crypto.createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
}

function authenticatedCookies(token) {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  return [
    {
      name: 'pc_access_token',
      value: token,
      url: baseURL,
      httpOnly: true,
      sameSite: 'Lax',
    },
    {
      name: 'pc_session_present',
      value: encodeURIComponent(JSON.stringify({ role: 'operator', exp, email: 'owner-evidence@example.test' })),
      url: baseURL,
      httpOnly: false,
      sameSite: 'Lax',
    },
  ];
}

const projects = [
  { name: 'chromium-desktop', type: chromium, viewport: { width: 1440, height: 1000 }, mobile: false },
  { name: 'chromium-mobile', type: chromium, viewport: { width: 390, height: 844 }, mobile: true, isMobile: true, hasTouch: true },
  { name: 'webkit-iphone', type: webkit, viewport: { width: 390, height: 844 }, mobile: true, isMobile: true, hasTouch: true },
];
const locales = ['ru', 'en', 'zh'];
const report = { generatedAt: new Date().toISOString(), baseURL, cases: [] };

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

for (const project of projects) {
  const browser = await project.type.launch({ headless: true });
  for (const locale of locales) {
    const context = await browser.newContext({
      viewport: project.viewport,
      isMobile: project.isMobile,
      hasTouch: project.hasTouch,
      locale: locale === 'ru' ? 'ru-RU' : locale === 'zh' ? 'zh-CN' : 'en-US',
    });
    await context.addCookies(authenticatedCookies(jwt()));

    const page = await context.newPage();
    const consoleErrors = [];
    const pageErrors = [];
    const failedRequests = [];
    const badResponses = [];
    page.on('console', (message) => {
      if (message.type() === 'error') {
        const location = message.location();
        consoleErrors.push({ text: message.text(), url: location?.url || null, line: location?.lineNumber ?? null });
      }
    });
    page.on('pageerror', (error) => pageErrors.push(String(error?.stack || error)));
    page.on('requestfailed', (request) => {
      const errorText = request.failure()?.errorText || 'unknown';
      if (!errorText.includes('ERR_ABORTED')) failedRequests.push({ url: request.url(), method: request.method(), errorText });
    });
    page.on('response', (response) => {
      if (response.url().startsWith(baseURL) && response.status() >= 400 && !response.url().includes('/favicon')) {
        badResponses.push({ url: response.url(), method: response.request().method(), status: response.status() });
      }
    });

    await page.goto(`${baseURL}/platform-v7/staff?lang=${locale}`, { waitUntil: 'networkidle', timeout: 60_000 });
    assert(page.url().includes('/platform-v7/staff'), `${project.name}/${locale}: redirected away from staff route: ${page.url()}`);

    await page.locator('.pc-staff-session-form, .pc-staff-console, .pc-staff-state').first().waitFor({
      state: 'visible',
      timeout: 30_000,
    });
    const setup = page.locator('.pc-staff-session-form');
    if (await setup.isVisible()) {
      await setup.locator('textarea').fill('Evidence run for the protected platform control center');
      await setup.locator('input').fill('OWN-EVIDENCE-001');
      await setup.locator('button[type="submit"]').click();
    }

    try {
      await page.locator('.pc-staff-console').waitFor({ state: 'visible', timeout: 30_000 });
    } catch (error) {
      const stateText = await page.locator('body').innerText().catch(() => 'body unavailable');
      await page.screenshot({ path: path.join(artifactDir, `${project.name}-${locale}-entry-failure.png`), fullPage: true }).catch(() => {});
      throw new Error(`${project.name}/${locale}: control console did not activate; body=${JSON.stringify(stateText.slice(0, 2000))}; badResponses=${JSON.stringify(badResponses)}; cause=${String(error)}`);
    }
    await page.waitForLoadState('networkidle');

    const htmlLang = await page.locator('html').getAttribute('lang');
    assert(htmlLang?.startsWith(locale), `${project.name}/${locale}: html lang mismatch ${htmlLang}`);
    const layout = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      textLength: document.body.innerText.trim().length,
    }));
    assert(layout.textLength > 250, `${project.name}/${locale}: probable blank staff screen`);
    assert(layout.scrollWidth <= layout.clientWidth + 1, `${project.name}/${locale}: horizontal overflow ${layout.scrollWidth}/${layout.clientWidth}`);
    assert(await page.locator('.pc-staff-metric').count() === 5, `${project.name}/${locale}: metric workspace incomplete`);

    const axeMain = await new AxeBuilder({ page }).analyze();
    const blockersMain = axeMain.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact));
    assert(blockersMain.length === 0, `${project.name}/${locale}: Axe blockers ${JSON.stringify(blockersMain.map((item) => item.id))}`);

    const nav = project.mobile ? page.locator('.pc-staff-mobile-nav') : page.locator('.pc-staff-sidebar nav');
    await nav.locator('button').nth(1).click();
    await page.locator('.pc-staff-organization').waitFor({ state: 'visible', timeout: 15_000 });
    await page.locator('.pc-staff-organization .pc-staff-row-main > button').click();
    await page.locator('.pc-staff-users').waitFor({ state: 'visible', timeout: 15_000 });
    await page.locator('.pc-staff-primary').click();
    const modal = page.locator('.pc-staff-modal');
    await modal.waitFor({ state: 'visible', timeout: 10_000 });
    await modal.locator('textarea').fill('Read-only owner inspection for evidence');
    await modal.locator('input').fill('OWN-EVIDENCE-VIEW');
    await modal.locator('button[type="submit"]').click();

    await page.waitForURL(/\/platform-v7\/staff\/view-as\?/, { timeout: 30_000 });
    await page.locator('.pc-staff-view-as-banner').waitFor({ state: 'visible', timeout: 20_000 });
    assert(await page.locator('.pc-staff-projected-deal').count() === 1, `${project.name}/${locale}: projected cabinet missing deal`);
    const viewText = await page.locator('body').innerText();
    for (const forbidden of ['payment:release', 'document:sign', 'lab:finalize', 'acceptance:sign', 'arbitration:decide']) {
      assert(viewText.includes(forbidden), `${project.name}/${locale}: guardrail missing ${forbidden}`);
    }

    const staffCookies = (await context.cookies()).filter((cookie) => cookie.name.startsWith('pc_staff_'));
    const control = staffCookies.find((cookie) => cookie.name === 'pc_staff_control_session');
    const delegated = staffCookies.find((cookie) => cookie.name === 'pc_staff_delegated_session');
    assert(control?.httpOnly === true, `${project.name}/${locale}: control session is not HttpOnly`);
    assert(delegated?.httpOnly === true, `${project.name}/${locale}: delegated session is not HttpOnly`);
    assert(control?.path === '/api/staff', `${project.name}/${locale}: control cookie path mismatch ${control?.path}`);
    assert(delegated?.path === '/api/staff', `${project.name}/${locale}: delegated cookie path mismatch ${delegated?.path}`);

    const axeView = await new AxeBuilder({ page }).analyze();
    const blockersView = axeView.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact));
    assert(blockersView.length === 0, `${project.name}/${locale}: VIEW_AS Axe blockers ${JSON.stringify(blockersView.map((item) => item.id))}`);

    await page.screenshot({ path: path.join(artifactDir, `${project.name}-${locale}-view-as.png`), fullPage: true });
    await page.locator('.pc-staff-view-as-banner > button').click();
    await page.waitForURL(/\/platform-v7\/staff(?:\?|$)/, { timeout: 20_000 });
    const afterExit = (await context.cookies()).find((cookie) => cookie.name === 'pc_staff_delegated_session');
    assert(!afterExit, `${project.name}/${locale}: delegated cookie survived VIEW_AS exit`);
    const controlAfterExit = (await context.cookies()).find((cookie) => cookie.name === 'pc_staff_control_session');
    assert(controlAfterExit?.httpOnly === true, `${project.name}/${locale}: control session was lost after VIEW_AS exit`);

    const diagnostics = {
      project: project.name,
      locale,
      consoleErrors,
      pageErrors,
      failedRequests,
      badResponses,
    };
    fs.writeFileSync(
      path.join(artifactDir, `${project.name}-${locale}-diagnostics.json`),
      JSON.stringify(diagnostics, null, 2),
    );
    assert(
      consoleErrors.length === 0 && pageErrors.length === 0 && failedRequests.length === 0 && badResponses.length === 0,
      `${project.name}/${locale}: browser diagnostics ${JSON.stringify(diagnostics)}`,
    );

    report.cases.push({
      project: project.name,
      locale,
      controlCookie: { httpOnly: control.httpOnly, sameSite: control.sameSite, path: control.path },
      delegatedCookie: { httpOnly: delegated.httpOnly, sameSite: delegated.sameSite, path: delegated.path },
      axe: { main: blockersMain.length, viewAs: blockersView.length },
      consoleErrors: 0,
      pageErrors: 0,
      failedRequests: 0,
      badResponses: 0,
    });
    await context.close();
  }
  await browser.close();
}

fs.writeFileSync(path.join(artifactDir, 'staff-control-center-evidence.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ cases: report.cases.length, allGreen: true }, null, 2));
