import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { cleanup, render, screen } from '@testing-library/react';
import ts from 'typescript';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  p7BuildBankBasis,
  p7MarkBankBasisSent,
  p7ConfirmBankBasis,
  p7ConfirmBankRefund,
  p7ConfirmBankHold,
  p7RejectBankBasis,
  p7StartBankManualReview,
  type P7BankConfirmationEvent,
  type P7BankConfirmationOperationType,
  type P7BankConfirmationPath,
} from '@/lib/platform-v7/bank-basis';
import { buildPlatformV7IdempotencyKey } from '@/lib/platform-v7/idempotency-key-helper';
import { PLATFORM_V7_CANONICAL_ROLES, type PlatformV7CanonicalRole } from '@/lib/platform-v7/role-canonical';
import type { PlatformV7DocumentRequirement } from '@/lib/platform-v7/document-matrix';
import type { PlatformV7MoneyTree } from '@/lib/platform-v7/money-tree';
import {
  getCanonicalBankReleaseWorkspace,
  buildBankReleaseProjection,
  type BankReleaseProjection,
} from '@/lib/bank-release-server';
import * as serverApi from '@/lib/server-api';
import { canRoleAccessCabinet } from '@/lib/platform-v7/cabinet-access-policy';
import {
  evaluatePlatformV7RouteGuard,
  platformV7RouteGuardRequest,
} from '@/lib/platform-v7/rbac-route-guard';

const webRoot = fs.existsSync(path.join(process.cwd(), 'lib/platform-v7/bank-basis.ts'))
  ? process.cwd()
  : path.join(process.cwd(), 'apps/web');
const bankBasisSource = fs.readFileSync(path.join(webRoot, 'lib/platform-v7/bank-basis.ts'), 'utf8');
const noHistory = { existingBankEventIds: [], usedIdempotencyKeys: [], existingOperationIds: [] } as const;
const movementTypes: Record<P7BankConfirmationPath, P7BankConfirmationOperationType> = {
  release: 'bank_basis_confirmed', refund: 'refund_confirmed', hold: 'hold_created',
  reject: 'bank_basis_rejected', manual_review: 'manual_review_started',
};

function moneyTree(): PlatformV7MoneyTree {
  return { dealId: 'deal-1', currency: 'RUB', totalDealAmount: 1000, reservedAmount: 1000,
    readyToReleaseAmount: 700, heldAmount: 100, manualReviewAmount: 0, releasedAmount: 100,
    refundedAmount: 100, platformFee: 10, bankFee: 5, status: 'bank_basis_requested' };
}

function basis() {
  const documents: PlatformV7DocumentRequirement[] = [
    ['contract', 'seller', 'edo'], ['sdiz', 'seller', 'fgis'],
    ['acceptance_act', 'elevator_operator', 'elevator'], ['lab_protocol', 'lab_specialist', 'lab'],
    ['bank_basis', 'operator', 'bank'],
  ].map(([documentId, ownerRole, source]) => ({ documentId, dealId: 'deal-1', type: documentId,
    title: documentId, ownerRole, responsibleRole: ownerRole, status: 'confirmed', source,
    blockStages: ['release'], affectsMoney: true, deadline: null, signatureStatus: 'not_required',
    nextAction: 'next', createdAt: '', updatedAt: '' })) as PlatformV7DocumentRequirement[];
  return p7BuildBankBasis({ dealId: 'deal-1', bankBasisGate: { allowed: true, reason: 'ready', nextStatus: 'bank_basis_requested' },
    documents, disputeResolved: true, amount: 300, currency: 'RUB', correlationId: 'corr-basis', auditId: 'audit-basis' });
}

function sentBasis(tree: PlatformV7MoneyTree) {
  return p7MarkBankBasisSent({ decision: basis(), moneyTree: tree, actorId: 'operator-1',
    actorRole: 'operator', organizationId: 'org-operator', createdAt: '2026-05-23T07:50:00.000Z' });
}

