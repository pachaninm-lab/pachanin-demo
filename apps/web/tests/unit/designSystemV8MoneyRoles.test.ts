import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { FirstCustomerSurface, FirstCustomerWorkspaceSnapshot } from '@/lib/first-customer-workspace-server';

vi.mock('next-intl/server', () => ({ getLocale: vi.fn(async () => 'ru') }));
vi.mock('@/lib/first-customer-workspace-server', () => ({
  firstCustomerWorkspaceRequired: () => false,
  getFirstCustomerWorkspace: vi.fn(),
}));

import { getLocale } from 'next-intl/server';
import { FirstCustomerWorkspace } from '@/components/platform-v7/FirstCustomerWorkspace';
import { getFirstCustomerWorkspace } from '@/lib/first-customer-workspace-server';

const repoRoot = path.resolve(process.cwd(), '../..');
const read = (relativePath: string) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const seller = read('apps/web/app/platform-v7/seller/page.tsx');
const buyer = read('apps/web/app/platform-v7/buyer/page.tsx');
const bank = read('apps/web/app/platform-v7/bank/page.tsx');
const firstCustomerWorkspace = read('apps/web/components/platform-v7/FirstCustomerWorkspace.tsx');
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

const surfaces: FirstCustomerSurface[] = ['buyer', 'bank', 'logistics', 'driver', 'elevator', 'lab', 'surveyor'];
const locales = [
  { code: 'ru', priority: 'Главная задача', title: 'Следующее обязательное действие не опубликовано', queue: 'Рабочая очередь' },
  { code: 'en', priority: 'Primary task', title: 'Required next action is not published', queue: 'Work queue' },
  { code: 'zh', priority: '主要任务', title: '服务器未提供优先执行的操作', queue: '工作队列' },
] as const;

function snapshot(ownerControlled = false): FirstCustomerWorkspaceSnapshot {
  return {
    available: true,
    forbidden: false,
    ownerControlled,
    correlationId: null,
    profile: {
      available: true, id: 'user-1', email: 'user@example.test', role: 'BUYER', surfaceRole: 'buyer',
      orgId: 'org-1', tenantId: 'tenant-1', membershipId: 'membership-1', isOrgAdmin: false,
      fullName: 'Test User', mfaVerified: true, mfaVerifiedAt: '2026-09-24T00:00:00.000Z',
    },
    organization: {
      available: true, organizationId: 'org-1', tenantId: 'tenant-1', currentMembershipId: 'membership-1',
      organizationName: 'Test Organization', currentRole: 'BUYER', isOrganizationAdmin: false,
      hasFreshMfa: true, members: [],
    },
    items: [
      { id: 'most-recent', dealId: 'most-recent', status: 'RECENT', nextAction: 'Row hint', href: '/platform-v7/deals/most-recent/execution' },
      { id: 'older', dealId: 'older', status: 'OLDER', nextAction: null, href: '/platform-v7/deals/older/execution' },
    ],
  };
}

describe('first customer workspace queue-order boundary', () => {
  beforeEach(() => {
    vi.mocked(getLocale).mockResolvedValue('ru');
    vi.mocked(getFirstCustomerWorkspace).mockReset();
  });

  it.each(locales.flatMap((locale) => surfaces.map((surface) => ({ ...locale, surface }))))(
    '$surface keeps $code queue navigation separate from business priority',
    async ({ code, priority, title, queue, surface }) => {
      vi.mocked(getLocale).mockResolvedValue(code);
      vi.mocked(getFirstCustomerWorkspace).mockResolvedValue(snapshot());
      render(await FirstCustomerWorkspace({ surface }));

      const decision = screen.getByLabelText(priority);
      expect(within(decision).getByRole('heading', { name: title })).toBeInTheDocument();
      expect(within(decision).getByText('UNKNOWN')).toBeInTheDocument();
      expect(within(decision).getByRole('link', { name: queue })).toHaveAttribute('href', '#first-customer-work-queue');
      expect(within(decision).queryByText('RECENT')).not.toBeInTheDocument();
      expect(within(decision).queryByRole('link', { name: /most-recent/i })).not.toBeInTheDocument();
      expect(screen.getByRole('link', { name: /most-recent/i })).toHaveAttribute('href', '/platform-v7/deals/most-recent/execution');
      expect(screen.getByRole('link', { name: /older/i })).toHaveAttribute('href', '/platform-v7/deals/older/execution');
    },
  );

  it('preserves controlled owner showroom navigation as a distinct mode', async () => {
    vi.mocked(getFirstCustomerWorkspace).mockResolvedValue({
      ...snapshot(true),
      items: [{ id: 'OWNER-BANK-CONTROLLED', dealId: null, status: 'CONTROLLED_TEST', nextAction: null, href: '/platform-v7/bank' }],
    });
    render(await FirstCustomerWorkspace({ surface: 'bank' }));

    const decision = screen.getByLabelText('Главная задача');
    expect(within(decision).getByRole('heading', { name: 'Открыть рабочий раздел кабинета' })).toBeInTheDocument();
    expect(within(decision).getByRole('link', { name: 'Открыть' })).toHaveAttribute('href', '/platform-v7/bank');
    expect(within(decision).queryByText('UNKNOWN')).not.toBeInTheDocument();
  });
});
