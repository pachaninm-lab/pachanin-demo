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
  ru: { access: 'Доступ', organizations: 'Организации', submit: 'Создать запрос', activate: 'Активировать защищённую сессию', operationalTitle: 'Рабочие контуры платформы', tabs: [['Поддержка','Отсутствует ЭПД'],['Исполнение','TP-2026-001'],['Деньги','12500000'],['Диагностика','bank-sandbox'],['Сотрудники','Владелец платформы'],['Двухконтрольные действия','deal:operation:retry'],['Аварийный доступ','Нет элементов, требующих внимания.']], viewBanner: 'Режим просмотра чужого кабинета', cabinet: 'Просмотр кабинета' },
  en: { access: 'Access', organizations: 'Organizations', submit: 'Create request', activate: 'Activate protected session', operationalTitle: 'Platform staff workspaces', tabs: [['Support','Отсутствует ЭПД'],['Execution','TP-2026-001'],['Money','12500000'],['Diagnostics','bank-sandbox'],['Staff','Platform owner'],['Dual-control actions','deal:operation:retry'],['Emergency access','Nothing currently requires attention.']], viewBanner: 'Viewing another cabinet', cabinet: 'Cabinet view' },
  zh: { access: '访问', organizations: '组织', submit: '创建申请', activate: '激活受保护会话', operationalTitle: '平台员工工作台', tabs: [['支持','Отсутствует ЭПД'],['履约','TP-2026-001'],['资金','12500000'],['诊断','bank-sandbox'],['员工','平台所有者'],['双人控制操作','deal:operation:retry'],['紧急访问','当前没有需要处理的项目。']], viewBanner: '正在查看其他账户', cabinet: '账户视图' },
};
const localeSettings = { ru: 'ru-RU', en: 'en-GB', zh: 'zh-CN' };
const report = { generatedAt: new Date().toISOString(), source: process.env.GITHUB_SHA || null, cases: [] };
function assert(condition, message) { if (!condition) throw new Error(message); }

