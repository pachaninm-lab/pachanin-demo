import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const cwd = process.cwd();
const repoRoot = [cwd, path.resolve(cwd, '../..')]
  .find((candidate) => fs.existsSync(path.join(candidate, 'design-governance-v8.json')));

if (!repoRoot) throw new Error(`Cannot resolve repository root from ${cwd}`);

const read = (relativePath: string) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
const forbiddenPresentation = /style\s*=\s*\{\{|dangerouslySetInnerHTML|#[0-9a-f]{3,8}\b|\brgba?\s*\(|!important|var\(--pc-/i;
const releaseMutation = /fetch\s*\(|method\s*:\s*['"](?:POST|PUT|PATCH|DELETE)['"]|requestRelease\s*\(|confirmRelease\s*\(|releaseFunds\s*\(/i;

const documents = read('apps/web/app/platform-v7/documents/page.tsx');
const disputes = read('apps/web/app/platform-v7/disputes/page.tsx');
const releaseSafety = read('apps/web/app/platform-v7/bank/release-safety/page.tsx');
const designSystemIndex = read('packages/design-system-v8/src/index.ts');
const governance = JSON.parse(read('design-governance-v8.json')) as { migratedFiles: string[] };

describe('Design System v8 critical transaction routes', () => {
  it('keeps documents participant-scoped and Deal-authoritative', () => {
    expect(documents).toContain('CanonicalDealsList');
    expect(documents).toContain('OperationalDecisionCockpit');
    expect(documents).toContain('server-authorized Deals');
    expect(documents).toContain('服务器确认可访问的交易');
    expect(documents).not.toContain('buildDemoDocumentTree');
    expect(documents).not.toContain('getDeal360Scenario');
    expect(documents).not.toMatch(forbiddenPresentation);
  });

  it('uses server disputes and preserves evidence and arbitration tools', () => {
    expect(disputes).toContain('await getDisputes()');
    expect(disputes).toContain('disputeTotalHeldRub');
    expect(disputes).toContain('openDisputeCount');
    expect(disputes).toContain('sortActiveDisputes');
    expect(disputes).toContain('EvidenceDecisionPanel');
    expect(disputes).toContain('EvidenceReadinessMiniMatrix');
    expect(disputes).toContain('DecisionRecommendationStrip');
    expect(disputes).toContain('ActionFeedbackPreviewStrip');
    expect(disputes).not.toContain("grain-execution/mock-data");
    expect(disputes).not.toContain('staticDisputes');
    expect(disputes).not.toContain("?? 'DL-9102'");
    expect(disputes).not.toContain("?? 'DL-9106'");
    expect(disputes).toContain('A dispute explains why money is held');
    expect(disputes).toContain('争议说明资金为何被冻结');
    expect(disputes).not.toMatch(forbiddenPresentation);
  });

  it('marks dispute fallback data as non-authoritative in all languages', () => {
    expect(disputes).toContain('Резервные строки показаны только для устойчивости интерфейса');
    expect(disputes).toContain('cannot be used as a legal or monetary basis');
    expect(disputes).toContain('不能作为法律或资金依据');
    expect(disputes).toContain('labels={copy.labels}');
    expect(disputes).toContain("import { EmptyState } from '@pc/design-system-v8'");
    expect(designSystemIndex).toContain("export { EmptyState } from './EmptyState'");
  });

  it('keeps bank release review server-selected, read-only and callback-authoritative', () => {
    expect(releaseSafety).toContain('MoneyObligationCockpit');
    expect(releaseSafety).toContain('CanonicalDealsList');
    expect(releaseSafety).toContain('verified bank callback');
    expect(releaseSafety).toContain('Payout readiness is not a release button');
    expect(releaseSafety).toContain('付款就绪检查不是放款按钮');
    expect(releaseSafety).not.toContain('canonicalDomainDeals');
    expect(releaseSafety).not.toContain('evaluateReleaseGuard');
    expect(releaseSafety).not.toContain('DL-9106');
    expect(releaseSafety).not.toMatch(releaseMutation);
    expect(releaseSafety).not.toMatch(forbiddenPresentation);
  });

  it('registers all critical routes in v8 governance', () => {
    expect(governance.migratedFiles).toEqual(expect.arrayContaining([
      'apps/web/app/platform-v7/documents/page.tsx',
      'apps/web/app/platform-v7/disputes/page.tsx',
      'apps/web/app/platform-v7/bank/release-safety/page.tsx',
    ]));
  });
});
