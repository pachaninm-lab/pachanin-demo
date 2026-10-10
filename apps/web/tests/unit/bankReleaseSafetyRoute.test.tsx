import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BankReleaseProjection } from '../../lib/bank-release-server';

const pageBoundary = {
  locale: vi.fn(),
  workspace: vi.fn(),
  projection: vi.fn(),
};

// Execute the actual page and cockpit source with explicit boundary doubles.
// Native Vitest does not resolve the design-system package's source alias;
// this keeps the real render logic without depending on a generated dist file.
function loadPage() {
  if (!root) throw new Error(`Cannot resolve repository root from ${cwd}`);
  const requireFromWeb = createRequire(path.join(root, 'apps/web/package.json'));
  const designBoundary = {
    StatusChip: ({ children, tone }: { children: ReactNode; tone?: string }) => createElement('span', { 'data-tone': tone }, children),
    InlineNotice: ({ children, title }: { children: ReactNode; title?: string }) => createElement('aside', null, title, children),
  };
  function load(relativePath: string): Record<string, any> {
    const source = read(relativePath);
    const compiled = ts.transpileModule(source, { compilerOptions: {
      target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    } }).outputText;
    const module = { exports: {} as Record<string, any> };
    const boundRequire = (specifier: string): unknown => {
      if (specifier === 'next-intl/server') return { getLocale: pageBoundary.locale };
      if (specifier === '@/lib/bank-release-server') return {
        getCanonicalBankReleaseWorkspace: pageBoundary.workspace,
        buildBankReleaseProjection: pageBoundary.projection,
      };
      if (specifier === '@/components/platform-v7/CanonicalDealsList') return { CanonicalDealsList: () => null };
      if (specifier === '@pc/design-system-v8') return designBoundary;
      if (specifier === '@/components/transaction-ux/MoneyObligationCockpit') return load('apps/web/components/transaction-ux/MoneyObligationCockpit.tsx');
      if (specifier.endsWith('.module.css')) return { __esModule: true, default: new Proxy({}, { get: (_target, key) => String(key) }) };
      return requireFromWeb(specifier);
    };
    new Function('require', 'module', 'exports', compiled)(boundRequire, module, module.exports);
    return module.exports;
  }
  return load('apps/web/app/platform-v7/bank/release-safety/page.tsx');
}