for (const project of projects) {
  const browser = await project.browser.launch({ headless: true });
  for (const locale of Object.keys(copies)) {
    const copy = copies[locale];
    const context = await browser.newContext({ viewport: project.viewport, isMobile: project.isMobile, hasTouch: project.hasTouch, locale: localeSettings[locale], ignoreHTTPSErrors: true });
    await context.addCookies([
      { name: 'pc_access_token', value: 'evidence-access-token', url: baseURL, httpOnly: true, sameSite: 'Lax' },
      { name: 'pc_csrf_token', value: 'evidence-csrf-token', url: baseURL, httpOnly: false, sameSite: 'Lax' },
      { name: 'pc_session_present', value: JSON.stringify({ role: 'operator', exp: Math.floor(Date.now() / 1000) + 3600 }), url: baseURL, httpOnly: false, sameSite: 'Lax' },
    ]);
    const page = await context.newPage();
    const consoleErrors = []; const pageErrors = []; const failedRequests = []; const badResponses = [];
    page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
    page.on('pageerror', (error) => pageErrors.push(error?.message || 'pageerror'));
    page.on('requestfailed', (request) => { const error = request.failure()?.errorText || 'unknown'; if (!error.includes('ERR_ABORTED')) failedRequests.push({ url: request.url(), error }); });
    page.on('response', (response) => { if (response.url().startsWith(baseURL) && response.status() >= 400 && !response.url().includes('favicon')) badResponses.push({ url: response.url(), status: response.status() }); });

    await page.goto(`${baseURL}/platform-v7/staff?lang=${locale}`, { waitUntil: 'networkidle', timeout: 60_000 });
    const control = page.locator('main[data-staff-control-center]');
    try {
      await control.waitFor({ state: 'visible', timeout: 30_000 });
    } catch {
      const diagnostic = { project: project.name, locale, url: page.url(), title: await page.title(), body: (await page.locator('body').innerText()).slice(0, 4000), consoleErrors, pageErrors, failedRequests, badResponses };
      fs.writeFileSync(path.join(artifactDir, `diagnostic-${project.name}-${locale}.json`), JSON.stringify(diagnostic, null, 2));
      await page.screenshot({ path: path.join(artifactDir, `diagnostic-${project.name}-${locale}.png`), fullPage: true });
      throw new Error(`${project.name}/${locale}: Staff Control Center missing at ${page.url()}`);
    }
    assert((await page.locator('html').getAttribute('lang'))?.startsWith(locale), `${project.name}/${locale}: html lang mismatch`);
    assert(!page.url().includes('role='), `${project.name}/${locale}: role leaked into URL`);
    await control.getByRole('button', { name: copy.access, exact: true }).first().click();
    await control.locator('input[maxlength="128"]').first().fill('OWN-2353');
    await control.locator('textarea[maxlength="2000"]').first().fill('Final protected Staff Control Center acceptance session');
    await control.getByRole('button', { name: copy.submit, exact: true }).click();
    const activate = control.getByRole('button', { name: copy.activate, exact: true }).first();
    try {
      await activate.waitFor({ state: 'visible', timeout: 20_000 });
    } catch {
      const probe = await page.evaluate(async () => {
        const response = await fetch('/api/staff/access/requests', { credentials: 'same-origin', cache: 'no-store' });
        return { status: response.status, body: await response.text() };
      });
      const diagnostic = {
        project: project.name,
        locale,
        url: page.url(),
        body: (await page.locator('body').innerText()).slice(0, 8000),
        probe,
        consoleErrors,
        pageErrors,
        failedRequests,
        badResponses,
      };
      fs.writeFileSync(path.join(artifactDir, `activation-${project.name}-${locale}.json`), JSON.stringify(diagnostic, null, 2));
      await page.screenshot({ path: path.join(artifactDir, `activation-${project.name}-${locale}.png`), fullPage: true });
      throw new Error(`${project.name}/${locale}: protected-session activation control missing`);
    }
    const [activationResponse] = await Promise.all([
      page.waitForResponse((response) => {
        if (response.request().method() !== 'POST') return false;
        return /^\/api\/staff\/access\/grants\/[^/]+\/activate$/.test(new URL(response.url()).pathname);
      }, { timeout: 30_000 }),
      activate.click(),
    ]);
    const activationText = await activationResponse.text().catch(() => '');
    assert(activationResponse.ok(), `${project.name}/${locale}: Staff activation failed ${activationResponse.status()} ${activationText}`);
    await control.locator('code').filter({ hasText: 'support-case:read' }).first().waitFor({ state: 'visible', timeout: 30_000 });
    let issuedCookies = [];
    for (let attempt = 0; attempt < 30; attempt += 1) {
      issuedCookies = await context.cookies(`${baseURL}/api/staff/session-context`);
      if (issuedCookies.some((cookie) => cookie.name === 'pc_staff_access_token' && cookie.httpOnly)) break;
      await page.waitForTimeout(100);
    }
    assert(issuedCookies.some((cookie) => cookie.name === 'pc_staff_access_token' && cookie.httpOnly), `${project.name}/${locale}: Staff token was not issued before reload`);
    await page.reload({ waitUntil: 'networkidle' });
    await control.locator('code').filter({ hasText: 'support-case:read' }).first().waitFor({ state: 'visible', timeout: 30_000 });

    const operational = page.locator('section[aria-labelledby="staff-operational-workspaces-title"]');
    await operational.getByRole('heading', { name: copy.operationalTitle, exact: true }).waitFor({ state: 'visible', timeout: 30_000 });
    const layout = await page.evaluate(() => ({
      width: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      text: document.body.innerText.length,
      sections: document.querySelectorAll('main[data-staff-control-center] section').length,
      buttons: document.querySelectorAll('main[data-staff-control-center] button').length,
      workspaces: document.querySelectorAll('section[aria-labelledby="staff-operational-workspaces-title"]').length,
    }));
    assert(layout.text > (locale === 'zh' ? 500 : 1000) && layout.sections >= 3 && layout.buttons >= 8 && layout.workspaces === 1, `${project.name}/${locale}: probable blank or structurally incomplete staff screen ${JSON.stringify(layout)}`);
    assert(layout.scrollWidth <= layout.width + 1, `${project.name}/${locale}: horizontal overflow ${layout.scrollWidth}/${layout.width}`);

    for (const [label, marker] of copy.tabs) {
      const button = operational.getByRole('button', { name: label, exact: true });
      try {
        await button.waitFor({ state: 'visible', timeout: 15_000 });
      } catch {
        const diagnostic = { project: project.name, locale, label, url: page.url(), operational: (await operational.innerText()).slice(0, 10000), buttons: await operational.getByRole('button').allTextContents(), consoleErrors, pageErrors, failedRequests, badResponses };
        fs.writeFileSync(path.join(artifactDir, `tab-${project.name}-${locale}-${label}.json`), JSON.stringify(diagnostic, null, 2));
        await page.screenshot({ path: path.join(artifactDir, `tab-${project.name}-${locale}-${label}.png`), fullPage: true });
        throw new Error(`${project.name}/${locale}: workspace tab ${label} missing`);
      }
      await button.click();
      try {
        await operational.getByText(marker, { exact: false }).first().waitFor({ state: 'visible', timeout: 15_000 });
      } catch {
        const probes = await page.evaluate(async () => {
          const paths = ['support','support/cases','operations','finance','diagnostics','assignments','critical-actions','break-glass'];
          const rows = [];
          for (const path of paths) {
            try {
              const response = await fetch(`/api/staff/workspaces/${path}`, { credentials: 'same-origin', cache: 'no-store' });
              rows.push({ path, status: response.status, body: (await response.text()).slice(0, 5000) });
            } catch (error) {
              rows.push({ path, status: 0, body: String(error) });
            }
          }
          return rows;
        });
        const diagnostic = {
          project: project.name,
          locale,
          label,
          marker,
          url: page.url(),
          body: (await page.locator('body').innerText()).slice(0, 12000),
          operational: (await operational.innerText()).slice(0, 10000),
          probes,
          consoleErrors,
          pageErrors,
          failedRequests,
          badResponses,
        };
        fs.writeFileSync(path.join(artifactDir, `workspace-${project.name}-${locale}-${label}.json`), JSON.stringify(diagnostic, null, 2));
        await page.screenshot({ path: path.join(artifactDir, `workspace-${project.name}-${locale}-${label}.png`), fullPage: true });
        throw new Error(`${project.name}/${locale}: workspace ${label} marker ${marker} missing`);
      }
    }

    const staffCookies = await context.cookies(`${baseURL}/api/staff/session-context`);
    const staff = staffCookies.find((cookie) => cookie.name === 'pc_staff_access_token');
    const meta = staffCookies.find((cookie) => cookie.name === 'pc_staff_access_meta');
    assert(staff?.httpOnly === true && staff.path === '/api/staff', `${project.name}/${locale}: opaque staff cookie boundary failed`);
    assert(meta?.httpOnly === true && meta.path === '/api/staff', `${project.name}/${locale}: staff metadata cookie boundary failed`);
    assert(!(await page.evaluate(() => document.cookie)).includes('opaque-control-token'), `${project.name}/${locale}: opaque token visible to JS`);

    if (project.name === 'chromium-desktop' && locale === 'ru') {
      const result = await page.evaluate(async () => {
        const csrf = document.cookie.split('; ').find((entry) => entry.startsWith('pc_csrf_token='))?.split('=')[1] || '';
        const headers = { 'Content-Type': 'application/json', 'x-csrf-token': decodeURIComponent(csrf) };
        const request = await fetch('/api/staff/access/requests', { method: 'POST', credentials: 'same-origin', headers, body: JSON.stringify({ assignmentId: 'sta-owner', accessMode: 'VIEW_AS', permissions: ['cabinet:view-as','deal:read','document:metadata:read'], targetOrganizationId: 'org-buyer', targetRole: 'BUYER', reason: 'Read-only owner acceptance projection', ticketId: 'VIEW-2353', durationSeconds: 900 }) });
        const requested = await request.json();
        if (!request.ok) return { ok: false, stage: 'request', status: request.status };
        const activated = await fetch(`/api/staff/access/grants/${encodeURIComponent(requested.grantId)}/activate`, { method: 'POST', credentials: 'same-origin', headers, body: '{}' });
        return { ok: activated.ok, stage: 'activate', status: activated.status };
      });
      assert(result.ok, `VIEW_AS activation failed ${JSON.stringify(result)}`);
      await page.reload({ waitUntil: 'networkidle' });
      await control.getByText(copy.viewBanner, { exact: false }).waitFor({ state: 'visible', timeout: 30_000 });
      await control.getByRole('button', { name: copy.organizations, exact: true }).first().click();
      await control.getByText(copy.cabinet, { exact: true }).first().waitFor({ state: 'visible', timeout: 30_000 });
      await control.getByText('TP-2026-001', { exact: false }).first().waitFor({ state: 'visible', timeout: 15_000 });
      const body = await page.locator('body').innerText();
      for (const forbidden of ['payment:release','bank-callback:confirm','document:sign','lab:finalize','acceptance:sign','arbitration:decide']) assert(!body.includes(forbidden), `VIEW_AS exposed forbidden command ${forbidden}`);
    }

    const axe = await new AxeBuilder({ page }).analyze();
    const blockers = axe.violations.filter((violation) => ['serious','critical'].includes(violation.impact));
    assert(blockers.length === 0, `${project.name}/${locale}: Axe blockers ${JSON.stringify(blockers.map((item) => item.id))}`);
    assert(consoleErrors.length === 0, `${project.name}/${locale}: console errors ${JSON.stringify(consoleErrors)}`);
    assert(pageErrors.length === 0, `${project.name}/${locale}: page errors ${JSON.stringify(pageErrors)}`);
    assert(failedRequests.length === 0, `${project.name}/${locale}: failed requests ${JSON.stringify(failedRequests)}`);
    assert(badResponses.length === 0, `${project.name}/${locale}: bad responses ${JSON.stringify(badResponses)}`);

    await page.screenshot({ path: path.join(artifactDir, `${project.name}-${locale}.png`), fullPage: true });
    report.cases.push({ project: project.name, locale, workspaces: copy.tabs.length, viewAs: project.name === 'chromium-desktop' && locale === 'ru', axeSeriousCritical: 0, consoleErrors: 0, pageErrors: 0, failedRequests: 0, badResponses: 0, horizontalOverflow: false, staffCookieHttpOnly: true, staffCookiePath: staff.path });
    await context.close();
  }
  await browser.close();
}

fs.writeFileSync(path.join(artifactDir, 'staff-control-center-acceptance.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ cases: report.cases.length, allGreen: true }, null, 2));
