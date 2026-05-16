import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SupportCaseView } from '@/components/platform-v7/SupportCaseView';
import { SupportNewCaseScopedClient } from '@/components/platform-v7/SupportNewCaseScopedClient';

let activeRole = 'driver';

const supportCase = {
  id: 'SUP-001',
  title: 'Проблема с фото пломбы',
  description: 'Не получается приложить фото',
  status: 'open',
  priority: 'P1',
  category: 'logistics',
  requesterRole: 'driver',
  relatedEntityType: 'trip',
  relatedEntityId: 'TRIP-SIM-001',
  dealId: 'DL-9106',
  lotId: 'LOT-2403',
  tripId: 'TRIP-SIM-001',
  moneyAtRiskRub: 23_140_000,
  blocker: 'Фото пломбы не приложено',
  owner: 'operator',
  nextAction: 'Приложить фото пломбы',
  slaDueAt: '2026-05-12T16:00:00.000Z',
  createdAt: '2026-05-12T10:00:00.000Z',
  updatedAt: '2026-05-12T10:20:00.000Z',
};

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/stores/usePlatformV7RStore', () => ({
  usePlatformV7RStore: (selector: (state: { role: string }) => unknown) => selector({ role: activeRole }),
}));

vi.mock('@/lib/platform-v7/support-client-store', () => ({
  useSupportCases: () => ({ createCase: vi.fn() }),
}));

vi.mock('@/lib/platform-v7/support-helpers', () => ({
  SUPPORT_CATEGORY_LABELS: { logistics: 'Логистика' },
  SUPPORT_PRIORITY_LABELS: { P1: 'Срочно' },
  SUPPORT_STATUS_LABELS: { open: 'Открыто' },
  supportAuditTransitionLabel: () => null,
  supportCategoryByText: () => 'logistics',
  supportFormatRub: (value: number) => `${value.toLocaleString('ru-RU')} ₽`,
  supportLinkedExecutionHref: () => '/platform-v7/driver/field',
  supportObjectLabel: () => 'Рейс TRIP-SIM-001',
  supportOwner: () => 'Логистика',
  supportPriority: () => 'P1',
  supportSlaDueAt: () => '2026-05-12T16:00:00.000Z',
  supportSlaHours: () => 4,
  supportSlaLabel: () => 'Срок 4 ч.',
  supportSortedAuditEvents: (events: unknown[]) => events,
  supportStatusByOwner: () => 'open',
}));

describe('support detail and new case role scope', () => {
  it('hides operator queue, owner and money from driver support detail', () => {
    activeRole = 'driver';

    render(<SupportCaseView item={supportCase as never} messages={[]} audit={[]} />);

    expect(screen.getByText('Проблема с фото пломбы')).toBeInTheDocument();
    expect(screen.queryByText('Операторская очередь')).not.toBeInTheDocument();
    expect(screen.queryByText('Ответственный')).not.toBeInTheDocument();
    expect(screen.queryByText('Деньги под риском')).not.toBeInTheDocument();
    expect(screen.queryByText(/23\s?140\s?000 ₽/)).not.toBeInTheDocument();
  });

  it('keeps operator queue and money visible for operator support detail', () => {
    activeRole = 'operator';

    render(<SupportCaseView item={supportCase as never} messages={[]} audit={[]} />);

    expect(screen.getByText('Операторская очередь')).toBeInTheDocument();
    expect(screen.getByText('Ответственный')).toBeInTheDocument();
    expect(screen.getByText('Деньги под риском')).toBeInTheDocument();
  });

  it('uses field-safe new case form for driver', () => {
    activeRole = 'driver';

    render(<SupportNewCaseScopedClient defaults={supportCase as never} />);

    expect(screen.getByText('Сообщить о проблеме по рейсу')).toBeInTheDocument();
    expect(screen.queryByText('Роль')).not.toBeInTheDocument();
    expect(screen.queryByText('ID сделки')).not.toBeInTheDocument();
    expect(screen.queryByText('ID лота')).not.toBeInTheDocument();
    expect(screen.queryByText('Деньги под риском')).not.toBeInTheDocument();
    expect(screen.queryByText('Ответственный')).not.toBeInTheDocument();
  });
});
