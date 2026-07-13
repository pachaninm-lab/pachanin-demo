import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const cwd = process.cwd();
const repoRoot = [cwd, path.resolve(cwd, '../..')]
  .find((candidate) => fs.existsSync(path.join(candidate, 'design-governance-v8.json')));

if (!repoRoot) throw new Error(`Cannot resolve repository root from ${cwd}`);

const read = (relativePath: string) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const rolePages = [
  'apps/web/app/platform-v7/seller/page.tsx',
  'apps/web/app/platform-v7/buyer/page.tsx',
  'apps/web/app/platform-v7/bank/page.tsx',
];

describe('Design System v8 commercial-role migration', () => {
  it('migrates Seller Buyer and Bank to one reusable deal-role workbench', () => {
    for (const page of rolePages) {
      const source = read(page);
      expect(source).toContain("from '@pc/design-system-v8'");
      expect(source).toContain('@/components/transaction-ux/DealRoleWorkbenchTemplate');
      expect(source.match(/<NextActionCard/g)?.length).toBe(1);
      expect(source).not.toContain('dangerouslySetInnerHTML');
      expect(source).not.toMatch(/\bstyle\s*=\s*\{\{/);
      expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b|\brgba?\s*\(/);
    }
  });

  it('keeps bank authority boundaries explicit in all three roles', () => {
    const seller = read(rolePages[0]);
    const buyer = read(rolePages[1]);
    const bank = read(rolePages[2]);
    expect(seller).toContain('решение по деньгам принимает банк');
    expect(buyer).toContain('платформа не выпускает деньги');
    expect(bank).toContain('Платформа не подтверждает выплату и не выпускает деньги');
  });

  it('preserves role-specific execution evidence behind progressive disclosure', () => {
    const seller = read(rolePages[0]);
    const buyer = read(rolePages[1]);
    const bank = read(rolePages[2]);
    expect(seller).toContain('SellerInlineLotEditor');
    expect(seller).toContain('DocumentReadinessMiniMatrix');
    expect(buyer).toContain('WorkflowActionPanel');
    expect(buyer).toContain('MoneyImpactSummaryStrip');
    expect(bank).toContain('BankCleanView');
    expect(bank).toContain('LedgerPanel');
  });

  it('registers the three migrated pages in governance', () => {
    const governance = JSON.parse(read('design-governance-v8.json'));
    for (const page of rolePages) expect(governance.migratedFiles).toContain(page);
  });

  it('uses comfortable density and token-only shared styles', () => {
    const template = read('apps/web/components/transaction-ux/DealRoleWorkbenchTemplate.tsx');
    const styles = read('apps/web/components/transaction-ux/CommercialRoleWorkspace.module.css');
    expect(template).toContain("data-density='comfortable'");
    expect(styles).toContain('var(--ds-control-height)');
    expect(styles).not.toMatch(/#[0-9a-fA-F]{3,8}\b|\brgba?\s*\(/);
  });
});
