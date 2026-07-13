import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const cwd = process.cwd();
const root = [cwd, path.resolve(cwd, '../..')]
  .find((candidate) => fs.existsSync(path.join(candidate, 'design-governance-v8.json')));

if (!root) throw new Error(`Cannot resolve repository root from ${cwd}`);

const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const forbiddenPresentation = /style\s*=\s*\{\{|dangerouslySetInnerHTML|#[0-9a-f]{3,8}\b|\brgba?\s*\(|!important|var\(--pc-/i;
const releaseMutation = /fetch\s*\(|method\s*:\s*['"](?:POST|PUT|PATCH|DELETE)['"]|requestRelease\s*\(|confirmRelease\s*\(|releaseFunds\s*\(/i;

const disputesPath = 'apps/web/app/platform-v7/disputes/page.tsx';
const releasePath = 'apps/web/app/platform-v7/bank/release-safety/page.tsx';
const moneyCockpitPath = 'apps/web/components/transaction-ux/MoneyObligationCockpit.tsx';
const disputes = read(disputesPath);
const releaseSafety = read(releasePath);
const moneyCockpit = read(moneyCockpitPath);
const governance = JSON.parse(read('design-governance-v8.json')) as { migratedFiles: string[] };
const workflow = read('.github/workflows/design-system-v8.yml');

describe('Design System v8 dispute and bank release routes', () => {
  it('builds the dispute queue from server data without scenario mock authority', () => {
    expect(disputes).toContain('await getDisputes()');
    expect(disputes).toContain('disputeTotalHeldRub');
    expect(disputes).toContain('openDisputeCount');
    expect(disputes).toContain('sortActiveDisputes');
    expect(disputes).not.toContain('grain-execution/mock-data');
    expect(disputes).not.toContain('staticDisputes');
    expect(disputes).not.toContain("?? 'DL-9102'");
    expect(disputes).not.toContain("?? 'DL-9106'");
  });

  it('keeps fallback dispute rows explicit and non-authoritative', () => {
    expect(disputes).toContain('server споров недоступен');
    expect(disputes).toContain('fallback data, not a decision basis');
    expect(disputes).toContain('备用数据，不能作为裁决依据');
    expect(disputes).toContain('cannot be used as a legal or monetary basis');
  });

  it('keeps evidence and decision tools under progressive disclosure', () => {
    expect(disputes).toContain('OperationalDecisionCockpit');
    expect(disputes).toContain('EvidenceStrengthMeter');
    expect(disputes).toContain('EvidenceReadinessMiniMatrix');
    expect(disputes).toContain('EvidenceDecisionPanel');
    expect(disputes).toContain('DecisionRecommendationStrip');
    expect(disputes).toContain('ActionFeedbackPreviewStrip');
    expect(disputes).toContain('labels={copy.labels}');
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
    expect(releaseSafety).toContain('calculated projection of Deal conditions');
    expect(releaseSafety).not.toMatch(releaseMutation);
    expect(releaseSafety).not.toMatch(forbiddenPresentation);
    expect(releaseSafety).not.toContain("?? 'DL-9106'");
  });

  it('localizes the shared Money Obligation Cockpit without breaking defaults', () => {
    expect(moneyCockpit).toContain('export type MoneyCockpitLabels');
    expect(moneyCockpit).toContain('const copy = { ...DEFAULT_LABELS, ...labels }');
    expect(moneyCockpit).toContain('aria-label={copy.prioritySection}');
    expect(moneyCockpit).toContain('aria-label={copy.factsSection}');
    expect(releaseSafety).toContain('labels={copy.labels}');
  });

  it('enforces both routes in governance and exact regression CI', () => {
    expect(governance.migratedFiles).toEqual(expect.arrayContaining([disputesPath, releasePath]));
    expect(workflow).toContain(disputesPath);
    expect(workflow).toContain(releasePath);
    expect(workflow).toContain('tests/unit/designSystemV8DisputesBankRelease.test.ts');
  });
});
