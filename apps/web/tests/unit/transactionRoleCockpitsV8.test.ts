import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const cwd = process.cwd();
const repoRoot = [cwd, path.resolve(cwd, '../..')]
  .find((candidate) => fs.existsSync(path.join(candidate, 'design-governance-v8.json')));

if (!repoRoot) throw new Error(`Cannot resolve repository root from ${cwd}`);

const read = (relativePath: string) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const dashboard = read('apps/web/components/platform-v7/RoleIntentDashboard.tsx');
const dashboardCss = read('apps/web/components/platform-v7/RoleIntentDashboard.module.css');
const protectedShell = read('apps/web/components/platform-v7/PlatformV7ProtectedShell.tsx');
const governance = JSON.parse(read('design-governance-v8.json')) as { governedRoots: string[] };

const roleRoots = [
  '/platform-v7/control-tower',
  '/platform-v7/buyer',
  '/platform-v7/seller',
  '/platform-v7/logistics',
  '/platform-v7/driver',
  '/platform-v7/surveyor',
  '/platform-v7/elevator',
  '/platform-v7/lab',
  '/platform-v7/bank',
  '/platform-v7/compliance',
  '/platform-v7/arbitrator',
  '/platform-v7/executive',
];

const forbiddenPresentation = /style\s*=\s*\{\{|dangerouslySetInnerHTML|#[0-9a-f]{3,8}\b|\brgba?\s*\(|!important|var\(--pc-/i;

describe('Transaction UX v8 shared role cockpit', () => {
  it('uses one task-first cockpit for all twelve role roots', () => {
    expect(roleRoots).toHaveLength(12);
    expect(new Set(roleRoots).size).toBe(12);
    for (const route of roleRoots) expect(protectedShell).toContain(route);
    expect(protectedShell).toContain(': <RoleIntentDashboard role={verifiedRole} fallback={children} />');
    expect(dashboard).toContain("data-transaction-role-cockpit='v8'");
  });

  it('keeps participant-scoped server data as the only dashboard input', () => {
    expect(dashboard).toContain('/api/proxy/deals/accessible?');
    expect(dashboard).toContain("cache: 'no-store'");
    expect(dashboard).toContain('validDealsPage(payload)');
    expect(dashboard).toContain('requestId !== requestRef.current');
    expect(dashboard).toContain('<CanonicalDealWorkspace role={role} dealId={current.id} />');
    expect(dashboard).not.toContain('localStorage');
    expect(dashboard).not.toContain('DEAL-INDUSTRIAL-001');
  });

  it('uses Design System v8 primitives without legacy visual escape hatches', () => {
    for (const primitive of ['Button', 'InlineNotice', 'StatusChip', 'Surface']) {
      expect(dashboard).toContain(primitive);
    }
    expect(dashboard).not.toMatch(forbiddenPresentation);
    expect(dashboardCss).not.toMatch(forbiddenPresentation);
    expect(dashboardCss).toContain('var(--ds-color');
    expect(dashboardCss).toContain('@media (prefers-reduced-motion: reduce)');
    expect(dashboardCss).toContain('@media (forced-colors: active)');
  });

  it('ships explicit RU EN ZH copy without DOM translation', () => {
    expect(dashboard).toContain("type Locale = 'ru' | 'en' | 'zh'");
    expect(dashboard).toContain("import { useLocale } from 'next-intl'");
    expect(dashboard).toContain('Собираем задачи на сегодня');
    expect(dashboard).toContain('Preparing today’s tasks');
    expect(dashboard).toContain('正在整理今日任务');
    expect(dashboard).toContain('data-locale={locale}');
  });

  it('keeps both role cockpit files inside the enforced governance boundary', () => {
    expect(governance.governedRoots).toContain('apps/web/components/platform-v7/RoleIntentDashboard.tsx');
    expect(governance.governedRoots).toContain('apps/web/components/platform-v7/RoleIntentDashboard.module.css');
  });
});
