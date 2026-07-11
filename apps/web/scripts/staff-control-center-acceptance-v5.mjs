import fs from 'node:fs';
import path from 'node:path';
import { chromium, webkit } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const baseURL = process.env.STAFF_EVIDENCE_BASE_URL || 'http://localhost:3000';
const artifactDir = path.resolve(process.cwd(), process.env.ARTIFACT_DIR || '../../artifacts/staff-control-center-acceptance-final');
fs.mkdirSync(artifactDir, { recursive: true });

const projects = [
  { name: 'chromium-desktop', browser: chromium, viewport: { width: 1440, height: 1000 } },
  { name: 'chromium-mobile', browser: chromium, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
  { name: 'webkit-iphone', browser: webkit, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
];

const copies = {
  ru: {
    access: 'Доступ', submit: 'Создать запрос', active: 'Активна', organizations: 'Организации',
    operationalTitle: 'Рабочие контуры платформы', viewBanner: 'Режим просмотра чужого кабинета', cabinet: 'Просмотр кабинета',
    tabs: [['Поддержка','Отсутствует ЭПД'],['Исполнение','TP-2026-001'],['Деньги','12500000'],['Диагностика','bank-sandbox'],['Сотрудники','Владелец платформы'],['Двухконтрольные действия','deal:operation:retry'],['Аварийный доступ','Нет элементов, требующих внимания.']],
  },
  en: {
    access: 'Access', submit: 'Create request', active: 'Active', organizations: 'Organizations',
    operationalTitle: 'Platform staff workspaces', viewBanner: 'Viewing another cabinet', cabinet: 'Cabinet view',
    tabs: [['Support','Отсутствует ЭПД'],['Execution','TP-2026-001'],['Money','12500000'],['Diagnostics','bank-sandbox'],['Staff','Platform owner'],['Dual-control actions','deal:operation:retry'],['Emergency access','Nothing currently requires attention.']],
  },
  zh: {
    access: '访问', submit: '创建申请', active: '已激活', organizations: '组织',
    operationalTitle: '平台员工工作台', viewBanner: '正在查看其他账户', cabinet: '账户视图',
    tabs: [['支持','Отсутствует ЭПД'],['履约','TP-2026-001'],['资金','12500000'],['诊断','bank-sandbox'],['员工','平台所有者'],['双人控制操作','deal:operation:retry'],['紧急访问','当前没有需要处理的项目。']],
  },
};
const localeSettings = { ru: 'ru-RU', en: 'en-GB', zh: 'zh-CN' };
const report = { generatedAt: new Date().toISOString(), implementationHead: process.env.STAFF_IMPLEMENTATION_HEAD || null, cases: [] };

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function csrf(page) {
  return page.evaluate(() => decodeURIComponent(document.cookie.split('; ').find((entry) => entry.startsWith('pc_csrf_token='))?.split('=')[1] || ''));
}

async function activateLatest(page, mode) {
  return page.evaluate(async ({ expectedMode, csrfToken }) => {
    const requestsResponse = await fetch('/api/staff/access/requests', { credentials: 'same-origin', cache: 'no-store' });
    const requests = await requestsResponse.json();
    if (!requestsResponse.ok || !Array.isArray(requests)) return { ok: false, stage: 'list', status: requestsResponse.status, body: requests };
    const current = requests.find((item) => item.access_mode === expectedMode && item.grant_id && ['GRANTED', 'ACTIVE'].includes(item.grant_status || item.status));
    if (!current) return { ok: false, stage: 'grant', status: 0, body: requests.slice(0, 3) };
    const response = await fetch(`/api/staff/access/grants/${encodeURIComponent(current.grant_id)}/activate`, {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
      body: '{}',
    });
    return { ok: response.ok, stage: 'activate', status: response.status, body: await response.json().catch(() => null) };
  }, { expectedMode: mode, csrfToken: await csrf(page) });
}

async function readSessionContext(page) {
  return page.evaluate(async () => {
    const response = await fetch('/api/staff/session-context', { credentials: 'same-origin', cache: 'no-store' });
    return { ok: response.ok, status: response.status, body: await response.json().catch(() => null) };
  });
}

for (const project of projects) {
  const browser = await project.browser.launch({ headless: true });
  for (const locale of Object.keys(copies)) {
    const copy = copies[locale];
    const context = await browser.newContext({
      viewport: project.viewport,
      isMobile: project.isMobile,
      hasTouch: project.hasTouch,
      locale: localeSettings[locale],
      ignoreHTTPSErrors: true,
    });
    await context.addCookies([
      { name: 'pc_access_token', value: 'evidence-access-token', url: baseURL, httpOnly: true, sameSite: 'Lax' },
      { name: 'pc_csrf_token', value: 'evidence-csrf-token', url: baseURL, httpOnly: false, sameSite: 'Lax' },
      { name: 'pc_session_present', value: JSON.stringify({ role: 'operator', exp: Math.floor(Date.now() / 1000) + 3600 }), url: baseURL, httpOnly: false, sameSite: 'Lax' },
    ]);

    const page = await context.newPage();
    const consoleErrors = [];
    const pageErrors = [];
    const failedRequests = [];
    const badResponses = [];
    page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
    page.on('pageerror', (error) => pageErrors.push(error?.message || 'pageerror'));
    page.on('requestfailed', (request) => {
      const error = request.failure()?.errorText || 'unknown';
      if (!error.includes('ERR_ABORTED')) failedRequests.push({ url: request.url(), error });
    });
    page.on('response', (response) => {
      if (response.url().startsWith(baseURL) && response.status() >= 400 && !response.url().includes('favicon')) {
        badResponses.push({ url: response.url(), status: response.status() });
      }
    });

    try {
      await page.goto(`${baseURL}/platform-v7/staff?lang=${locale}`, { waitUntil: 'networkidle', timeout: 60_000 });
      const control = page.locator('main[data-staff-control-center]');
      await control.waitFor({ state: 'visible', timeout: 30_000 });
      assert((await page.locator('html').getAttribute('lang'))?.startsWith(locale), `${project.name}/${locale}: html lang mismatch`);
      assert(!page.url().includes('role='), `${project.name}/${locale}: role leaked into URL`);

      await control.getByRole('button', { name: copy.access, exact: true }).first().click();
      await control.locator('input[maxlength="128"]').first().fill(`OWN-${project.name}-${locale}`);
      await control.locator('textarea[maxlength="2000"]').first().fill('Exact protected Staff Control Center acceptance session');
      const requestResponsePromise = page.waitForResponse((response) => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/staff/access/requests');
      await control.getByRole('button', { name: copy.submit, exact: true }).click();
      const requestResponse = await requestResponsePromise;
      assert(requestResponse.ok(), `${project.name}/${locale}: access request failed ${requestResponse.status()}`);

      const activation = await activateLatest(page, 'CONTROL_PLANE');
      assert(activation.ok, `${project.name}/${locale}: CONTROL_PLANE activation failed ${JSON.stringify(activation)}`);
      const cookiesAfterActivation = await context.cookies(`${baseURL}/api/staff/session-context`);
      const opaque = cookiesAfterActivation.find((cookie) => cookie.name === 'pc_staff_access_token');
      const metadata = cookiesAfterActivation.find((cookie) => cookie.name === 'pc_staff_access_meta');
      assert(opaque?.httpOnly && opaque.path === '/api/staff', `${project.name}/${locale}: opaque Staff cookie boundary failed`);
      assert(metadata?.httpOnly && metadata.path === '/api/staff', `${project.name}/${locale}: Staff metadata cookie boundary failed`);
      assert(!(await page.evaluate(() => document.cookie)).includes('opaque-control-token'), `${project.name}/${locale}: opaque token visible to JavaScript`);

      await page.reload({ waitUntil: 'networkidle' });
      const restored = await readSessionContext(page);
      assert(restored.ok && restored.body?.active === true && restored.body?.session?.accessMode === 'CONTROL_PLANE', `${project.name}/${locale}: CONTROL_PLANE did not survive reload ${JSON.stringify(restored)}`);
      await control.getByText(copy.active, { exact: true }).first().waitFor({ state: 'visible', timeout: 30_000 });

      const operational = page.locator('section[aria-labelledby="staff-operational-workspaces-title"]');
      await operational.getByRole('heading', { name: copy.operationalTitle, exact: true }).waitFor({ state: 'visible', timeout: 30_000 });
      const layout = await page.evaluate(() => ({
        width: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        sections: document.querySelectorAll('main[data-staff-control-center] section').length,
        buttons: document.querySelectorAll('main[data-staff-control-center] button').length,
        workspaces: document.querySelectorAll('section[aria-labelledby="staff-operational-workspaces-title"]').length,
      }));
      assert(layout.sections >= 3 && layout.buttons >= 8 && layout.workspaces === 1, `${project.name}/${locale}: structurally incomplete Staff screen ${JSON.stringify(layout)}`);
      assert(layout.scrollWidth <= layout.width + 1, `${project.name}/${locale}: horizontal overflow ${layout.scrollWidth}/${layout.width}`);

      for (const [label, marker] of copy.tabs) {
        const button = operational.getByRole('button', { name: label, exact: true });
        await button.waitFor({ state: 'visible', timeout: 15_000 });
        await button.click();
        await operational.getByText(marker, { exact: false }).first().waitFor({ state: 'visible', timeout: 15_000 });
      }

      let viewAs = false;
      if (project.name === 'chromium-desktop' && locale === 'ru') {
        const viewRequest = await page.evaluate(async (csrfToken) => {
          const response = await fetch('/api/staff/access/requests', {
            method: 'POST', credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
            body: JSON.stringify({
              assignmentId: 'sta-owner', accessMode: 'VIEW_AS',
              permissions: ['cabinet:view-as','deal:read','document:metadata:read'],
              targetOrganizationId: 'org-buyer', targetRole: 'BUYER',
              reason: 'Read-only owner acceptance projection', ticketId: 'VIEW-2353', durationSeconds: 900,
            }),
          });
          return { ok: response.ok, status: response.status, body: await response.json().catch(() => null) };
        }, await csrf(page));
        assert(viewRequest.ok, `VIEW_AS request failed ${JSON.stringify(viewRequest)}`);
        const viewActivation = await activateLatest(page, 'VIEW_AS');
        assert(viewActivation.ok, `VIEW_AS activation failed ${JSON.stringify(viewActivation)}`);
        await page.reload({ waitUntil: 'networkidle' });
        const viewContext = await readSessionContext(page);
        assert(viewContext.ok && viewContext.body?.active === true && viewContext.body?.session?.accessMode === 'VIEW_AS', `VIEW_AS did not survive reload ${JSON.stringify(viewContext)}`);
        await control.getByText(copy.viewBanner, { exact: false }).waitFor({ state: 'visible', timeout: 30_000 });
        await control.getByRole('button', { name: copy.organizations, exact: true }).first().click();
        await control.getByText(copy.cabinet, { exact: true }).first().waitFor({ state: 'visible', timeout: 30_000 });
        await control.getByText('TP-2026-001', { exact: false }).first().waitFor({ state: 'visible', timeout: 15_000 });
        const body = await page.locator('body').innerText();
        for (const forbidden of ['payment:release','bank-callback:confirm','document:sign','lab:finalize','acceptance:sign','arbitration:decide']) {
          assert(!body.includes(forbidden), `VIEW_AS exposed forbidden command ${forbidden}`);
        }
        viewAs = true;
      }

      const axe = await new AxeBuilder({ page }).analyze();
      const blockers = axe.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact));
      assert(blockers.length === 0, `${project.name}/${locale}: Axe blockers ${JSON.stringify(blockers.map((item) => item.id))}`);
      assert(consoleErrors.length === 0, `${project.name}/${locale}: console errors ${JSON.stringify(consoleErrors)}`);
      assert(pageErrors.length === 0, `${project.name}/${locale}: page errors ${JSON.stringify(pageErrors)}`);
      assert(failedRequests.length === 0, `${project.name}/${locale}: failed requests ${JSON.stringify(failedRequests)}`);
      assert(badResponses.length === 0, `${project.name}/${locale}: bad responses ${JSON.stringify(badResponses)}`);

      await page.screenshot({ path: path.join(artifactDir, `${project.name}-${locale}.png`), fullPage: true });
      report.cases.push({
        project: project.name, locale, workspaces: copy.tabs.length, viewAs,
        axeSeriousCritical: 0, consoleErrors: 0, pageErrors: 0,
        failedRequests: 0, badResponses: 0, horizontalOverflow: false,
        staffCookieHttpOnly: true, reloadPersistence: true,
      });
    } catch (error) {
      const diagnostic = {
        project: project.name, locale, url: page.url(),
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : null,
        body: (await page.locator('body').innerText().catch(() => '')).slice(0, 16000),
        consoleErrors, pageErrors, failedRequests, badResponses,
        cookies: await context.cookies(`${baseURL}/api/staff/session-context`),
        sessionContext: await readSessionContext(page).catch(() => null),
      };
      fs.writeFileSync(path.join(artifactDir, `failure-${project.name}-${locale}.json`), JSON.stringify(diagnostic, null, 2));
      await page.screenshot({ path: path.join(artifactDir, `failure-${project.name}-${locale}.png`), fullPage: true }).catch(() => undefined);
      throw error;
    } finally {
      await context.close();
    }
  }
  await browser.close();
}

fs.writeFileSync(path.join(artifactDir, 'staff-control-center-acceptance.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ cases: report.cases.length, allGreen: true }, null, 2));