describe('selected bank payout page reason copy', () => {
  const workspace = Object.freeze({ marker: 'trusted-read-unit-boundary' });
  let projection: BankReleaseProjection;
  beforeEach(() => {
    vi.clearAllMocks();
    projection = {
      dealId: 'deal-copy', tenantId: 'tenant-copy', dealVersion: '7', dealStatus: 'RELEASE_REQUESTED',
      shipmentId: 'shipment-copy', amountKopecks: '12000', currency: 'RUB', viewerRole: 'BANK',
      viewerCanRequest: false, state: 'manual_review', documents: [], documentsReady: false,
      acceptanceReady: false, reserveConfirmed: false, releaseRequested: false, releaseConfirmed: false,
      activeDisputeCount: 1, activeHoldKopecks: '100', payment: null, reserveOperation: null,
      releaseOperation: null, releaseOutbox: null, blockers: [], warnings: [],
    };
    pageBoundary.workspace.mockResolvedValue(workspace);
    pageBoundary.projection.mockImplementation(() => projection);
  });
  async function render(locale: string) {
    pageBoundary.locale.mockResolvedValue(locale);
    const before = JSON.stringify(projection);
    const { default: Page } = loadPage();
    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ dealId: projection.dealId }) }));
    expect(pageBoundary.workspace).toHaveBeenCalledWith(projection.dealId);
    expect(pageBoundary.projection).toHaveBeenCalledWith(workspace, undefined);
    expect(JSON.stringify(projection)).toBe(before);
    expect(html).toContain('/platform-v7/deals/deal-copy/clean');
    expect(html).not.toMatch(/<form|<button|method="post"/i);
    return html;
  }
  const locales = [
    { locale: 'ru', dispute: 'По Сделке есть открытый спор.', hold: 'На средства действует удержание.',
      currency: 'Валюта банковской операции расходится с валютой Сделки', amountMismatch: 'Сумма банковской операции расходится с суммой Сделки; требуется ручная сверка.', reconciliation: 'Результат банковской сверки пока недоступен.',
      document: 'Товарно-транспортная накладная: документ не представлен.', signing: 'Лабораторный протокол: подписание не подтверждено.',
      unknownBlocker: 'Дополнительное условие выплаты требует проверки в Сделке.', unknownWarning: 'Дополнительные сведения нужно проверить в Сделке.',
      known: 'выплата подтверждена банком' },
    { locale: 'en', dispute: 'The Deal has an open dispute.', hold: 'A hold applies to the funds.',
      currency: 'The bank operation currency differs from the Deal currency', amountMismatch: 'The bank operation amount differs from the Deal amount; manual reconciliation is required.', reconciliation: 'The bank reconciliation result is not yet available.',
      document: 'Consignment note: the document is not provided.', signing: 'Laboratory report: signing is not confirmed.',
      unknownBlocker: 'An additional payout condition needs checking in the Deal.', unknownWarning: 'Additional information needs checking in the Deal.',
      known: 'payout confirmed by bank' },
    { locale: 'zh', dispute: '该交易存在未结争议。', hold: '资金存在冻结或扣留。',
      currency: '银行操作币种与交易币种不一致', amountMismatch: '银行操作金额与交易金额不一致，需要人工对账。', reconciliation: '银行对账结果暂不可用。',
      document: '货物运输单: 尚未提供文件。', signing: '实验室报告: 签署尚未确认。',
      unknownBlocker: '另有付款条件需要在交易中核查。', unknownWarning: '另有信息需要在交易中核查。',
      known: '银行已确认付款' },
  ];
  it.each(locales)('renders readable blockers and unavailable reconciliation in $locale', async copy => {
    projection.blockers.push('OPEN_DISPUTE', 'ACTIVE_MONEY_HOLD', 'BANK_OPERATION_CURRENCY_REQUIRES_MANUAL_REVIEW');
    projection.warnings.push('RECONCILIATION_RESULT_NOT_EXPOSED_IN_DEAL_WORKSPACE');
    const html = await render(copy.locale);
    for (const expected of [copy.dispute, copy.hold, copy.currency, copy.reconciliation]) expect(html).toContain(expected);
    for (const code of [...projection.blockers, ...projection.warnings]) expect(html).not.toContain(code);
    expect(projection.releaseConfirmed).toBe(false);
  });
  it.each(locales)('explains document names and checks in $locale', async copy => {
    projection.blockers.push('DOCUMENT:TTN:MISSING', 'DOCUMENT:LAB_PROTOCOL:STATUS_NOT_SIGNED');
    const html = await render(copy.locale);
    expect(html).toContain(copy.document); expect(html).toContain(copy.signing);
    for (const code of projection.blockers) expect(html).not.toContain(code);
  });
  it.each(locales)('explains a bank-operation amount conflict without claiming payout in $locale', async copy => {
    projection.blockers.push('BANK_OPERATION_AMOUNT_REQUIRES_MANUAL_REVIEW');
    const html = await render(copy.locale);
    expect(html).toContain(copy.amountMismatch);
    expect(html).not.toContain('BANK_OPERATION_AMOUNT_REQUIRES_MANUAL_REVIEW');
    expect(html).not.toContain(copy.known);
    expect(projection.state).toBe('manual_review');
    expect(projection.releaseConfirmed).toBe(false);
  });
  it.each(locales)('keeps unknown and prototype reason keys readable without exposing raw values in $locale', async copy => {
    projection.blockers.push('NEW_PRIVATE_GATE', 'constructor', '__proto__', 'DOCUMENT:UNKNOWN_TYPE:UNKNOWN_CHECK',
      'DOCUMENT:constructor:toString', 'DOCUMENT:__proto__:__proto__', 'DOCUMENT:TTN:MISSING:INVALID_SUFFIX');
    projection.warnings.push('NEW_PRIVATE_WARNING');
    const html = await render(copy.locale);
    expect(html).toContain(copy.unknownBlocker); expect(html).toContain(copy.unknownWarning);
    for (const code of ['NEW_PRIVATE_GATE', 'constructor', '__proto__', 'toString', 'UNKNOWN_TYPE', 'UNKNOWN_CHECK', 'INVALID_SUFFIX', 'NEW_PRIVATE_WARNING']) expect(html).not.toContain(code);
    expect(html).not.toContain('[object Object]');
  });
  it.each(locales)('preserves server-confirmed display and an empty reason list in $locale', async copy => {
    projection = { ...projection, state: 'released', releaseConfirmed: true, activeDisputeCount: 0, activeHoldKopecks: '0' };
    const html = await render(copy.locale);
    expect(html).toContain(copy.known);
    expect(html).not.toContain(copy.unknownBlocker); expect(html).not.toContain(copy.unknownWarning);
    expect(projection.releaseConfirmed).toBe(true);
  });
  it.each(locales)('keeps a pending request externally unconfirmed while translating its warnings in $locale', async copy => {
    projection = { ...projection, state: 'awaiting_bank', releaseRequested: true,
      warnings: ['RECONCILIATION_RESULT_NOT_EXPOSED_IN_DEAL_WORKSPACE'] };
    const html = await render(copy.locale);
    expect(html).toContain(copy.reconciliation);
    expect(html).not.toContain('RECONCILIATION_RESULT_NOT_EXPOSED_IN_DEAL_WORKSPACE');
    expect(projection.releaseConfirmed).toBe(false);
    expect(projection.state).toBe('awaiting_bank');
    const unknown = { ru: 'внешний исход неизвестен', en: 'external outcome unknown', zh: '外部结果未知' };
    expect(html).toContain(unknown[copy.locale as keyof typeof unknown]);
  });
  it.each(locales)('keeps an unavailable authenticated workspace from rendering a trusted projection in $locale', async copy => {
    pageBoundary.locale.mockResolvedValue(copy.locale);
    pageBoundary.workspace.mockResolvedValue(null);
    const { default: Page } = loadPage();
    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ dealId: projection.dealId }) }));
    expect(pageBoundary.projection).not.toHaveBeenCalled();
    expect(html).not.toContain('PRIVATE_UPSTREAM_DETAIL');
    expect(html).not.toContain(copy.known);
    expect(html).not.toMatch(/<form|<button|method="post"/i);
    expect(html).toContain('/platform-v7/deals');
  });
});

const cwd = process.cwd();
const root = [cwd, path.resolve(cwd, '../..')]
  .find((candidate) => fs.existsSync(path.join(candidate, 'design-governance-v8.json')));

if (!root) throw new Error(`Cannot resolve repository root from ${cwd}`);

function read(relativePath: string): string {
  if (!root) throw new Error(`Cannot resolve repository root from ${cwd}`);
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