function confirmation<P extends P7BankConfirmationPath>(movement: P, actorRole: PlatformV7CanonicalRole): P7BankConfirmationEvent<P> {
  const amount = movement === 'reject' ? 0 : 300;
  const actorId = `${actorRole}-1`;
  const bankEventId = `bank-event-${movement}-${actorRole}`;
  return { bankEventId, idempotencyKey: buildPlatformV7IdempotencyKey({ boundaryId: 'confirm_bank_basis',
    actorId, entityId: 'money-1', dealId: 'deal-1', amountMinor: amount, currency: 'RUB', attemptId: bankEventId }),
    path: movement, operationType: movementTypes[movement] as P7BankConfirmationOperationType<P>, amount,
    actorId, actorRole, organizationId: 'org-bank', bankOrganizationId: 'org-bank',
    bankReference: `BR-${movement}`, confirmedAt: '2026-05-23T08:00:00.000Z', auditId: 'audit-bank', correlationId: 'corr-bank' };
}

describe('platform-v7 bank readiness guard', () => {
  it('keeps bank confirmation tied to bank officer, bank organization, reference and trace ids', () => {
    const requiredRuntimeTerms = ['BANK_OFFICER_REQUIRED', 'BANK_ORG_REQUIRED', 'DUPLICATE_BANK_EVENT',
      'DUPLICATE_IDEMPOTENCY_KEY', 'bankOrganizationId', 'bankReference', 'correlationId', 'auditId', 'idempotencyKey'];
    for (const term of requiredRuntimeTerms) {
      expect(bankBasisSource, `${term} must remain in bank runtime`).toContain(term);
    }
  });

  it.each(PLATFORM_V7_CANONICAL_ROLES.filter((role) => role !== 'bank_officer'))(
    'denies %s bank movement confirmation without mutating MoneyTree', (role) => {
      const tree = moneyTree();
      const before = structuredClone(tree);
      const decision = sentBasis(tree).decision;
      const common = { decision, moneyTree: tree, ...noHistory };
      const results = [
        p7ConfirmBankBasis({ ...common, confirmation: confirmation('release', role) }),
        p7ConfirmBankRefund({ ...common, confirmation: confirmation('refund', role) }),
        p7ConfirmBankHold({ ...common, confirmation: confirmation('hold', role) }),
        p7RejectBankBasis({ ...common, confirmation: confirmation('reject', role) }),
        p7StartBankManualReview({ ...common, confirmation: confirmation('manual_review', role) }),
      ];
      for (const result of results) {
        expect(result.valid).toBe(false);
        expect(result.code).toBe('BANK_OFFICER_REQUIRED');
        expect(result.moneyTree).toBe(tree);
        expect(result.moneyTree).toEqual(before);
        expect(result.auditPayload).toMatchObject({ outcome: 'denied', actorRole: role,
          code: 'BANK_OFFICER_REQUIRED', beforeMoneyTree: before, afterMoneyTree: before });
      }
      expect(tree).toEqual(before);
    },
  );

  it('keeps sent_to_bank separate from bank_confirmed until a bank event arrives', () => {
    const tree = moneyTree();
    const before = structuredClone(tree);
    const ready = basis();
    const sent = sentBasis(tree);
    expect(ready.status).toBe('ready_for_bank_review');
    expect(sent.decision.status).toBe('sent_to_bank');
    expect(sent.auditPayload.beforeMoneyTree).toBe(tree);
    expect(sent.auditPayload.afterMoneyTree).toBe(tree);
    expect(tree).toEqual(before);

    const event = confirmation('release', 'bank_officer');
    const unsent = p7ConfirmBankBasis({ decision: ready, moneyTree: tree, confirmation: event, ...noHistory });
    expect(unsent.valid).toBe(false);
    expect(unsent.code).toBe('CANNOT_CONFIRM_UNSENT_BASIS');
    expect(unsent.moneyTree).toBe(tree);

    const confirmed = p7ConfirmBankBasis({ decision: sent.decision, moneyTree: tree, confirmation: event, ...noHistory });
    expect(confirmed.valid).toBe(true);
    expect(confirmed.decision.status).toBe('bank_confirmed');
    expect(confirmed.moneyTree.releasedAmount).toBe(before.releasedAmount + event.amount);
    expect(tree).toEqual(before);
  });
});

