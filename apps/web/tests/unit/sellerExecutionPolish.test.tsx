import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { FirstCustomerSurface, FirstCustomerWorkspaceSnapshot } from '@/lib/first-customer-workspace-server';

vi.mock('next-intl/server', () => ({
  getLocale: vi.fn(async () => 'ru'),
}));

vi.mock('@/lib/first-customer-workspace-server', () => ({
  firstCustomerWorkspaceRequired: () => false,
  getFirstCustomerWorkspace: vi.fn(),
}));

vi.mock('@/lib/deals-server', () => ({
  getDealsSnapshot: vi.fn(),
}));

vi.mock('@/lib/disputes-server', () => ({
  getDisputesSnapshot: vi.fn(),
  openDisputeCount: (disputes: Array<{ status: string }>) =>
    disputes.filter((dispute) => dispute.status === 'OPEN' || dispute.status === 'UNDER_REVIEW').length,
}));

import PlatformV7SellerPage from '@/app/platform-v7/seller/page';
import { getLocale } from 'next-intl/server';
import { FirstCustomerWorkspace } from '@/components/platform-v7/FirstCustomerWorkspace';
import { getFirstCustomerWorkspace } from '@/lib/first-customer-workspace-server';
import { getDealsSnapshot } from '@/lib/deals-server';
import { getDisputesSnapshot } from '@/lib/disputes-server';

const source = readFileSync(resolve(__dirname, '../../app/platform-v7/seller/page.tsx'), 'utf8');
const mockFirstCustomerWorkspace = vi.mocked(getFirstCustomerWorkspace);
const mockDealsSnapshot = vi.mocked(getDealsSnapshot);
const mockDisputesSnapshot = vi.mocked(getDisputesSnapshot);

