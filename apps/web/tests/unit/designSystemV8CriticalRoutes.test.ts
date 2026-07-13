import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const cwd = process.cwd();
const repoRoot = [cwd, path.resolve(cwd, '../..')]
  .find((candidate) => fs.existsSync(path.join(candidate, 'design-governance-v8.json')));

if (!repoRoot) throw new Error(`Cannot resolve repository root from ${cwd}`);

const read = (relativePath: string) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
const forbiddenPresentation = /style\s*=\s*\{\{|dangerouslySetInnerHTML|#[0-9a-f]{3,8}\b|\brgba?\s*\(|!important|var\(--pc-/i;

const documents = read('apps/web/app/platform-v7/documents/page.tsx');
const disputes = read('apps/web/app/platform-v7/disputes/page.tsx');
const releaseSafety = read('apps/web/app/platform-v7/bank/release-safety/page.tsx');
const governance = JSON.parse(read('design-governance-v8.json')) as { migratedFiles: string[] };

describe('Design System v8 critical transaction routes', () => {
  it('keeps documents inside the Deal and external-authority boundary', () => {
    expect(documents).toContain('OperationalDecisionCockpit');
    expect(documents).toContain('DocumentsMatrix');
    expect(documents).toContain('DocumentsMatrixActions');
    expect(documents).toContain('DocumentReadinessMiniMatrix');
    expect(documents).toContain('DocumentsTree');
    expect(documents).toContain('не подменяет ФГИС');
    expect(documents).toContain('does not replace public registries');
    expect(documents).toContain('不替代政府登记');
    expect(documents).not.toMatch(forbiddenPresentation);
  });

  it('uses server disputes and preserves evidence and arbitration tools', () => {
    expect(disputes).toContain('await getDisputes()');
    expect(disputes).toContain('disputeTotalHeldRub');
    expect(disputes).toContain('openDisputeCount');
    expect(disputes).toContain('EvidenceDecisionPanel');
    expect(disputes).toContain('EvidenceReadinessMiniMatrix');
    expect(disputes).toContain('DecisionRecommendationStrip');
    expect(disputes).toContain('DecisionPackMiniPanel');
    expect(disputes).toContain('ActionFeedbackPreviewStrip');
    expect(disputes).not.toContain("grain-execution/mock-data");
    expect(disputes).not.toContain('staticDisputes');
    expect(disputes).toContain('A dispute explains why money is held');
    expect(disputes).toContain('争议说明资金为何被冻结');
    expect(disputes).not.toMatch(forbiddenPresentation);
  });

  it('keeps bank release review read-only and callback-authoritative', () => {
    expect(releaseSafety).toContain('MoneyObligationCockpit');
    expect(releaseSafety).toContain('evaluateReleaseGuard');
    expect(releaseSafety).toContain('ReleasePipelineStrip');
    expect(releaseSafety).toContain('P7ExecutionMachineReadOnlyStrip');
    expect(releaseSafety).toContain('Only the bank confirms reserve, review and movement of money');
    expect(releaseSafety).toContain('只有银行可以确认预留、审核和资金流动');
    expect(releaseSafety).toContain('ручная кнопка не заменяет callback и reconciliation');
    expect(releaseSafety).not.toMatch(/fetch\s*\(|POST|PUT|PATCH|DELETE|requestRelease|confirmRelease|releaseFunds/i);
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
