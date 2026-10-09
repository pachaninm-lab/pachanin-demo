import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { createElement, type ReactElement, type ReactNode } from 'react';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { FirstCustomerWorkspaceSnapshot } from '@/lib/first-customer-workspace-server';

const repoRoot = path.resolve(process.cwd(), '../..');
const read = (relativePath: string) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const seller = read('apps/web/app/platform-v7/seller/page.tsx');
const buyer = read('apps/web/app/platform-v7/buyer/page.tsx');
const bank = read('apps/web/app/platform-v7/bank/page.tsx');
const firstCustomerWorkspace = read('apps/web/components/platform-v7/FirstCustomerWorkspace.tsx');
const firstCustomerWorkspaceCss = read('apps/web/components/platform-v7/FirstCustomerWorkspace.module.css');
const cockpit = read('apps/web/components/transaction-ux/MoneyObligationCockpit.tsx');
const cockpitCss = read('apps/web/components/transaction-ux/MoneyObligationCockpit.module.css');
const governance = JSON.parse(read('design-governance-v8.json'));
const forbiddenPresentation = /style\s*=\s*\{\{|dangerouslySetInnerHTML|#[0-9a-f]{3,8}\b|\brgba?\s*\(|!important/i;

describe('Design System v8 money role reference slice', () => {
  it('uses one Money & Obligation Cockpit across seller, buyer and bank', () => {
    expect(cockpit).toContain("data-money-obligation-cockpit='v8'");
    expect(cockpit).toContain('Главное обязательство');
    for (const source of [seller, buyer, bank]) {
      expect(source).toContain("from '@pc/design-system-v8'");
      expect(source).toContain('MoneyObligationCockpit');
      expect(source).toContain('MoneyBoundary');
      expect(source).not.toMatch(forbiddenPresentation);
    }
    expect(cockpitCss).not.toMatch(forbiddenPresentation);
  });

  it('keeps seller truth server-derived and fails closed when priority is unpublished', () => {
    expect(seller).toContain('getDealsSnapshot');
    expect(seller).toContain('getDisputesSnapshot');
    expect(seller).toContain('dealRegistryComplete');
    expect(seller).toContain("value: 'UNKNOWN'");
    expect(seller).toContain('порядок ответа не используется как authority');
    expect(seller).toContain('Список — навигация по подтверждённым сделкам, а не ранжирование следующего действия.');
    expect(seller).toContain('Кабинет не делает выводов о резерве, выплате, СДИЗ, ЭТрН');
    for (const retiredStaticTool of [
      'SellerInlineLotEditor',
      'DocumentReadinessMiniMatrix',
      'MoneyGateRing',
      'FactoringPanel',
      'CommissionCalculator',
      'DocumentTemplatesPanel',
      'EdoDocflowPanel',
    ]) {
      expect(seller).not.toContain(retiredStaticTool);
    }

    expect(firstCustomerWorkspace).toContain("state === 'ready' && !workspace.ownerControlled");
    expect(firstCustomerWorkspace).toContain("href='#first-customer-work-queue'");
    expect(firstCustomerWorkspace).toContain('priorityUnknownResult');
    expect(firstCustomerWorkspace).toContain('Следующий обязательный шаг не опубликован');
    expect(firstCustomerWorkspace).toContain('Required next step is not published');
    expect(firstCustomerWorkspace).toContain('服务器未提供必须执行的下一步');
    expect(firstCustomerWorkspace).toContain('Сервер подтвердил доступ к рабочей очереди продавца.');
    expect(firstCustomerWorkspace).toContain('The server confirmed access to the seller work queue.');
    expect(firstCustomerWorkspace).toContain('服务器已确认卖方工作队列的访问权限。');
  });

  it('keeps buyer reserve, hold, SDIZ and escrow boundaries', () => {
    expect(firstCustomerWorkspace).toContain("surface === 'buyer' ? copy.buyerDescription");
    expect(firstCustomerWorkspace).toContain("copy.buyerQueueNote");
    expect(firstCustomerWorkspace).toContain("surface === 'buyer' && !workspace.ownerControlled && state === 'ready'");
    expect(firstCustomerWorkspace).toContain("result: priorityUnknown ? copy.priorityUnknownResult");
    expect(firstCustomerWorkspaceCss).toContain('line-height: 1.5');
    expect(firstCustomerWorkspaceCss).toContain('var(--ds-color-text-secondary)');
    expect(firstCustomerWorkspaceCss).not.toMatch(forbiddenPresentation);
    for (const phrase of [
      'Сервер проверяет доступ к сделкам для роли покупателя',
      'The server checks Deal access for the buyer role',
      '服务器会核查买方角色的交易访问权限',
      'Данные организации показываются при подтверждении',
      'Organization details appear when confirmed',
      '组织信息仅在确认后显示',
      'банковское подтверждение',
      'bank confirmation',
      '银行确认',
    ]) expect(firstCustomerWorkspace).toContain(phrase);
    expect(buyer).toContain('P7ExecutionActionsPanel');
    expect(buyer).toContain('buyerSdizActionItems');
    expect(buyer).toContain('CreditBureauPanel');
    expect(buyer).toContain('EscrowPanel');
    expect(buyer).toMatch(/банк подтверждает резерв и дальнейшее движение денег/i);
    expect(buyer).toContain('Платформа деньги не выпускает');
  });

  it('keeps bank callback and decision authority outside the presentation layer', () => {
    expect(bank).toContain('BankCleanView');
    expect(bank).toContain('BankCompliancePilotPanel');
    expect(bank).toContain('DocumentsMatrix');
    expect(bank).toContain('EvidenceReadinessMiniMatrix');
    expect(bank).toContain('LedgerPanel');
    expect(bank).toContain('MoneyLifecyclePanel');
    expect(bank).toMatch(/интерфейс не выпускает деньги/i);
    expect(bank).toContain('Только банк подтверждает резерв, проверку и движение денег');
    expect(bank).toContain('Ручная кнопка не может заменить банковскую проверку и подтверждённый callback');
  });

  it('shows the bank Deal queue as navigation with unknown provider and settlement facts', () => {
    expect(firstCustomerWorkspace).toContain("surface === 'bank' ? copy.bankDescription");
    expect(firstCustomerWorkspace).toContain("surface === 'bank' ? copy.bankQueueReady : copy.ready");
    expect(firstCustomerWorkspace).toContain("surface === 'bank' && !workspace.ownerControlled && state === 'ready'");
    expect(firstCustomerWorkspace).toContain("surface === 'bank' && !workspace.ownerControlled ? copy.bankQueueDetail : item.nextAction || copy.noNext");
    expect(firstCustomerWorkspace).toContain("surface === 'bank' && !workspace.ownerControlled ? (");
    expect(firstCustomerWorkspace).toContain('bankUnknownTitle');
    expect(firstCustomerWorkspaceCss).toContain('.bankQueueNote');
    expect(firstCustomerWorkspaceCss).not.toMatch(forbiddenPresentation);
    for (const phrase of [
      'Сервер проверяет роль банковского кабинета и доступ к сделкам',
      'The server checks the bank cabinet role and access to Deals',
      '服务器会核查银行工作台角色和交易访问权限',
      'Банковские факты — UNKNOWN',
      'Bank facts — UNKNOWN',
      '银行事实 — UNKNOWN',
      'Открыть сделку для проверки серверных фактов',
      'Open the Deal to check server facts',
      '打开交易并核查服务器事实',
    ]) expect(firstCustomerWorkspace).toContain(phrase);
  });

  it('enforces 48px controls and accessible display modes', () => {
    expect(cockpitCss).toContain('min-height: var(--ds-control-height)');
    expect(cockpitCss).toContain(':focus-visible');
    expect(cockpitCss).toContain('@media (max-width: 640px)');
    expect(cockpitCss).toContain('@media (prefers-reduced-motion: reduce)');
    expect(cockpitCss).toContain('@media (forced-colors: active)');
  });

  it('registers all money routes in v8 governance', () => {
    expect(governance.migratedFiles).toEqual(expect.arrayContaining([
      'apps/web/app/platform-v7/seller/page.tsx',
      'apps/web/app/platform-v7/buyer/page.tsx',
      'apps/web/app/platform-v7/bank/page.tsx',
    ]));
  });
});

// This package is deliberately outside pnpm-workspace.yaml. Render the actual
// workspace source with bounded presentation stubs so the governed CI job can
// test bank state decisions without relying on a local node_modules symlink.
async function renderBankWorkspace(snapshot: FirstCustomerWorkspaceSnapshot, locale = 'ru', surface: 'bank' | 'buyer' = 'bank') {
  const compiled = ts.transpileModule(firstCustomerWorkspace, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  const withChildren = (tag: 'div' | 'section' | 'span', props: { children?: ReactNode }) =>
    createElement(tag, null, props.children);
  const cockpit = {
    OperationalDecisionCockpit: ({ testId, statusLabel, priority, children }: {
      testId: string; statusLabel: string;
      priority: { title: string; result?: string; primaryAction?: ReactNode; secondaryAction?: ReactNode }; children: ReactNode;
    }) => createElement('main', { 'data-testid': testId },
      createElement('span', null, statusLabel), createElement('h2', null, priority.title),
      createElement('span', null, priority.result), priority.primaryAction, priority.secondaryAction, children),
    OperationalCockpitSection: ({ id, children }: { id?: string; children: ReactNode }) =>
      createElement('section', { id }, children),
    OperationalQueue: (props: { children: ReactNode }) => withChildren('div', props),
    OperationalQueueLink: ({ href, title, detail, status }: { href: string; title: string; detail: string; status: ReactNode }) =>
      createElement('a', { href }, createElement('strong', null, title), createElement('span', null, detail), status),
    operationalCockpitClasses: { primaryLink: 'primaryLink', secondaryLink: 'secondaryLink' },
  };
  const dependencies: Record<string, unknown> = {
    'next/link': ({ href, children }: { href: string; children: ReactNode }) => createElement('a', { href }, children),
    'next-intl/server': { getLocale: async () => locale },
    './FirstCustomerWorkspace.module.css': { buyerQueueNote: 'buyerQueueNote', bankQueueNote: 'bankQueueNote' },
    '@pc/design-system-v8': {
      StatusChip: (props: { children: ReactNode }) => withChildren('span', props),
      InlineNotice: ({ title, children }: { title: string; children: ReactNode }) =>
        createElement('div', null, createElement('strong', null, title), children),
    },
    '@/components/transaction-ux/OperationalDecisionCockpit': cockpit,
    '@/lib/first-customer-workspace-server': { getFirstCustomerWorkspace: async () => snapshot },
  };
  const nativeRequire = createRequire(import.meta.url);
  const runtimeModule: { exports: Record<string, unknown> } = { exports: {} };
  const requireWorkspaceDependency = (specifier: string) => {
    if (specifier === 'react/jsx-runtime') return nativeRequire(specifier);
    if (Object.hasOwn(dependencies, specifier)) return dependencies[specifier];
    throw new Error(`Unexpected workspace import: ${specifier}`);
  };
  runInNewContext(compiled, {
    exports: runtimeModule.exports,
    module: runtimeModule,
    require: requireWorkspaceDependency,
  }, { filename: 'FirstCustomerWorkspace.tsx' });
  const workspace = runtimeModule.exports.FirstCustomerWorkspace as
    (props: { surface: 'bank' | 'buyer' }) => Promise<ReactElement>;
  render(await workspace({ surface }));
}

const bankErrorSnapshot: FirstCustomerWorkspaceSnapshot = {
  available: false,
  forbidden: true,
  ownerControlled: false,
  correlationId: 'bank-error-correlation',
  profile: {
    available: true, id: 'bank-test-user', email: 'bank@example.test', role: 'ACCOUNTING', surfaceRole: 'bank',
    orgId: 'bank-test-org', tenantId: 'bank-test-tenant', membershipId: 'bank-test-membership',
    isOrgAdmin: false, fullName: 'Bank Test', mfaVerified: true, mfaVerifiedAt: '2026-09-27T00:00:00.000Z',
  },
  organization: {
    available: true, organizationId: 'bank-test-org', tenantId: 'bank-test-tenant',
    currentMembershipId: 'bank-test-membership', organizationName: 'Bank Test Organization',
    currentRole: 'ACCOUNTING', isOrganizationAdmin: false, hasFreshMfa: true, members: [],
  },
  items: [],
};

describe('bank first-customer failure states', () => {
  it.each([
    { locale: 'ru', lang: 'ru' },
    { locale: 'en', lang: 'en' },
    { locale: 'zh-CN', lang: 'zh' },
  ].flatMap((entry) => ['deal-bank-42', 'deal/银行?А&1#2'].map((dealId) => ({ ...entry, dealId }))))(
    'preserves $locale on navigation to the exact server-provided Deal $dealId',
    async ({ locale, lang, dealId }) => {
      const serverHref = `/platform-v7/deals/${encodeURIComponent(dealId)}/execution`;
      await renderBankWorkspace({
        ...bankErrorSnapshot,
        available: true,
        forbidden: false,
        correlationId: null,
        items: [{ id: dealId, dealId, status: 'DOCUMENTS_PENDING', nextAction: null, href: serverHref }],
      }, locale);
      const deal = screen.getByRole('link', { name: new RegExp(dealId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) });
      const href = deal.getAttribute('href');
      expect(href).toBe(`${serverHref}?lang=${lang}`);
      const target = new URL(href!, 'https://navigation.example.test');
      expect(target.pathname).toBe(serverHref);
      expect(Array.from(target.searchParams.entries())).toEqual([['lang', lang]]);
      expect(target.hash).toBe('');
      expect(screen.getByText('UNKNOWN', { exact: true })).toBeInTheDocument();
    },
  );

  it('uses a server-shaped Deal snapshot as navigation without turning its nextAction into a bank instruction', async () => {
    await renderBankWorkspace({
      ...bankErrorSnapshot,
      available: true,
      forbidden: false,
      correlationId: null,
      items: [{
        id: 'deal-bank-42', dealId: 'deal-bank-42', status: 'DOCUMENTS_PENDING',
        nextAction: 'Серверная подсказка строки, не решение банка',
        href: '/platform-v7/deals/deal-bank-42/execution',
      }],
    });
    expect(screen.getByText('очередь сделок доступна')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Следующее обязательное действие не опубликовано' })).toBeInTheDocument();
    expect(screen.getByText('UNKNOWN', { exact: true })).toBeInTheDocument();
    const deal = screen.getByRole('link', { name: /deal-bank-42/ });
    expect(deal).toHaveAttribute('href', '/platform-v7/deals/deal-bank-42/execution?lang=ru');
    expect(deal).toHaveTextContent('Открыть сделку для проверки серверных фактов');
    expect(screen.queryByText('Серверная подсказка строки, не решение банка')).not.toBeInTheDocument();
    expect(screen.getByText('Банковские факты — UNKNOWN')).toBeInTheDocument();
  });

  it('preserves the controlled owner self-link instead of describing it as a Deal', async () => {
    const ownerNext = 'Открыть полный рабочий раздел кабинета. Боевые записи не изменяются.';
    await renderBankWorkspace({
      ...bankErrorSnapshot,
      available: true,
      forbidden: false,
      ownerControlled: true,
      correlationId: null,
      profile: { ...bankErrorSnapshot.profile, role: 'PLATFORM_OWNER' },
      items: [{
        id: 'OWNER-BANK-CONTROLLED', dealId: null, status: 'CONTROLLED_TEST',
        nextAction: ownerNext, href: '/platform-v7/bank',
      }],
    });
    const ownerLink = screen.getByRole('link', { name: /OWNER-BANK-CONTROLLED/ });
    expect(ownerLink).toHaveAttribute('href', '/platform-v7/bank');
    expect(ownerLink).toHaveTextContent(ownerNext);
    expect(ownerLink).not.toHaveTextContent('Открыть сделку для проверки серверных фактов');
    expect(screen.queryByText('Банковские факты — UNKNOWN')).not.toBeInTheDocument();
  });

  it.each([
    { locale: 'ru', label: 'Все кабинеты' },
    { locale: 'en', label: 'All cabinets' },
    { locale: 'zh-CN', label: '全部工作台' },
  ])('localizes the controlled owner return link in $locale without changing its destination', async ({ locale, label }) => {
    await renderBankWorkspace({
      ...bankErrorSnapshot,
      available: true,
      forbidden: false,
      ownerControlled: true,
      correlationId: null,
      profile: { ...bankErrorSnapshot.profile, role: 'PLATFORM_OWNER' },
      items: [{ id: 'OWNER-BANK-CONTROLLED', dealId: null, status: 'CONTROLLED_TEST', href: '/platform-v7/bank' }],
    }, locale);
    const returnLink = screen.getByRole('link', { name: label, exact: true });
    expect(returnLink).toHaveAttribute('href', '/platform-v7/staff');
    if (locale !== 'ru') expect(screen.queryByRole('link', { name: 'Все кабинеты', exact: true })).not.toBeInTheDocument();
  });

  it.each(['ru', 'en', 'zh-CN'])('does not expose controlled owner navigation to an ordinary bank participant in %s', async (locale) => {
    await renderBankWorkspace({ ...bankErrorSnapshot, available: true, forbidden: false }, locale);
    expect(screen.getAllByRole('link').some((link) => link.getAttribute('href') === '/platform-v7/staff')).toBe(false);
  });

  it.each([
    { forbidden: true, status: 'доступ запрещён', title: 'Роль не соответствует кабинету' },
    { forbidden: false, status: 'серверная очередь недоступна', title: 'Не подменять недоступный backend' },
  ])('keeps $title explicit without making a bank decision', async ({ forbidden, status, title }) => {
    await renderBankWorkspace({ ...bankErrorSnapshot, forbidden });

    expect(screen.getAllByText(status, { exact: true }).length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
    expect(screen.getByText('Банковские факты — UNKNOWN')).toBeInTheDocument();
    expect(screen.getByText(/Correlation ID: bank-error-correlation/)).toBeInTheDocument();
    expect(screen.queryByText('очередь сделок доступна')).not.toBeInTheDocument();
    expect(screen.queryByText('Сбер')).not.toBeInTheDocument();
  });
});

const workspaceCopy = firstCustomerWorkspace.split('const COPY =')[1]?.split('const ROLE_LABEL:')[0] ?? '';
const workspaceRoleLabels = firstCustomerWorkspace.split('const ROLE_LABEL:')[1]?.split('function localeOf')[0] ?? '';
const workspaceDecision = firstCustomerWorkspace.split('const priorityUnknown = ')[1]?.split('\n  return (')[0] ?? '';
const governedSurfaces = ['buyer', 'bank', 'logistics', 'driver', 'elevator', 'lab', 'surveyor'] as const;
const governedLocales = [
  {
    code: 'ru', priority: 'Главная задача', title: 'Следующее обязательное действие не опубликовано', queue: 'Рабочая очередь',
    labels: { buyer: 'Покупатель', bank: 'Банк', logistics: 'Логистика', driver: 'Водитель', elevator: 'Элеватор', lab: 'Лаборатория', surveyor: 'Сюрвейер' },
  },
  {
    code: 'en', priority: 'Primary task', title: 'Required next action is not published', queue: 'Work queue',
    labels: { buyer: 'Buyer', bank: 'Bank', logistics: 'Logistics', driver: 'Driver', elevator: 'Elevator', lab: 'Laboratory', surveyor: 'Surveyor' },
  },
  {
    code: 'zh', priority: '主要任务', title: '服务器未提供优先执行的操作', queue: '工作队列',
    labels: { buyer: '买方', bank: '银行', logistics: '物流', driver: '司机', elevator: '粮库', lab: '实验室', surveyor: '检验员' },
  },
] as const;

describe('governed first-customer priority source contract', () => {
  it.each(governedLocales.flatMap((locale) => governedSurfaces.map((surface) => ({ locale, surface }))))(
    '$surface keeps $locale.code queue copy separate from priority',
    ({ locale, surface }) => {
      const copy = workspaceCopy.match(new RegExp(`\\b${locale.code}: \\{([\\s\\S]*?)\\n  \\},`))?.[1] ?? '';
      const roles = workspaceRoleLabels.match(new RegExp(`\\b${locale.code}: \\{([^\\n]+)\\}`))?.[1] ?? '';
      expect(copy).toContain(`priority: '${locale.priority}'`);
      expect(copy).toContain(`priorityUnknownTitle: '${locale.title}'`);
      expect(copy).toContain("priorityUnknownResult: 'UNKNOWN'");
      expect(copy).toContain(`workQueue: '${locale.queue}'`);
      expect(roles).toContain(`${surface}: '${locale.labels[surface]}'`);
      expect(workspaceDecision).toContain("state === 'ready' && !workspace.ownerControlled");
      expect(workspaceDecision).toContain("result: priorityUnknown ? copy.priorityUnknownResult");
      expect(workspaceDecision).toContain("href='#first-customer-work-queue'");
      expect(workspaceDecision).toContain("owner: priorityUnknown ? undefined");
      expect(firstCustomerWorkspace).toContain('workspace.items.map((item) => item.href ?');
      expect(firstCustomerWorkspace).toContain("href={surface === 'bank' && !workspace.ownerControlled ? `${item.href}?lang=${locale}` : buyerHref(item.href)}");
    },
  );

  it('preserves controlled owner showroom navigation apart from UNKNOWN priority', () => {
    expect(workspaceDecision).toContain("state === 'ready' ? copy.ownerReadyTitle");
    expect(workspaceDecision).toContain("state === 'ready' ? first?.status");
    expect(workspaceDecision).toContain('first?.href');
    expect(firstCustomerWorkspace).toContain("workspace.ownerControlled && state === 'ready' ? copy.ownerReady");
    expect(firstCustomerWorkspace).toContain("href='/platform-v7/staff'");
  });
});


const buyerSnapshot: FirstCustomerWorkspaceSnapshot = {
  ...bankErrorSnapshot,
  profile: { ...bankErrorSnapshot.profile, role: 'BUYER', surfaceRole: 'buyer' },
  organization: { ...bankErrorSnapshot.organization, currentRole: 'BUYER' },
};

describe('buyer selected-language navigation', () => {
  it.each([
    { locale: 'ru', lang: 'ru' },
    { locale: 'en', lang: 'en' },
    { locale: 'zh-CN', lang: 'zh' },
  ].flatMap((entry) => ['deal-buyer-42', 'deal/银行?А&1#2'].map((dealId) => ({ ...entry, dealId }))))(
    'keeps $locale on the exact server-provided Deal $dealId',
    async ({ locale, lang, dealId }) => {
      const serverHref = `/platform-v7/deals/${encodeURIComponent(dealId)}/execution`;
      await renderBankWorkspace({
        ...buyerSnapshot, available: true, forbidden: false, correlationId: null,
        items: [{ id: dealId, dealId, status: 'DOCUMENTS_PENDING', nextAction: null, href: serverHref }],
      }, locale, 'buyer');
      const link = screen.getAllByRole('link').find((entry) => entry.textContent?.includes(dealId));
      expect(link).toHaveAttribute('href', `${serverHref}?lang=${lang}`);
      const target = new URL(link!.getAttribute('href')!, 'https://navigation.example.test');
      expect(target.pathname).toBe(serverHref);
      expect(Array.from(target.searchParams.entries())).toEqual([['lang', lang]]);
      expect(target.hash).toBe('');
      expect(screen.getByText('UNKNOWN', { exact: true })).toBeInTheDocument();
    },
  );

  it.each(['ru', 'en', 'zh'].flatMap((locale) => [
    { locale, available: true, forbidden: false },
    { locale, available: false, forbidden: false },
    { locale, available: false, forbidden: true },
  ]))('keeps $locale when opening profile/team from available=$available forbidden=$forbidden', async ({ locale, available, forbidden }) => {
    await renderBankWorkspace({ ...buyerSnapshot, available, forbidden }, locale, 'buyer');
    const hrefs = screen.getAllByRole('link').map((link) => link.getAttribute('href'));
    expect(hrefs).toContain(`/platform-v7/profile?lang=${locale}`);
    expect(hrefs).toContain(`/platform-v7/profile/team?lang=${locale}`);
    expect(hrefs).not.toContain('/platform-v7/staff');
  });

  it('preserves the owner-controlled route and return destination', async () => {
    await renderBankWorkspace({
      ...buyerSnapshot, available: true, forbidden: false, ownerControlled: true,
      profile: { ...buyerSnapshot.profile, role: 'PLATFORM_OWNER' },
      items: [{ id: 'OWNER-BUYER-CONTROLLED', dealId: null, status: 'CONTROLLED_TEST', nextAction: null, href: '/platform-v7/buyer/lots' }],
    }, 'en', 'buyer');
    expect(screen.getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual([
      '/platform-v7/buyer/lots', '/platform-v7/staff', '/platform-v7/buyer/lots',
    ]);
  });
});