// These are explicit server-data/request boundary doubles. The entry page,
// canonical read-only renderer, cockpit and bank role guard execute unchanged;
// this fixture does not certify a live session, PostgreSQL access or payment.
const readEntryBoundary = {
  locale: vi.fn(),
  headers: vi.fn(),
  pathname: vi.fn(),
  clientLocale: vi.fn(),
  workspace: vi.fn(),
  projection: vi.fn(),
  profile: vi.fn(),
};

function loadReadEntry() {
  const requireFromWeb = createRequire(path.join(webRoot, 'package.json'));
  const loaded = new Map<string, Record<string, any>>();
  function load(relativePath: string): Record<string, any> {
    const cached = loaded.get(relativePath);
    if (cached) return cached;
    const module = { exports: {} as Record<string, any> };
    loaded.set(relativePath, module.exports);
    const source = fs.readFileSync(path.join(webRoot, relativePath), 'utf8');
    const compiled = ts.transpileModule(source, { compilerOptions: {
      target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    } }).outputText;
    const boundRequire = (specifier: string): unknown => {
      if (specifier === '../release-safety/page') return load('app/platform-v7/bank/release-safety/page.tsx');
      if (specifier === 'next-intl/server') return { getLocale: readEntryBoundary.locale };
      if (specifier === 'next/headers') return { headers: readEntryBoundary.headers };
      if (specifier === 'next/navigation') return { ...requireFromWeb(specifier), usePathname: readEntryBoundary.pathname };
      if (specifier === 'next-intl') return { useLocale: readEntryBoundary.clientLocale };
      if (specifier === '@/lib/platform-v7/routes') return load('lib/platform-v7/routes.ts');
      if (specifier === '@/lib/bank-release-server') return {
        getCanonicalBankReleaseWorkspace: readEntryBoundary.workspace,
        buildBankReleaseProjection: readEntryBoundary.projection,
      };
      if (specifier === '@/lib/auth-profile-server') return { getAuthProfile: readEntryBoundary.profile };
      if (specifier === '@/lib/platform-v7/rbac-route-guard') return {
        evaluatePlatformV7RouteGuard, platformV7RouteGuardRequest,
      };
      if (specifier === '@/components/platform-v7/CanonicalDealsList') return {
        CanonicalDealsList: () => createElement('div', { 'data-testid': 'read-entry-deal-list-boundary' }),
      };
      if (specifier === '@pc/design-system-v8') return {
        StatusChip: ({ children, tone }: { children: ReactNode; tone?: string }) => createElement('span', { 'data-tone': tone }, children),
        InlineNotice: ({ children, title }: { children: ReactNode; title?: string }) => createElement('aside', null, title, children),
      };
      if (specifier === '@/components/transaction-ux/MoneyObligationCockpit') return load('components/transaction-ux/MoneyObligationCockpit.tsx');
      if (specifier.endsWith('.module.css')) return { __esModule: true, default: new Proxy({}, { get: (_target, key) => String(key) }) };
      return requireFromWeb(specifier);
    };
    new Function('require', 'module', 'exports', compiled)(boundRequire, module, module.exports);
    return module.exports;
  }
  return {
    Page: load('app/platform-v7/bank/payment-basis/page.tsx').default,
    Guard: load('components/platform-v7/RbacGuard.tsx').RbacGuard,
    metadata: load('app/platform-v7/bank/payment-basis/page.tsx').metadata,
    Nav: load('components/platform-v7/BankSectionNav.tsx').BankSectionNav,
    CanonicalPage: load('app/platform-v7/bank/release-safety/page.tsx').default,
  };
}

