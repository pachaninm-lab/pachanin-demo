import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(process.cwd(), '../..');
const read = (relativePath: string) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const routes = {
  admin: read('apps/web/app/platform-v7/admin/page.tsx'),
  antiBypass: read('apps/web/app/platform-v7/control-tower/anti-bypass/page.tsx'),
  bypassRisk: read('apps/web/app/platform-v7/control-tower/bypass-risk/page.tsx'),
  reconciliation: read('apps/web/app/platform-v7/control-tower/canonical-reconciliation/page.tsx'),
  hotlist: read('apps/web/app/platform-v7/control-tower/hotlist/page.tsx'),
};

describe('platform-v7 operator compatibility aliases', () => {
  it('keeps each legacy surface server-rendered and redirect-only', () => {
    for (const source of Object.values(routes)) {
      expect(source).toContain("import { redirect } from 'next/navigation'");
      expect(source).toContain('redirect(');
      expect(source).not.toContain("'use client'");
      expect(source).not.toContain('style=');
      expect(source).not.toContain('GrainWorkflowPage');
      expect(source).not.toContain('OperationalDecisionCockpit');
    }
  });

  it('routes administrative and operational duplicates through the role-aware control tower entry', () => {
    expect(routes.admin).toContain("redirect('/platform-v7/control-tower')");
    expect(routes.antiBypass).toContain("redirect('/platform-v7/control-tower')");
    expect(routes.bypassRisk).toContain("redirect('/platform-v7/control-tower')");
    expect(routes.hotlist).toContain("redirect('/platform-v7/control-tower')");
  });

  it('routes the obsolete KPI bridge to canonical server reporting', () => {
    expect(routes.reconciliation).toContain("redirect('/platform-v7/reports')");
    expect(routes.reconciliation).not.toContain('CanonicalKpiReconciliation');
  });

  it('removes fixture risk and transport hotlist facts', () => {
    const combined = Object.values(routes).join('\n');
    for (const forbidden of [
      'BYP-1',
      'BYP-2',
      'BUYER-1',
      'SELLER-1',
      'DL-9106',
      'LOT-2403',
      'getTransportHotlist',
      'SberKorusBadge',
      'static fallback',
    ]) {
      expect(combined).not.toContain(forbidden);
    }
  });
});
