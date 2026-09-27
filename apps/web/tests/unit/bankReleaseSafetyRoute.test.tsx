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
    expect(page).toContain('Проверка условий выплаты без перечисления средств в браузере');
    expect(page).toContain('Платформа не может вручную присвоить RESERVED или RELEASED');
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

  it('renders a recorded request in Russian instead of claiming bank dispatch', () => {
    expect(page).toContain("recorded: 'зафиксирован'");
  });

  it('renders a recorded request in English instead of claiming bank dispatch', () => {
    expect(page).toContain("recorded: 'recorded'");
  });

  it('renders a recorded request in Chinese instead of claiming bank dispatch', () => {
    expect(page).toContain("recorded: '已记录'");
  });

  it('labels the Russian PENDING outcome as externally unconfirmed', () => {
    expect(page).toContain("status: 'внешний исход не подтверждён'");
    expect(page).toContain("title: 'Release request зафиксирован; внешний исход не подтверждён'");
  });

  it('labels the English PENDING outcome as externally unconfirmed', () => {
    expect(page).toContain("status: 'external outcome unconfirmed'");
    expect(page).toContain("title: 'The release request is recorded; the external outcome is unknown'");
  });

  it('labels the Chinese PENDING outcome as externally unconfirmed', () => {
    expect(page).toContain("status: '外部结果尚未确认'");
    expect(page).toContain("title: '付款申请已记录；外部结果未知'");
  });

  it('does not infer dispatch, provider receipt, debit or no-debit from Russian PENDING', () => {
    expect(page).toContain('не доказывает отправку, получение банком, списание или отсутствие списания');
  });

  it('does not infer dispatch, provider receipt, debit or no-debit from English PENDING', () => {
    expect(page).toContain('does not prove dispatch, provider receipt, debit or no debit, or finality');
  });

  it('does not infer dispatch, provider receipt, debit or no-debit from Chinese PENDING', () => {
    expect(page).toContain('不能证明已发送、银行已接收、已扣款或未扣款');
  });

  it('warns in Russian against blind repeat after delay', () => {
    expect(page).toContain('Не создавай новый запрос только из-за задержки');
    expect(page).toContain('status/statement reconciliation');
  });

  it('warns in English against blind repeat after delay', () => {
    expect(page).toContain('Do not create a new request merely because of delay');
    expect(page).toContain('reconcile status/statements for the same operation identity');
  });

  it('warns in Chinese against blind repeat after delay', () => {
    expect(page).toContain('不要仅因延迟创建新申请');
    expect(page).toContain('同一 operation identity');
  });

  it('shows unpublished reconciliation as not exposed rather than waiting', () => {
    expect(page).toContain("title={copy.queue.reconciliation} detail={copy.values.notExposed} status={<StatusChip tone='warning'>{copy.values.notExposed}</StatusChip>}");
  });

  it('uses recorded wording for the release-request fact', () => {
    expect(page).toContain('projection.releaseRequested ? copy.values.recorded : copy.values.missing');
  });

  it('uses recorded wording for the release-request queue row', () => {
    expect(page).toContain('projection.releaseRequested ? copy.values.recorded : copy.values.missing');
    expect(page).not.toContain('copy.values.sent');
  });

  it('maps unresolved callback display to unknown external outcome copy', () => {
    expect(page).toContain("waiting: 'external outcome unknown'");
    expect(page).toContain("waiting: 'внешний исход неизвестен'");
    expect(page).toContain("waiting: '外部结果未知'");
  });

  it('removes the previous English negative-finality assertion', () => {
    expect(page).not.toContain('Funds are not released yet.');
    expect(page).not.toContain('handed to the external contour');
  });

  it('removes the previous Russian and Chinese dispatch claims', () => {
    expect(page).not.toContain('Release request зафиксирован и передан во внешний контур');
    expect(page).not.toContain('付款申请已持久化并交给外部银行流程');
  });

  it('preserves confirmed RELEASED semantics and the existing server state model', () => {
    expect(page).toContain("released: { status: 'выплата подтверждена банком'");
    expect(page).toContain("released: { status: 'payout confirmed by bank'");
    expect(page).toContain("released: { status: '银行已确认付款'");
    expect(page).toContain("projection.state === 'released'");
    expect(authority).toContain("state = 'awaiting_bank'");
    expect(authority).toContain("state = 'released'");
  });

});