describe('shared bank payment-basis read entry', () => {
  const workspace = Object.freeze({ marker: 'authenticated-workspace-unit-boundary' });
  let projection: BankReleaseProjection;
  beforeEach(() => {
    vi.clearAllMocks();
    projection = {
      dealId: 'deal-read-entry', tenantId: 'tenant-read-entry', dealVersion: '7', dealStatus: 'RELEASE_REQUESTED',
      shipmentId: 'shipment-read-entry', amountKopecks: '12000', currency: 'RUB', viewerRole: 'BUYER',
      viewerCanRequest: false, state: 'awaiting_bank', documents: [], documentsReady: false,
      acceptanceReady: false, reserveConfirmed: false, releaseRequested: true, releaseConfirmed: false,
      activeDisputeCount: 0, activeHoldKopecks: '0', payment: null, reserveOperation: null,
      releaseOperation: null, releaseOutbox: null, blockers: [], warnings: [],
    };
    readEntryBoundary.locale.mockResolvedValue('ru');
    readEntryBoundary.headers.mockResolvedValue(new Headers());
    readEntryBoundary.workspace.mockResolvedValue(workspace);
    readEntryBoundary.projection.mockReturnValue(projection);
    readEntryBoundary.profile.mockResolvedValue({ available: true, id: 'unit-reader', orgId: 'unit-reader-org', role: 'BUYER' });
  });

  const locales = [
    { locale: 'ru', unknown: 'внешний исход не подтверждён', unavailable: 'Серверная проверка выплаты недоступна' },
    { locale: 'en', unknown: 'external outcome unconfirmed', unavailable: 'Server payout review is unavailable' },
    { locale: 'zh', unknown: '外部结果尚未确认', unavailable: '服务器付款检查不可用' },
  ];
  const readers = [
    { cabinet: 'buyer', apiRole: 'BUYER' },
    { cabinet: 'seller', apiRole: 'FARMER' },
  ] as const;

  for (const reader of readers) {
    it.each(locales)(`${reader.cabinet} reads the canonical review at the shared URI in $locale`, async copy => {
      expect(canRoleAccessCabinet(reader.cabinet, '/platform-v7/bank/payment-basis')).toBe(true);
      expect(canRoleAccessCabinet(reader.cabinet, '/platform-v7/bank')).toBe(false);
      readEntryBoundary.locale.mockResolvedValue(copy.locale);
      readEntryBoundary.profile.mockResolvedValue({ available: true, id: 'unit-reader', orgId: 'unit-reader-org', role: reader.apiRole });
      const before = structuredClone(projection);
      const { Page, Guard, metadata } = loadReadEntry();
      const page = await Page({ searchParams: Promise.resolve({
        dealId: ['  deal-read-entry  ', 'ignored-deal'], shipmentId: ['  shipment-read-entry  ', 'ignored-shipment'],
        released: 'true', bankConfirmed: 'true',
      }) });
      const html = renderToStaticMarkup(await Guard({ surface: 'bank_workspace', children: page }));
      expect(readEntryBoundary.workspace).toHaveBeenCalledExactlyOnceWith('deal-read-entry');
      expect(readEntryBoundary.projection).toHaveBeenCalledExactlyOnceWith(workspace, 'shipment-read-entry');
      expect(metadata.robots).toEqual({ index: false, follow: false });
      expect(html).toContain('data-testid="platform-v7-bank-release-safety-v8"');
      expect(html).toContain(copy.unknown);
      expect(html).toContain(`/platform-v7/deals/deal-read-entry/execution?lang=${copy.locale}`);
      expect(html).toContain('dealId=deal-read-entry&amp;shipmentId=shipment-read-entry');
      expect(html).not.toMatch(/<form|<button|method=["']post/i);
      expect(projection).toEqual(before);
      expect(projection.releaseConfirmed).toBe(false);
      expect(projection.viewerCanRequest).toBe(false);
    });
  }

  it.each(locales)('keeps unavailable workspace data unavailable in $locale', async copy => {
    readEntryBoundary.locale.mockResolvedValue(copy.locale);
    readEntryBoundary.workspace.mockResolvedValue(null);
    const { Page } = loadReadEntry();
    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ dealId: 'missing-deal' }) }));
    expect(readEntryBoundary.workspace).toHaveBeenCalledExactlyOnceWith('missing-deal');
    expect(readEntryBoundary.projection).not.toHaveBeenCalled();
    expect(html).toContain(copy.unavailable);
    expect(html).not.toContain('deal-read-entry');
    expect(html).not.toMatch(/<form|<button|method=["']post/i);
  });

  it('keeps a rejected canonical projection unavailable', async () => {
    readEntryBoundary.projection.mockReturnValue(null);
    const { Page } = loadReadEntry();
    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ dealId: 'deal-read-entry' }) }));
    expect(html).toContain('Серверная проверка выплаты недоступна');
    expect(html).not.toContain('/platform-v7/deals/deal-read-entry/execution');
    expect(html).not.toMatch(/<form|<button|method=["']post/i);
  });

  it.each([undefined, {}, { dealId: '   ' }, { dealId: [] }])('uses the canonical registry when no Deal is selected: %j', async query => {
    const { Page } = loadReadEntry();
    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve(query) }));
    expect(html).toContain('read-entry-deal-list-boundary');
    expect(readEntryBoundary.workspace).not.toHaveBeenCalled();
    expect(readEntryBoundary.projection).not.toHaveBeenCalled();
    expect(html).not.toMatch(/<form|<button|method=["']post/i);
  });

  it.each([
    { available: false, id: null, orgId: null, role: null },
    { available: true, id: 'unit-reader', orgId: null, role: 'BUYER' },
    { available: true, id: 'unit-reader', orgId: 'unit-reader-org', role: 'DRIVER' },
    { available: true, id: 'unit-reader', orgId: 'unit-reader-org', role: 'GUEST' },
    { available: true, id: 'unit-reader', orgId: 'unit-reader-org', role: 'PLATFORM_OWNER' },
  ])('preserves the actual bank guard denial for %j', async profile => {
    readEntryBoundary.profile.mockResolvedValue(profile);
    const { Guard } = loadReadEntry();
    const html = renderToStaticMarkup(await Guard({ surface: 'bank_workspace', children: createElement('div', null, 'PRIVATE_UNIT_READ_VIEW') }));
    expect(html).toContain('platform-v7-rbac-denied-bank_workspace');
    expect(html).not.toContain('PRIVATE_UNIT_READ_VIEW');
  });

  describe('canonical read-data boundary', () => {
    afterEach(() => {
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
    });

    function responseBody() {
      return {
        deal: {
          id: 'deal-read-entry', tenantId: 'tenant-read-entry', status: 'DRAFT', version: '1',
          totalKopecks: '12000', currency: 'RUB', updatedAt: '2026-11-03T12:00:00.000Z',
          shipments: [{ id: 'shipment-read-entry', dealId: 'deal-read-entry', tenantId: 'tenant-read-entry', status: 'PLANNED', checkpoints: [] }],
          acceptanceRecords: [], labSamples: [], documents: [], payments: [], bankOperations: [],
        },
        viewer: { participantId: 'unit-participant', organizationId: 'unit-reader-org', role: 'BUYER', accessLevel: 'READ' },
        projections: { documents: [], payments: [], disputes: [] }, outbox: [],
      };
    }

    function useCanonicalRead(fetchBoundary: ReturnType<typeof vi.fn>) {
      vi.spyOn(serverApi, 'serverApiUrl').mockImplementation(route => `https://unit-api.example${route}`);
      vi.spyOn(serverApi, 'serverAuthHeaders').mockResolvedValue({ authorization: 'Bearer disposable-unit-fixture' });
      vi.stubGlobal('fetch', fetchBoundary);
      readEntryBoundary.workspace.mockImplementation(getCanonicalBankReleaseWorkspace);
      readEntryBoundary.projection.mockImplementation(buildBankReleaseProjection);
    }

    it('uses the actual authenticated GET adapter and projection without creating a payout', async () => {
      const body = responseBody();
      const before = structuredClone(body);
      const fetchBoundary = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }));
      useCanonicalRead(fetchBoundary);
      const { Page } = loadReadEntry();
      const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ dealId: 'deal-read-entry', shipmentId: 'shipment-read-entry' }) }));
      expect(fetchBoundary).toHaveBeenCalledTimes(1);
      const [url, init] = fetchBoundary.mock.calls[0];
      expect(url).toBe('https://unit-api.example/deals/deal-read-entry/workspace');
      expect(init.cache).toBe('no-store');
      expect(init.method ?? 'GET').toBe('GET');
      expect(init.headers).toEqual({ authorization: 'Bearer disposable-unit-fixture' });
      expect(init.body).toBeUndefined();
      expect(html).toContain('/platform-v7/deals/deal-read-entry/execution?lang=ru');
      expect(html).toContain('выплата заблокирована');
      expect(html).not.toMatch(/<form|<button|method=["']post/i);
      expect(body).toEqual(before);
    });

    it.each(['401', '403', 'mismatched-deal', 'cross-tenant-shipment', 'unknown-shipment', 'malformed', 'network-error'])(
      'keeps the actual canonical adapter/projection failure unavailable: %s', async failure => {
        const body = responseBody();
        const query = { dealId: 'deal-read-entry', shipmentId: 'shipment-read-entry' };
        if (failure === 'mismatched-deal') {
          body.deal.id = 'different-deal';
          body.deal.shipments[0].dealId = 'different-deal';
        }
        if (failure === 'cross-tenant-shipment') body.deal.shipments[0].tenantId = 'different-tenant';
        if (failure === 'unknown-shipment') query.shipmentId = 'unknown-shipment';
        const fetchBoundary = failure === 'network-error'
          ? vi.fn().mockRejectedValue(new Error('PRIVATE_READ_FIXTURE_DETAIL'))
          : vi.fn().mockResolvedValue(
            failure === '401' || failure === '403'
              ? new Response(null, { status: Number(failure) })
              : new Response(JSON.stringify(failure === 'malformed' ? { unexpected: true } : body), { status: 200 }),
          );
        useCanonicalRead(fetchBoundary);
        const { Page } = loadReadEntry();
        const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve(query) }));
        expect(fetchBoundary).toHaveBeenCalledTimes(1);
        expect(html).toContain('Серверная проверка выплаты недоступна');
        expect(html).not.toContain('/platform-v7/deals/deal-read-entry/execution');
        expect(html).not.toContain('PRIVATE_READ_FIXTURE_DETAIL');
        expect(html).not.toMatch(/<form|<button|method=["']post/i);
      },
    );
  });
});

