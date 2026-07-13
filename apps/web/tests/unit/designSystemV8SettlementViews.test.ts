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

describe('Design System v8 money and settlement views', () => {
  const moneyPath = 'apps/web/app/platform-v7/money/page.tsx';
  const releasePath = 'apps/web/app/platform-v7/bank/release-safety/page.tsx';
  const money = read(moneyPath);
  const release = read(releasePath);
  const cockpit = read('apps/web/components/transaction-ux/MoneyObligationCockpit.tsx');
  const governance = JSON.parse(read('design-governance-v8.json')) as { migratedFiles: string[] };
  const workflow = read('.github/workflows/design-system-v8.yml');

  it('removes fixture money authority and hard-coded deal amounts', () => {
    for (const source of [money, release]) {
      expect(source).not.toContain("@/lib/v7r/data");
      expect(source).not.toContain('canonicalDomainDeals');
      expect(source).not.toContain('DL-9106');
      expect(source).not.toContain('DL-9102');
      expect(source).not.toContain('moneyRows');
      expect(source).not.toContain('evaluateReleaseGuard');
    }
  });

  it('uses participant-scoped Deals as the only money entry point', () => {
    expect(money).toContain('<CanonicalDealsList />');
    expect(release).toContain('<CanonicalDealsList />');
    expect(money).toContain("href='/platform-v7/deals'");
    expect(release).toContain("href='/platform-v7/deals'");
    expect(money).toContain("testId='platform-v7-money-v8'");
    expect(release).toContain("testId='platform-v7-bank-release-safety-v8'");
  });

  it('keeps reserve hold request callback and reconciliation as distinct states', () => {
    expect(money).toContain('запрос ≠ подтверждение');
    expect(money).toContain('спорная сумма не смешивается');
    expect(money).toContain('outbox');
    expect(money).toContain('reconciliation');
    expect(release).toContain('release request → callback → reconciliation → audit');
    expect(release).toContain('does not set money to RELEASED');
    expect(release).toContain('manual review');
  });

  it('keeps verified bank callback as the only confirmation boundary', () => {
    expect(money).toContain('verified bank callback');
    expect(release).toContain('verified bank callback');
    expect(release).toContain('Платформа не может вручную присвоить RESERVED или RELEASED');
    expect(release).toContain('平台不能手动设置 RESERVED 或 RELEASED');
    expect(money).not.toContain('confirmWorksheet');
    expect(release).not.toContain('confirmWorksheet');
  });

  it('ships RU EN ZH copy and localized money cockpit meta labels', () => {
    for (const source of [money, release]) {
      expect(source).toContain("type Locale = 'ru' | 'en' | 'zh'");
      expect(source).toContain('getLocale');
      expect(source).toContain('labels={copy.labels}');
    }
    expect(money).toContain('Money belongs to a Deal');
    expect(money).toContain('资金属于具体交易');
    expect(release).toContain('Payout readiness is not a release button');
    expect(release).toContain('付款就绪检查不是放款按钮');
    expect(cockpit).toContain('MoneyCockpitLabels');
    expect(cockpit).toContain('const copy = { ...DEFAULT_LABELS, ...labels }');
    expect(cockpit).toContain('aria-label={copy.prioritySection}');
    expect(cockpit).toContain('aria-label={copy.factsSection}');
  });

  it('contains no route-local presentation bypasses', () => {
    expect(money).not.toMatch(forbiddenPresentation);
    expect(release).not.toMatch(forbiddenPresentation);
    expect(money).toContain('MoneyObligationCockpit');
    expect(release).toContain('MoneyObligationCockpit');
  });

  it('is enforced by governance and exact v8 regressions', () => {
    expect(governance.migratedFiles).toContain(moneyPath);
    expect(governance.migratedFiles).toContain(releasePath);
    expect(workflow).toContain('apps/web/app/platform-v7/money/page.tsx');
    expect(workflow).toContain('apps/web/app/platform-v7/bank/release-safety/page.tsx');
    expect(workflow).toContain('tests/unit/designSystemV8SettlementViews.test.ts');
    expect(workflow).toContain('tests/unit/platformV7Dl9106ReleaseReviewPageCurrentMain.test.tsx');
  });
});
