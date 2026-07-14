import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(process.cwd(), '../..');
const read = (relativePath: string) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
const exists = (relativePath: string) => fs.existsSync(path.join(repoRoot, relativePath));

const page = read('apps/web/app/platform-v7/reports/page.tsx');
const reader = read('apps/web/lib/reporting-server.ts');
const routePolicy = read('apps/web/lib/platform-v7/design-system-v8-route-policy.ts');
const governance = JSON.parse(read('design-governance-v8.json'));
const forbiddenPresentation = /style\s*=\s*\{\{|dangerouslySetInnerHTML|#[0-9a-f]{3,8}\b|\brgba?\s*\(|!important/i;

describe('platform-v7 reporting authority', () => {
  it('uses the governed v8 cockpit without route-local visual overrides', () => {
    expect(page).toContain('OperationalDecisionCockpit');
    expect(page).toContain('OperationalQueueLink');
    expect(page).toContain('InlineNotice');
    expect(page).toContain('StatusChip');
    expect(page).not.toMatch(forbiddenPresentation);
  });

  it('starts from participant-scoped Deals and never simulates a regulatory submission', () => {
    expect(page).toContain('getReportingRegistry');
    expect(page).toContain('registry.available');
    expect(page).toContain('registry.deals');
    expect(page).toContain('encodeURIComponent(deal.id)');
    expect(page).toContain('notConfirmed');

    for (const forbidden of [
      'RegulatoryReportsPanel',
      'CollapsibleSection',
      'Минсельхоз · Росстат · ФГИС',
      'Сводка сделки',
      'Пакет доказательств',
      'Отчёт по сценарию',
      'setTimeout',
      "status: 'sent'",
      "status: 'generating'",
      'DL-9106',
    ]) {
      expect(page).not.toContain(forbidden);
    }
  });

  it('keeps the reporting reader authenticated, bounded and fail-closed', () => {
    expect(reader).toContain("serverApiUrl('/deals')");
    expect(reader).toContain('serverAuthHeaders()');
    expect(reader).toContain("cache: 'no-store'");
    expect(reader).toContain('UNAVAILABLE');
    expect(reader).toContain('value.slice(0, 100)');
    expect(reader).toContain('parseDeal');
    expect(reader).toContain('record.id ?? record.dealId');
    expect(reader).not.toContain('DL-');
    expect(reader).not.toContain('REPORTS');
  });

  it('states the external submission evidence boundary in RU EN and ZH', () => {
    expect(page).toContain('Платформа не считает отчёт отправленным');
    expect(page).toContain('does not treat a report as submitted');
    expect(page).toContain('不会把报告视为已提交');
    expect(page).toContain('callback и audit trail');
    expect(page).toContain('callback and audit trail');
    expect(page).toContain('回调和审计轨迹');
  });

  it('deletes the fake submission panel and runs on the minimal v8 runtime', () => {
    expect(exists('apps/web/components/platform-v7/RegulatoryReportsPanel.tsx')).toBe(false);
    expect(routePolicy).toContain("'/platform-v7/reports'");
    expect(governance.governedRoots).toContain('apps/web/lib/reporting-server.ts');
    expect(governance.migratedFiles).toContain('apps/web/app/platform-v7/reports/page.tsx');
  });
});