describe('shared bank navigation presentation', () => {
  const shared = '/platform-v7/bank/payment-basis';
  const bank = '/platform-v7/bank';
  const canonical = '/platform-v7/bank/release-safety';
  const home = '/platform-v7';
  const bankLinks = [
    { href: bank, label: 'Банковый контур' },
    { href: canonical, label: 'Проверка выплаты' },
    { href: shared, label: 'Передать основание банку' },
  ];
  const copies = [
    { locale: 'ru', navigation: 'Банковские действия', basis: 'Основание выплаты', home: 'На главную' },
    { locale: 'en', navigation: 'Bank navigation', basis: 'Payment basis', home: 'Platform home' },
    { locale: 'zh', navigation: '银行导航', basis: '付款依据', home: '平台首页' },
  ];
  function hrefs(html: string) {
    return [...html.matchAll(/href="([^"]*)"/g)].map(match => match[1]);
  }
  beforeEach(() => {
    vi.clearAllMocks();
    readEntryBoundary.locale.mockResolvedValue('ru');
    readEntryBoundary.clientLocale.mockReturnValue('ru');
    readEntryBoundary.pathname.mockReturnValue(shared);
    readEntryBoundary.headers.mockResolvedValue(new Headers({ 'x-pc-pathname': shared }));
    readEntryBoundary.workspace.mockResolvedValue(null);
    readEntryBoundary.profile.mockResolvedValue({ available: true, id: 'unit-reader', orgId: 'unit-reader-org', role: 'BUYER' });
  });
  afterEach(cleanup);

  for (const reader of [{ cabinet: 'buyer', apiRole: 'BUYER' }, { cabinet: 'seller', apiRole: 'FARMER' }] as const) {
    it.each(copies)(`${reader.cabinet} has only permitted shared navigation in $locale`, async copy => {
      readEntryBoundary.clientLocale.mockReturnValue(copy.locale);
      readEntryBoundary.profile.mockResolvedValue({ available: true, id: 'unit-reader', orgId: 'unit-reader-org', role: reader.apiRole });
      const { Nav, Guard } = loadReadEntry();
      const html = renderToStaticMarkup(await Guard({ surface: 'bank_workspace', children: createElement(Nav, { links: bankLinks }) }));
      expect(hrefs(html)).toEqual([shared, home]);
      for (const href of hrefs(html)) expect(canRoleAccessCabinet(reader.cabinet, href)).toBe(true);
      expect(html).toContain(copy.navigation);
      expect(html).toContain(copy.basis);
      expect(html).toContain(copy.home);
      expect(html).not.toContain('platform-v7-rbac-denied');
      expect(readEntryBoundary.profile).toHaveBeenCalledTimes(1);
      expect(readEntryBoundary.workspace).not.toHaveBeenCalled();
    });
  }

  it.each(copies)('keeps a permitted escape for a bank reader at the same shared URI in $locale', copy => {
    readEntryBoundary.clientLocale.mockReturnValue(copy.locale);
    const { Nav } = loadReadEntry();
    const html = renderToStaticMarkup(createElement(Nav, { links: bankLinks }));
    expect(hrefs(html)).toEqual([shared, home]);
    for (const href of hrefs(html)) expect(canRoleAccessCabinet('bank', href)).toBe(true);
    expect(canRoleAccessCabinet('bank', '/platform-v7/deals')).toBe(false);
    expect(html).not.toContain('href="/platform-v7/deals"');
    expect(html).toContain(copy.home);
    expect(readEntryBoundary.profile).not.toHaveBeenCalled();
  });

  it.each([bank, canonical, `${bank}/clean`, `${bank}/events`, `${bank}/events/event-1`, `${bank}/factoring`, `${bank}/escrow`, `${bank}/grain`])(
    'preserves the existing full navigation at the known bank-only route %s', pathname => {
      readEntryBoundary.pathname.mockReturnValue(pathname);
      const { Nav } = loadReadEntry();
      const html = renderToStaticMarkup(createElement(Nav, { links: bankLinks }));
      expect(hrefs(html)).toEqual([bank, canonical, shared]);
      for (const href of hrefs(html)) expect(canRoleAccessCabinet('bank', href)).toBe(true);
      expect(canRoleAccessCabinet('buyer', pathname)).toBe(false);
      expect(canRoleAccessCabinet('seller', pathname)).toBe(false);
      expect(readEntryBoundary.profile).not.toHaveBeenCalled();
    },
  );

  it.each([null, undefined, '', `${bank}/`, `${bank}/unknown`, `${shared}/`, `${shared}/child`, `${shared}-extra`, `${canonical}/child`, `${bank}/events/a/b`, `${bank}/events/%2f`, `${bank}/events/..`, `${bank}?role=bank`, '/ru/platform-v7/bank'])(
    'uses fixed safe navigation for missing or unknown path context %j', pathname => {
      readEntryBoundary.pathname.mockReturnValue(pathname);
      const { Nav } = loadReadEntry();
      const html = renderToStaticMarkup(createElement(Nav, { links: bankLinks }));
      expect(hrefs(html)).toEqual([shared, home]);
      expect(readEntryBoundary.profile).not.toHaveBeenCalled();
      expect(readEntryBoundary.workspace).not.toHaveBeenCalled();
    },
  );

  it.each(copies)('updates the same mounted navigation bank → shared → bank in $locale', copy => {
    readEntryBoundary.clientLocale.mockReturnValue(copy.locale);
    readEntryBoundary.pathname.mockReturnValue(bank);
    const { Nav } = loadReadEntry();
    const mounted = render(createElement(Nav, { links: bankLinks }));
    const currentHrefs = () => screen.getAllByRole('link').map(link => link.getAttribute('href'));
    expect(currentHrefs()).toEqual([bank, canonical, shared]);
    expect(screen.getAllByRole('link')[0]).toHaveAttribute('aria-current', 'page');
    readEntryBoundary.pathname.mockReturnValue(shared);
    mounted.rerender(createElement(Nav, { links: bankLinks }));
    expect(currentHrefs()).toEqual([shared, home]);
    expect(screen.getByRole('link', { name: copy.basis })).toHaveAttribute('aria-current', 'page');
    readEntryBoundary.pathname.mockReturnValue(canonical);
    mounted.rerender(createElement(Nav, { links: bankLinks }));
    expect(currentHrefs()).toEqual([bank, canonical, shared]);
    expect(screen.getAllByRole('link')[1]).toHaveAttribute('aria-current', 'page');
  });

  it.each(copies)('omits the bank-only backlink from shared registry and unavailable views in $locale', async copy => {
    readEntryBoundary.locale.mockResolvedValue(copy.locale);
    const { Page } = loadReadEntry();
    const registry = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
    const unavailable = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ dealId: 'unavailable-deal' }) }));
    for (const html of [registry, unavailable]) {
      expect(hrefs(html)).not.toContain(bank);
      expect(hrefs(html)).toContain('/platform-v7/deals');
      for (const role of ['buyer', 'seller'] as const) {
        for (const href of hrefs(html)) expect(canRoleAccessCabinet(role, href)).toBe(true);
      }
      expect(html).not.toMatch(/<form|<button|method=["']post/i);
    }
    expect(readEntryBoundary.workspace).toHaveBeenCalledExactlyOnceWith('unavailable-deal');
    expect(readEntryBoundary.profile).not.toHaveBeenCalled();
  });

  it.each([null, '', `${bank}/unknown`, `${canonical}/`, `${canonical}/child`, `${canonical}-extra`])(
    'does not infer a bank-only backlink from absent or unknown request header %j', async pathname => {
      readEntryBoundary.headers.mockResolvedValue(new Headers(pathname === null ? undefined : { 'x-pc-pathname': pathname }));
      const { Page } = loadReadEntry();
      for (const query of [{}, { dealId: 'unavailable-deal' }]) {
        const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve(query) }));
        expect(hrefs(html)).not.toContain(bank);
      }
    },
  );

  it.each(copies)('keeps canonical bank recovery inside a usable bank registry in $locale', async copy => {
    readEntryBoundary.locale.mockResolvedValue(copy.locale);
    readEntryBoundary.headers.mockResolvedValue(new Headers({ 'x-pc-pathname': canonical }));
    const { CanonicalPage } = loadReadEntry();
    const unavailable = renderToStaticMarkup(await CanonicalPage({ searchParams: Promise.resolve({ dealId: 'unavailable-deal', shipmentId: 'stale-shipment' }) }));
    const expectedRecovery = `${canonical}?lang=${copy.locale}#release-deals`;
    expect(hrefs(unavailable)).toContain(expectedRecovery);
    expect(hrefs(unavailable)).not.toContain(`${shared}?lang=${copy.locale}#release-deals`);
    const recovery = new URL(expectedRecovery, 'https://example.test');
    expect(canRoleAccessCabinet('bank', recovery.pathname)).toBe(true);
    expect(recovery.searchParams.has('dealId')).toBe(false);
    expect(recovery.searchParams.has('shipmentId')).toBe(false);
    readEntryBoundary.headers.mockResolvedValue(new Headers({ 'x-pc-pathname': recovery.pathname }));
    const registry = renderToStaticMarkup(await CanonicalPage({ searchParams: Promise.resolve(Object.fromEntries(recovery.searchParams)) }));
    expect(hrefs(registry)).toContain('#release-deals');
    expect(registry).toContain('id="release-deals"');
    expect(hrefs(registry)).not.toContain('/platform-v7/deals');
    expect(readEntryBoundary.workspace).toHaveBeenCalledExactlyOnceWith('unavailable-deal');
    expect(readEntryBoundary.profile).not.toHaveBeenCalled();
    for (const html of [unavailable, registry]) expect(html).not.toMatch(/<form|<button|method=["']post/i);
  });

  it.each(copies)('preserves the bank return link on the canonical bank-only page in $locale', async copy => {
    readEntryBoundary.locale.mockResolvedValue(copy.locale);
    readEntryBoundary.headers.mockResolvedValue(new Headers({ 'x-pc-pathname': canonical }));
    const { Page, CanonicalPage } = loadReadEntry();
    expect(Page).toBe(CanonicalPage);
    expect(canRoleAccessCabinet('bank', canonical)).toBe(true);
    expect(canRoleAccessCabinet('buyer', canonical)).toBe(false);
    expect(canRoleAccessCabinet('seller', canonical)).toBe(false);
    for (const query of [{}, { dealId: 'unavailable-deal' }]) {
      const html = renderToStaticMarkup(await CanonicalPage({ searchParams: Promise.resolve(query) }));
      expect(hrefs(html)).toContain(bank);
      expect(hrefs(html)).not.toContain('/platform-v7/deals');
      for (const href of hrefs(html)) expect(canRoleAccessCabinet('bank', href)).toBe(true);
      expect(html).not.toMatch(/<form|<button|method=["']post/i);
    }
  });
});