describe('platform-v7 seller execution polish', () => {
  beforeEach(() => {
    mockFirstCustomerWorkspace.mockReset();
    mockDealsSnapshot.mockReset();
    mockDisputesSnapshot.mockReset();
    mockDealsSnapshot.mockResolvedValue({ deals: [], isApiAvailable: true, isComplete: true });
    mockDisputesSnapshot.mockResolvedValue({ disputes: [], isApiAvailable: true });
  });

  it('renders canonical server deals as navigation without inventing next-best-action priority', async () => {
    mockDealsSnapshot.mockResolvedValue({
      deals: [{
        id: 'deal-canonical-42',
        dealNumber: 'PC-42',
        status: 'DOCUMENTS_PENDING',
        culture: 'Пшеница',
        region: 'Тамбовская область',
      }],
      isApiAvailable: true,
      isComplete: true,
    });

    render(await PlatformV7SellerPage());

    expect(screen.getByRole('heading', { level: 1, name: 'Рабочий кабинет продавца по подтверждённым данным' })).toBeInTheDocument();
    expect(screen.getAllByText('PC-42').length).toBeGreaterThan(0);
    expect(screen.getAllByText('DOCUMENTS_PENDING').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /PC-42/i })).toHaveAttribute(
      'href',
      '/platform-v7/deals/deal-canonical-42/clean',
    );
    expect(screen.getByText(/данные получены из серверного списка сделок/i)).toBeInTheDocument();
    expect(screen.getByText(/Список — навигация по подтверждённым сделкам, а не ранжирование следующего действия/i)).toBeInTheDocument();

    const priority = screen.getByLabelText('Главное обязательство');
    expect(within(priority).getByText('Серверный приоритет действия')).toBeInTheDocument();
    expect(within(priority).getByRole('heading', { name: 'Приоритет бизнес-действия не опубликован' })).toBeInTheDocument();
    expect(within(priority).getByText(/Порядок записей в ответе не превращается в бизнес-приоритет/i)).toBeInTheDocument();
    expect(within(priority).getByRole('link', { name: 'Список сделок' })).toHaveAttribute('href', '#overview');
    expect(within(priority).queryByRole('link', { name: 'Открыть сделку' })).not.toBeInTheDocument();
  });

  it('does not promote create-batch navigation to server priority when the canonical registry is empty', async () => {
    render(await PlatformV7SellerPage());

    const priority = screen.getByLabelText('Главное обязательство');
    expect(within(priority).getByRole('heading', { name: 'Приоритет бизнес-действия не опубликован' })).toBeInTheDocument();
    expect(within(priority).getByText(/не назначает создание партии как обязательный следующий шаг/i)).toBeInTheDocument();
    expect(within(priority).getByRole('link', { name: 'Рабочие маршруты' })).toHaveAttribute('href', '#routes');
    expect(within(priority).queryByRole('link', { name: 'Создать партию' })).not.toBeInTheDocument();
  });

  it('keeps the total deal count unknown when the canonical snapshot is truncated', async () => {
    mockDealsSnapshot.mockResolvedValue({
      deals: [{
        id: 'deal-window-1',
        dealNumber: 'PC-WINDOW-1',
        status: 'ACTIVE',
      }],
      isApiAvailable: true,
      isComplete: false,
    });

    render(await PlatformV7SellerPage());

    expect(screen.getByText('Серверный реестр доступен · итоговое число UNKNOWN')).toBeInTheDocument();
    expect(screen.getByText('1+')).toBeInTheDocument();
    expect(screen.getByText(/в текущем ответе: 1\+ · итоговое число сделок UNKNOWN/i)).toBeInTheDocument();
    expect(screen.getByText(/достигнут предел серверного ответа; итоговое число не выводится как факт/i)).toBeInTheDocument();
  });

  it('fails closed when the canonical deal registry is unavailable', async () => {
    mockDealsSnapshot.mockResolvedValue({ deals: [], isApiAvailable: false, isComplete: false });
    mockDisputesSnapshot.mockResolvedValue({ disputes: [], isApiAvailable: false });

    render(await PlatformV7SellerPage());

    expect(screen.getByRole('heading', { level: 1, name: 'Состояние сделок сейчас не подтверждено' })).toBeInTheDocument();
    expect(screen.getAllByText('UNKNOWN').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/Деловые факты скрыты до получения валидного серверного ответа/i)).toBeInTheDocument();
    expect(screen.queryByText('0 ₽')).not.toBeInTheDocument();
    expect(screen.getByText(/Это техническое восстановление данных, а не назначенное бизнес-действие/i)).toBeInTheDocument();
  });

  it('rejects a malformed deal payload instead of rendering its status as authority', async () => {
    mockDealsSnapshot.mockResolvedValue({
      deals: [{ status: 'SETTLED' }],
      isApiAvailable: true,
      isComplete: true,
    });

    render(await PlatformV7SellerPage());

    expect(screen.getByRole('heading', { level: 1, name: 'Состояние сделок сейчас не подтверждено' })).toBeInTheDocument();
    expect(screen.queryByText('SETTLED')).not.toBeInTheDocument();
  });

  it('keeps the live seller workspace priority unknown while preserving Deal navigation', async () => {
    mockFirstCustomerWorkspace.mockResolvedValue({
      available: true,
      forbidden: false,
      ownerControlled: false,
      correlationId: 'seller-live-test',
      profile: {
        available: true,
        id: 'seller-user',
        email: 'seller@example.test',
        role: 'FARMER',
        surfaceRole: 'seller',
        orgId: 'org-seller',
        tenantId: 'tenant-seller',
        membershipId: 'membership-seller',
        isOrgAdmin: false,
        fullName: 'Seller Test',
        mfaVerified: true,
        mfaVerifiedAt: '2026-09-23T00:00:00.000Z',
      },
      organization: {
        available: true,
        organizationId: 'org-seller',
        tenantId: 'tenant-seller',
        currentMembershipId: 'membership-seller',
        organizationName: 'Seller Org',
        currentRole: 'FARMER',
        isOrganizationAdmin: false,
        hasFreshMfa: true,
        members: [],
      },
      items: [{
        id: 'deal-most-recent',
        dealId: 'deal-most-recent',
        status: 'DOCUMENTS_PENDING',
        nextAction: 'Серверная подсказка строки',
        href: '/platform-v7/deals/deal-most-recent/execution',
      }],
    });

    render(await FirstCustomerWorkspace({ surface: 'seller' }));

    expect(screen.getAllByText('Сервер подтвердил доступ к рабочей очереди продавца. Здесь показаны только доступные продавцу серверные факты; неподтверждённые данные остаются UNKNOWN.')).toHaveLength(2);
    const priority = screen.getByLabelText('Главная задача');
    expect(within(priority).getByRole('heading', { name: 'Следующий обязательный шаг не опубликован' })).toBeInTheDocument();
    expect(within(priority).getByText('UNKNOWN')).toBeInTheDocument();
    expect(within(priority).queryByText('Ответственный')).not.toBeInTheDocument();
    expect(within(priority).getByRole('link', { name: 'Рабочая очередь' })).toHaveAttribute('href', '#first-customer-work-queue');
    expect(within(priority).queryByRole('link', { name: /deal-most-recent/i })).not.toBeInTheDocument();

    const dealRow = screen.getByRole('link', { name: /deal-most-recent/i });
    expect(dealRow).toHaveAttribute('href', '/platform-v7/deals/deal-most-recent/execution');
    expect(screen.getByText('Серверная подсказка строки')).toBeInTheDocument();
  });

  it('removes the previous hard-coded seller story and demo-derived authority', () => {
    for (const literal of [
      'LOT-2403',
      'LOT-2405',
      'DL-9106',
      '9_648_000',
      '9,65 млн ₽',
      '16 120 ₽/т',
      '624 тыс. ₽',
    ]) {
      expect(source).not.toContain(literal);
    }

    expect(source).toContain('getDealsSnapshot');
    expect(source).toContain('getDisputesSnapshot');
    expect(source).toContain("? 'UNKNOWN'");
    expect(source).toContain('dealRegistryComplete');
    expect(source).toContain('Приоритет бизнес-действия не опубликован');
    expect(source).not.toContain('const firstDeal');
    expect(source).not.toContain('RoleExecutionCockpitContent');
    expect(source).not.toContain('MoneyGateRing');
    expect(source).not.toContain('buildDemoPaymentHeatmapData');
    expect(source).not.toContain('DocumentReadinessMiniMatrix');
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
