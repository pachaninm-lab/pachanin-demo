import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { FirstCustomerSurface, FirstCustomerWorkspaceSnapshot } from '@/lib/first-customer-workspace-server';

vi.mock('next-intl/server', () => ({ getLocale: vi.fn(async () => 'ru') }));
vi.mock('@/lib/first-customer-workspace-server', () => ({ getFirstCustomerWorkspace: vi.fn() }));

import { getLocale } from 'next-intl/server';
import { FirstCustomerWorkspace } from '@/components/platform-v7/FirstCustomerWorkspace';
import { getFirstCustomerWorkspace } from '@/lib/first-customer-workspace-server';

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
