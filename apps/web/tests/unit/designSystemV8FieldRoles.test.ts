import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const cwd = process.cwd();
const repoRoot = [cwd, path.resolve(cwd, '../..')].find((candidate) => fs.existsSync(path.join(candidate, 'design-governance-v8.json')));
if (!repoRoot) throw new Error(`Cannot resolve repository root from ${cwd}`);
const read = (relativePath: string) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
const fieldRolePages = [
  'apps/web/app/platform-v7/driver/field/page.tsx',
  'apps/web/app/platform-v7/elevator/page.tsx',
  'apps/web/app/platform-v7/lab/page.tsx',
  'apps/web/app/platform-v7/surveyor/page.tsx',
];

describe('Design System v8 field-role migration', () => {
  it('migrates four field roles to reusable transaction templates', () => {
    for (const page of fieldRolePages) {
      const source = read(page);
      expect(source).toContain("from '@pc/design-system-v8'");
      expect(source).toContain("@/components/transaction-ux/FieldTaskTemplate");
      expect(source).not.toContain('dangerouslySetInnerHTML');
      expect(source).not.toMatch(/\bstyle\s*=\s*\{\{/);
      expect(source).not.toContain('/platform-v7/bank');
      expect(source).not.toContain('/platform-v7/investor');
      expect(source).not.toContain('/platform-v7/control-tower');
    }
  });

  it('provides Field Task and Intake Workbench reusable templates', () => {
    const template = read('apps/web/components/transaction-ux/FieldTaskTemplate.tsx');
    expect(template).toContain('export function FieldTaskTemplate');
    expect(template).toContain('export function IntakeWorkbenchTemplate');
    expect(template).toContain('export function KeyFactGrid');
    expect(template).toContain('export function KeyFact');
  });

  it('registers all migrated field surfaces in governance', () => {
    const governance = JSON.parse(read('design-governance-v8.json'));
    for (const page of fieldRolePages) expect(governance.migratedFiles).toContain(page);
  });
});
