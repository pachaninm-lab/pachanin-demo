import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const currentDir = process.cwd();
const webRoot = currentDir.endsWith(path.join('apps','web')) ? currentDir : path.join(currentDir,'apps','web');
const repoRoot = path.resolve(webRoot,'..','..');
const readWeb = (relative: string) => fs.readFileSync(path.join(webRoot, relative),'utf8');
const readRepo = (relative: string) => fs.readFileSync(path.join(repoRoot, relative),'utf8');

const page = readWeb('app/platform-v7/staff/page.tsx');
const component = readWeb('components/platform-v7/staff/founder-control/FounderControlCenter.tsx');
const css = readWeb('components/platform-v7/staff/founder-control/FounderControlCenter.module.css');
const bff = readWeb('app/api/staff/founder-control/[[...path]]/route.ts');
const server = readWeb('lib/platform-v7/founder-control-server.ts');
const spec = readRepo('apps/api/src/modules/founder-control/founder-control.reference.ts');
const calculator = readRepo('apps/api/src/modules/founder-control/founder-control.calculator.ts');
const service = readRepo('apps/api/src/modules/founder-control/founder-control.service.ts');
const repository = readRepo('apps/api/src/modules/founder-control/founder-control.repository.ts');
const migration = readRepo('apps/api/prisma/migrations/20260908123000_founder_control_center/migration.sql');

describe('platform-v7 founder/CEO control center', () => {
  it('renders only in the verified PLATFORM_OWNER staff cabinet and never in tenant executive space', () => {
    expect(page).toContain("verification.identity.staffOwner === true");
    expect(page).toContain('loadFounderControlBundle()');
    expect(page).toContain('<FounderControlCenter');
    expect(service).toContain('StaffPermission.FOUNDER_CONTROL_READ');
    expect(service).toContain('StaffPermission.FOUNDER_CONTROL_WRITE');
    expect(migration).toContain("assignment.role = 'PLATFORM_OWNER'");
    expect(migration).not.toContain("assignment.role IN ('PLATFORM_OWNER','PLATFORM_ADMIN')");
  });

  it('fails closed and never substitutes demo financial data when the service is unavailable', () => {
    expect(server).toContain('available: false');
    expect(component).toContain('No demo numbers are substituted');
    expect(component).toContain('Никакие демонстрационные цифры не подставляются');
    expect(component).not.toContain('Math.random');
    expect(component).not.toContain('localStorage');
    expect(component).not.toContain('sessionStorage');
  });

  it('keeps the v11.2 workbook as a complete explicit parity contract', () => {
    const sheets = [
      'Допущения','Unit economics','Портфель 12М','Стрессы','Коммерческий gate','Роли и UX','Ресурсы','Факты клиентов',
      'Экосистема 100','Деньги 13н','Источники','Решение','Налоговый gate','Инвестор','Транши и капитал','DD инвестора',
      'Стадия проекта','Сценарии стадии','Инвестор fit','Продажи и CAC','Итог РФ','Справочники','Pipeline','Клиенты','Cash 13W',
      'Вводы CEO','Plan vs Actual','Hiring Gate','Investor Gates','Decision Log','CEO Control','Evidence Register','System Audit',
      'Rolling Forecast','Forecast Accuracy','AR DSO','Client P&L','Monthly Close','Retention','Assumption Log','Management Alerts','Company Health',
    ];
    for (const sheet of sheets) expect(spec).toContain(`['${sheet}'`);
    expect(component).toContain('Excel v11.2 сохранён 1:1 как frozen reference');
    expect(spec).toContain('Prozrachnaya_Cena_v11_2_CEO_Control_Center_MAX.xlsx');
    expect(spec).toContain('388a86ce5ddad3cee7d2322af2dab6bec7166b4dcbd4efa83bc8e57021b79256');
  });

  it('preserves all material spreadsheet control contours as server-authoritative calculations', () => {
    for (const marker of [
      'cash13w(', 'clientContractGate(', 'clientProofPass(', 'clientPnl(', 'latestForecast(', 'forecastAccuracy(',
      'monthlyCloseStatus(', 'assumptionEvidenceCount(', 'retentionSnapshot(', 'hiringGate(', 'trancheBGate', 'scaleGate',
      'FOUNDER_CONTROL_EVIDENCE_REQUIREMENTS', 'weightedPipelineMrrRub', 'observedWinRate', 'largestGroupShare',
    ]) expect(calculator).toContain(marker);
  });

  it('requires 13 explicit cash weeks and nine explicit monthly-close controls instead of one blanket switch', () => {
    expect(component).toContain('Неделя 1–13');
    expect(component).toContain('Для полноценного PASS нужны все 13 недель');
    for (const field of ['bankReconciled','arReconciled','revenueVerified','clientPnlComplete','payrollVendorsEntered','taxReserveChecked','evidenceCurrent','cashForecastRolled','forecastApproved']) {
      expect(component).toContain(`name=\"${field}\"`);
      expect(calculator).toContain(`'${field}'`);
    }
    expect(component).not.toContain('name="all" label="Все 9 контролей');
  });

  it('makes evidence multi-item, payment-backed and independently traceable', () => {
    for (const item of ['COMPANY_REGISTRATION','BANK_SIGNATORY','PAID_JOURNEY','INVOICE_SUPPORT_PROCESS','TAMBOV_REGISTRATION','TECHNOPARK_RESIDENT','QUALIFYING_ACTIVITY','PROFILE_REVENUE_70','DELIVERY_BACKUP_AGREEMENT','RESPONSIBILITY_HANDOVER','CURRENT_INFRA_INVOICES']) {
      expect(spec).toContain(`'${item}'`);
    }
    expect(calculator).toContain('paymentEvidenceRef');
    expect(calculator).toContain('lastPaidAt');
    expect(calculator).toContain('actualLaunchCostRub');
  });

  it('keeps the browser proxy bounded, csrf-protected and free of direct staff table authority', () => {
    expect(bff).toContain('requiresCanonicalControlHost(request)');
    expect(bff).toContain('assertCsrf(request)');
    expect(bff).toContain("request.cookies.get(ACCESS_COOKIE)");
    expect(bff).toContain("'Idempotency-Key'");
    expect(bff).toContain('MAX_BODY_BYTES');
    expect(bff).toContain("redirect: 'manual'");
    expect(repository).toContain('StaffAuthorityPrismaService');
    expect(repository).toContain('auth.founder_control_upsert');
    expect(repository).not.toContain('RlsTransactionService');
    expect(migration).toContain('REVOKE ALL ON auth.founder_control_records FROM pc_staff_runtime');
  });

  it('requires recent MFA in both the API service and PostgreSQL write authority', () => {
    expect(service).toContain('15 * 60 * 1000');
    expect(service).toContain('FOUNDER_CONTROL_WRITE');
    expect(migration).toContain("session.mfa_verified_at >= NOW() - INTERVAL '15 minutes'");
  });

  it('is mobile-first with touch-safe controls and single-column forms below 760px', () => {
    expect(css).toContain('@media(max-width:760px)');
    expect(css).toContain('.formGrid{grid-template-columns:1fr}');
    expect(css).toContain('touch-action:manipulation');
    expect(css).toContain('@media(max-width:420px)');
  });
});
