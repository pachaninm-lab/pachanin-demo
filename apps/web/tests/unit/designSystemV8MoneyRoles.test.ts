import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';

vi.mock('next-intl/server', () => ({ getLocale: vi.fn(async () => 'ru') }));
vi.mock('@/lib/first-customer-workspace-server', () => ({ getFirstCustomerWorkspace: vi.fn() }));

import { getLocale } from 'next-intl/server';
import { FirstCustomerWorkspace } from '@/components/platform-v7/FirstCustomerWorkspace';
import {
  getFirstCustomerWorkspace,
  type FirstCustomerWorkspaceSnapshot,
} from '@/lib/first-customer-workspace-server';

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

const buyerSnapshot: FirstCustomerWorkspaceSnapshot = {
  available: true,
  forbidden: false,
  ownerControlled: false,
  correlationId: 'buyer-correlation',
  profile: {
    available: true, id: 'buyer-user', email: 'buyer@example.test', role: 'BUYER', surfaceRole: 'buyer',
    orgId: 'buyer-org', tenantId: 'buyer-tenant', membershipId: 'buyer-membership', isOrgAdmin: false,
    fullName: 'Buyer Test', mfaVerified: true, mfaVerifiedAt: '2026-09-26T00:00:00.000Z',
  },
  organization: {
    available: true, organizationId: 'buyer-org', tenantId: 'buyer-tenant',
    currentMembershipId: 'buyer-membership', organizationName: 'Buyer Organization',
    currentRole: 'BUYER', isOrganizationAdmin: false, hasFreshMfa: true, members: [],
  },
  items: [{
    id: 'buyer-deal-42', dealId: 'buyer-deal-42', status: 'DOCUMENTS_PENDING', nextAction: null,
    href: '/platform-v7/deals/buyer-deal-42/execution',
  }],
};

const buyerLocales = [
  { locale: 'ru', priority: 'Главная задача', unknown: 'Следующее обязательное действие не опубликовано', note: 'Проверяйте состояние в самой сделке.', empty: 'Рабочих объектов пока нет', forbidden: 'Роль не соответствует кабинету', degraded: 'Не подменять недоступный backend' },
  { locale: 'en', priority: 'Primary task', unknown: 'Required next action is not published', note: 'Check the Deal for its current state.', empty: 'No work objects yet', forbidden: 'Role does not match this cabinet', degraded: 'Do not substitute an unavailable backend' },
  { locale: 'zh', priority: '主要任务', unknown: '服务器未提供优先执行的操作', note: '请在交易详情中核查状态。', empty: '暂时没有工作对象', forbidden: '角色与此工作空间不匹配', degraded: '不得替换不可用的 backend' },
] as const;

describe('rendered buyer first-customer workspace', () => {
  beforeEach(() => {
    vi.mocked(getLocale).mockReset();
    vi.mocked(getFirstCustomerWorkspace).mockReset();
  });

  it.each(buyerLocales)('renders $locale ready Deal navigation with UNKNOWN priority', async ({ locale, priority, unknown, note }) => {
    vi.mocked(getLocale).mockResolvedValue(locale);
    vi.mocked(getFirstCustomerWorkspace).mockResolvedValue(buyerSnapshot);

    render(await FirstCustomerWorkspace({ surface: 'buyer' }));

    const primary = screen.getByLabelText(priority);
    expect(within(primary).getByRole('heading', { name: unknown })).toBeInTheDocument();
    expect(within(primary).getByText('UNKNOWN')).toBeInTheDocument();
    expect(within(primary).getByRole('link')).toHaveAttribute('href', '#first-customer-work-queue');
    expect(screen.getByText(new RegExp(note.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /buyer-deal-42/i })).toHaveAttribute('href', '/platform-v7/deals/buyer-deal-42/execution');
  });

  it.each(buyerLocales)('keeps $locale empty, forbidden and degraded queues honest', async ({ locale, empty, forbidden, degraded, note }) => {
    vi.mocked(getLocale).mockResolvedValue(locale);
    const scenarios = [
      { title: empty, snapshot: { ...buyerSnapshot, items: [] } },
      { title: forbidden, snapshot: { ...buyerSnapshot, available: false, forbidden: true, profile: { ...buyerSnapshot.profile, role: 'FARMER' }, items: [] } },
      { title: degraded, snapshot: { ...buyerSnapshot, available: false, organization: { ...buyerSnapshot.organization, available: false, organizationName: null }, items: [] } },
    ];

    for (const { title, snapshot } of scenarios) {
      vi.mocked(getFirstCustomerWorkspace).mockResolvedValue(snapshot);
      const view = render(await FirstCustomerWorkspace({ surface: 'buyer' }));
      expect(screen.getAllByRole('heading', { name: title }).length).toBeGreaterThan(0);
      expect(screen.queryByText(new RegExp(note.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /buyer-deal-42/i })).not.toBeInTheDocument();
      view.unmount();
    }
  });

  it.each(buyerLocales)('keeps $locale owner-controlled showroom separate from customer queue', async ({ locale, note }) => {
    vi.mocked(getLocale).mockResolvedValue(locale);
    vi.mocked(getFirstCustomerWorkspace).mockResolvedValue({
      ...buyerSnapshot,
      ownerControlled: true,
      profile: { ...buyerSnapshot.profile, role: 'PLATFORM_OWNER' },
      items: [{ id: 'OWNER-BUYER-CONTROLLED', dealId: null, status: 'CONTROLLED_TEST', nextAction: null, href: '/platform-v7/buyer/lots' }],
    });

    render(await FirstCustomerWorkspace({ surface: 'buyer' }));

    expect(screen.queryByText(new RegExp(note.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /buyer-deal-42/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /OWNER-BUYER-CONTROLLED/i })).toHaveAttribute('href', '/platform-v7/buyer/lots');
  });
});

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
      expect(firstCustomerWorkspace).toContain('href={item.href}');
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
