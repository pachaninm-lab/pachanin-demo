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

describe('BankReleaseSafetyPage', () => {
  const page = read('apps/web/app/platform-v7/bank/release-safety/page.tsx');
  const authority = read('apps/web/lib/bank-release-server.ts');

  it('presents payout readiness as a verification flow, not a payment mechanism', () => {
    expect(page).toContain('Проверка выплаты не является кнопкой выпуска денег');
    expect(page).toContain('Payout readiness is not a release button');
    expect(page).toContain('付款就绪检查不是放款按钮');
    expect(page).toContain('MoneyObligationCockpit');
  });

  it('opens a selected Deal only through the authenticated canonical workspace', () => {
    expect(page).toContain('getCanonicalBankReleaseWorkspace');
    expect(page).toContain('buildBankReleaseProjection');
    expect(page).toContain('searchParams?: Promise<PageSearchParams>');
    expect(page).toContain('if (!dealId) return renderRegistry(locale)');
    expect(authority).toContain("serverApiUrl(`/deals/${encodeURIComponent(dealId)}/workspace`)");
    expect(authority).toContain('await serverAuthHeaders()');
    expect(authority).toContain("cache: 'no-store'");
    expect(authority).toContain("import { REQUIRED_RELEASE_DOCUMENT_TYPES } from './deal-execution-server'");
  });

  it('checks integer-minor-unit money, reserve, documents, dispute, bank operation and outbox facts', () => {
    expect(authority).toContain('totalKopecks');
    expect(authority).toContain('PAYMENT_AMOUNT_MISMATCH');
    expect(authority).toContain('RESERVE_NOT_CONFIRMED');
    expect(authority).toContain('OPEN_DISPUTE');
    expect(authority).toContain('ACTIVE_MONEY_HOLD');
    expect(authority).toContain("latestOperation(workspace.deal.bankOperations, 'RELEASE')");
    expect(authority).toContain("latestOutbox(workspace.outbox, 'BANK_RELEASE_REQUEST')");
    expect(authority).toContain('RELEASE_OUTBOX_REQUIRES_MANUAL_REVIEW');
    expect(page).toContain('formatKopecks(projection.amountKopecks, projection.currency)');
  });

  it('distinguishes a request from bank-confirmed money movement and reconciliation', () => {
    expect(page).toContain('release request → callback → reconciliation → audit');
    expect(page).toContain('создаёт outbox-запись, но не меняет деньги на RELEASED');
    expect(page).toContain('verified bank callback');
    expect(page).toContain('manual review');
    expect(authority).toContain("state = 'awaiting_bank'");
    expect(authority).toContain("state = 'released'");
    expect(authority).toContain('RECONCILIATION_RESULT_NOT_EXPOSED_IN_DEAL_WORKSPACE');
  });

  it('is read-only and never falls back to legacy or fixture money authority', () => {
    for (const source of [page, authority]) {
      expect(source).not.toContain('canonicalDomainDeals');
      expect(source).not.toContain('evaluateReleaseGuard');
      expect(source).not.toContain('DL-9106');
      expect(source).not.toContain('confirmWorksheet');
      expect(source).not.toContain('releasePayment');
      expect(source).not.toContain('getSettlementWorksheet');
      expect(source).not.toContain('settlement-runtime');
      expect(source).not.toMatch(/method\s*:\s*['"](?:POST|PUT|PATCH|DELETE)['"]/i);
    }
  });
});
