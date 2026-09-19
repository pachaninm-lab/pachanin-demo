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
  const releaseAuthorityPath = 'apps/web/lib/bank-release-server.ts';
  const money = read(moneyPath);
  const release = read(releasePath);
  const releaseAuthority = read(releaseAuthorityPath);
  const cockpit = read('apps/web/components/transaction-ux/MoneyObligationCockpit.tsx');
  const governance = JSON.parse(read('design-governance-v8.json')) as { migratedFiles: string[] };
  const workflow = read('.github/workflows/design-system-v8.yml');

  it('removes fixture money authority and hard-coded deal amounts', () => {
    for (const source of [money, release, releaseAuthority]) {
      expect(source).not.toContain("@/lib/v7r/data");
      expect(source).not.toContain('canonicalDomainDeals');
      expect(source).not.toContain('DL-9106');
      expect(source).not.toContain('DL-9102');
      expect(source).not.toContain('moneyRows');
      expect(source).not.toContain('evaluateReleaseGuard');
      expect(source).not.toContain('settlement-runtime');
      expect(source).not.toContain('getSettlementWorksheet');
    }
  });

  it('uses participant-scoped Deals as the entry point and canonical Deal authority after selection', () => {
    expect(money).toContain('<CanonicalDealsList />');
    expect(release).toContain('<CanonicalDealsList />');
    expect(money).toContain("href='/platform-v7/deals'");
    expect(release).toContain("href='/platform-v7/deals'");
    expect(release).toContain('getCanonicalBankReleaseWorkspace');
    expect(release).toContain('buildBankReleaseProjection');
    expect(releaseAuthority).toContain("serverApiUrl(`/deals/${encodeURIComponent(dealId)}/workspace`)");
    expect(releaseAuthority).toContain('serverAuthHeaders()');
    expect(releaseAuthority).toContain("cache: 'no-store'");
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
    expect(releaseAuthority).toContain("state = 'ready_to_request'");
    expect(releaseAuthority).toContain("state = 'awaiting_bank'");
    expect(releaseAuthority).toContain("state = 'released'");
    expect(releaseAuthority).toContain("state = 'manual_review'");
    expect(releaseAuthority).toContain('RECONCILIATION_RESULT_NOT_EXPOSED_IN_DEAL_WORKSPACE');
  });

  it('keeps verified bank callback as the only confirmation boundary', () => {
    expect(money).toContain('verified bank callback');
    expect(release).toContain('verified bank callback');
    expect(release).toContain('Платформа не может вручную присвоить RESERVED или RELEASED');
    expect(release).toContain('平台不能手动设置 RESERVED 或 RELEASED');
    expect(releaseAuthority).toContain("payment.callbackState === 'CONFIRMED'");
    expect(releaseAuthority).toContain("releaseOperation.status === 'DONE'");
    expect(releaseAuthority).toContain("releaseOutbox?.status === 'CONFIRMED'");
    expect(money).not.toContain('confirmWorksheet');
    expect(release).not.toContain('confirmWorksheet');
  });

  it('uses integer minor units and fails closed on contradictory money facts', () => {
    expect(releaseAuthority).toContain('totalKopecks');
    expect(releaseAuthority).toContain('amountKopecks');
    expect(releaseAuthority).not.toContain('amountRub');
    expect(releaseAuthority).toContain('PAYMENT_AMOUNT_MISMATCH');
    expect(releaseAuthority).toContain('OPEN_DISPUTE');
    expect(releaseAuthority).toContain('ACTIVE_MONEY_HOLD');
    expect(releaseAuthority).toContain('RELEASE_STATE_CONTRADICTION');
    expect(release).toContain('formatKopecks');
  });

  it('ships RU EN ZH copy and localized money cockpit meta labels', () => {
    for (const source of [money, release]) {
      expect(source).toContain("type Locale = 'ru' | 'en' | 'zh'");
      expect(source).toContain('getLocale');
      expect(source).toContain('labels={');
    }
    expect(money).toContain('Money belongs to a Deal');
    expect(money).toContain('资金属于具体交易');
    expect(release).toContain('Payout readiness is not a release button');
    expect(release).toContain('付款就绪检查不是放款按钮');
    expect(release).toContain('Server payout review is unavailable');
    expect(release).toContain('服务器付款检查不可用');
    expect(cockpit).toContain('MoneyCockpitLabels');
    expect(cockpit).toContain('const copy = { ...DEFAULT_LABELS, ...labels }');
    expect(cockpit).toContain('aria-label={copy.prioritySection}');
    expect(cockpit).toContain('aria-label={copy.factsSection}');
  });

  it('contains no route-local presentation or mutation bypasses', () => {
    expect(money).not.toMatch(forbiddenPresentation);
    expect(release).not.toMatch(forbiddenPresentation);
    expect(money).toContain('MoneyObligationCockpit');
    expect(release).toContain('MoneyObligationCockpit');
    expect(releaseAuthority).not.toMatch(/method\s*:\s*['"](?:POST|PUT|PATCH|DELETE)['"]/i);
  });

  it('is enforced by governance and exact v8 regressions', () => {
    expect(governance.migratedFiles).toContain(moneyPath);
    expect(governance.migratedFiles).toContain(releasePath);
    expect(workflow).toContain('apps/web/app/platform-v7/money/page.tsx');
    expect(workflow).toContain('apps/web/app/platform-v7/bank/release-safety/page.tsx');
    expect(workflow).toContain('apps/web/lib/bank-release-server.ts');
    expect(workflow).toContain('tests/unit/bankReleaseServer.test.ts');
    expect(workflow).toContain('tests/unit/designSystemV8SettlementViews.test.ts');
    expect(workflow).toContain('tests/unit/platformV7Dl9106ReleaseReviewPageCurrentMain.test.tsx');
  });
});
