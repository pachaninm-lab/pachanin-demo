import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(process.cwd(), '../..');
const read = (relativePath: string) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const dataRoom = read('apps/web/app/platform-v7/data-room/page.tsx');
const grainDataRoom = read('apps/web/app/platform-v7/data-room/grain/page.tsx');
const evidencePack = read('apps/web/app/platform-v7/evidence-pack/page.tsx');
const investor = read('apps/web/app/platform-v7/investor/page.tsx');
const investorDeal = read('apps/web/app/platform-v7/investor/deals/[dealId]/page.tsx');
const reports = read('apps/web/app/platform-v7/reports/page.tsx');
const documents = read('apps/web/app/platform-v7/documents/page.tsx');
const dealWorkspace = read('apps/web/app/platform-v7/deals/[dealId]/page.tsx');
const scope = read('scripts/check-design-system-v8-pr-scope.mjs');
const migrationScope = JSON.parse(read('scripts/design-system-v8-route-migration-scope.json')) as string[];

const forbiddenPresentation = /style\s*=\s*\{\{|dangerouslySetInnerHTML|#[0-9a-f]{3,8}\b|\brgba?\s*\(|!important/i;

describe('platform-v7 data-room and investor compatibility authority', () => {
  it('routes static data-room and investor metrics to server reporting authority', () => {
    for (const page of [dataRoom, investor]) {
      expect(page).toContain("import { redirect } from 'next/navigation'");
      expect(page).toContain("redirect('/platform-v7/reports')");
      expect(page).not.toMatch(forbiddenPresentation);
    }
    for (const fixture of ['118 млн ₽', '31 сделка', 'DL-9106', 'Тамбовская область', 'InvestorYieldSimulator', 'SalesFunnelChart']) {
      expect(dataRoom).not.toContain(fixture);
      expect(investor).not.toContain(fixture);
    }
    expect(reports).toContain('getReportingRegistry');
  });

  it('routes sample evidence indexes to the canonical document workspace', () => {
    for (const page of [grainDataRoom, evidencePack]) {
      expect(page).toContain("redirect('/platform-v7/documents')");
      expect(page).not.toMatch(forbiddenPresentation);
    }
    for (const fixture of ['234 события', '18 файлов', 'DL-9113', 'DL-9120', 'SAMPLE_DEALS', 'DECISIONS']) {
      expect(grainDataRoom).not.toContain(fixture);
      expect(evidencePack).not.toContain(fixture);
    }
    expect(documents).toContain('OperationalDecisionCockpit');
  });

  it('preserves the requested Deal ID in the canonical Deal workspace', () => {
    expect(investorDeal).toContain("import { redirect } from 'next/navigation'");
    expect(investorDeal).toContain('encodeURIComponent(params.dealId)');
    expect(investorDeal).toContain('/platform-v7/deals/');
    expect(investorDeal).not.toContain('LiveDealInvestorRuntime');
    expect(investorDeal).not.toMatch(forbiddenPresentation);
    expect(dealWorkspace).toContain('params.dealId');
  });

  it('loads an exact route migration manifest without weakening scope to a wildcard', () => {
    expect(scope).toContain("import fs from 'node:fs'");
    expect(scope).toContain("new URL('./design-system-v8-route-migration-scope.json', import.meta.url)");
    expect(scope).toContain('for (const file of migrationScopeFiles) exact.add(normalize(file))');
    expect(scope).not.toContain("'apps/web/app/platform-v7/'");
    expect(new Set(migrationScope).size).toBe(migrationScope.length);
  });

  it('keeps this cluster and the exact remaining inventory inside migration scope', () => {
    for (const file of [
      'apps/web/app/platform-v7/data-room/page.tsx',
      'apps/web/app/platform-v7/data-room/grain/page.tsx',
      'apps/web/app/platform-v7/evidence-pack/page.tsx',
      'apps/web/app/platform-v7/investor/page.tsx',
      'apps/web/app/platform-v7/investor/deals/[dealId]/page.tsx',
      'apps/web/tests/unit/platformV7DataRoomInvestorCompatibility.test.ts',
      'apps/web/app/platform-v7/[...slug]/page.tsx',
      'apps/web/app/platform-v7/notifications/page.tsx',
      'apps/web/app/platform-v7/pilot-runbook/page.tsx',
      'apps/web/app/platform-v7/readiness/page.tsx',
      'apps/web/app/platform-v7/support/page.tsx',
    ]) {
      expect(migrationScope).toContain(file);
    }
  });
});
