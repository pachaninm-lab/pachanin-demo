import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const cwd = process.cwd();
const root = [cwd, path.resolve(cwd, '../..')]
  .find((candidate) => fs.existsSync(path.join(candidate, 'design-governance-v8.json')));

if (!root) throw new Error(`Cannot resolve repository root from ${cwd}`);

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

const forbiddenPresentation = /style\s*=\s*\{\{|dangerouslySetInnerHTML|#[0-9a-f]{3,8}\b|\brgba?\s*\(|!important|var\(--pc-/i;

describe('Design System v8 documents readiness route', () => {
  const pagePath = 'apps/web/app/platform-v7/documents/page.tsx';
  const page = read(pagePath);
  const cockpit = read('apps/web/components/transaction-ux/OperationalDecisionCockpit.tsx');
  const governance = JSON.parse(read('design-governance-v8.json')) as { migratedFiles: string[] };
  const workflow = read('.github/workflows/design-system-v8.yml');

  it('removes synthetic document scenarios and the fake global archive', () => {
    expect(page).not.toContain('getDeal360Scenario');
    expect(page).not.toContain('buildDemoDocumentTree');
    expect(page).not.toContain('DocumentsTree');
    expect(page).not.toContain('DL-9106');
    expect(page).not.toContain('DL-9102');
    expect(page).not.toContain('requiredDocuments');
    expect(page).not.toContain('documentSummary');
  });

  it('uses the participant-scoped canonical Deal registry as the only entry point', () => {
    expect(page).toContain('<CanonicalDealsList />');
    expect(page).toContain("href='/platform-v7/deals'");
    expect(page).toContain("href='/platform-v7/bank/release-safety'");
    expect(page).toContain("testId='platform-v7-documents-v8'");
    expect(page).toContain('доступ определяет сервер');
    expect(page).toContain('access is server-owned');
    expect(page).toContain('访问权限由服务器决定');
  });

  it('keeps external document and bank confirmation fail-closed', () => {
    expect(page).toContain('Платформа не подменяет их локальной отметкой');
    expect(page).toContain('the interface cannot release funds');
    expect(page).toContain('界面不能自行放款');
    expect(page).toContain('ФГИС');
    expect(page).toContain('ГИС ЭПД');
    expect(page).toContain('КЭП');
  });

  it('ships complete RU EN ZH copy and localized cockpit labels', () => {
    expect(page).toContain("type Locale = 'ru' | 'en' | 'zh'");
    expect(page).toContain('getLocale');
    expect(page).toContain('Документы существуют только внутри Сделки');
    expect(page).toContain('Documents exist only inside a Deal');
    expect(page).toContain('文件只能存在于具体交易中');
    expect(page).toContain('labels={copy.labels}');
    expect(cockpit).toContain('OperationalCockpitLabels');
    expect(cockpit).toContain('const copy = { ...DEFAULT_LABELS, ...labels }');
    expect(cockpit).toContain('aria-label={copy.prioritySection}');
    expect(cockpit).toContain('aria-label={copy.factsSection}');
  });

  it('contains no route-local presentation bypasses', () => {
    expect(page).not.toMatch(forbiddenPresentation);
    expect(page).toContain('OperationalDecisionCockpit');
    expect(page).toContain('InlineNotice');
    expect(page).toContain('operationalCockpitClasses.primaryLink');
  });

  it('is enforced by governance and the exact v8 regression gate', () => {
    expect(governance.migratedFiles).toContain(pagePath);
    expect(workflow).toContain('apps/web/app/platform-v7/documents/page.tsx');
    expect(workflow).toContain('tests/unit/designSystemV8DocumentsRoute.test.ts');
  });
});
