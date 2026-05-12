import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SupportIndexPage } from '@/components/platform-v7/SupportIndexPage';

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

vi.mock('@/stores/usePlatformV7RStore', () => ({
  usePlatformV7RStore: (selector: (state: { role: string }) => unknown) => selector({ role: activeRole }),
}));

vi.mock('@/lib/platform-v7/support-client-store', () => ({
  useSupportCases: () => ({ cases: [supportCase], messages: [] }),
}));

vi.mock('@/lib/platform-v7/support-helpers', () => ({
  SUPPORT_CATEGORY_LABELS: { logistics: 'Логистика' },
  SUPPORT_MATURITY_LABEL: 'Тестовый контур',
  SUPPORT_PRIORITY_LABELS: { P1: 'Срочно' },
  SUPPORT_STATUS_LABELS: { open: 'Открыто' },
  supportFormatRub: (value: number) => `${value.toLocaleString('ru-RU')} ₽`,
  supportLastMessage: () => 'Последнее сообщение по обращению',
  supportObjectLabel: () => 'Рейс TRIP-SIM-001',
  supportSortCases: (cases: typeof supportCase[]) => cases,
}));

describe('SupportIndexPage role scope', () => {
  it('hides operator queue and money from driver support view', () => {
    activeRole = 'driver';

    render(<SupportIndexPage />);

    expect(screen.getByText('Помощь по моему рейсу')).toBeInTheDocument();
    expect(screen.getByText(/операторские очереди, суммы риска и банковские данные скрыты/i)).toBeInTheDocument();
    expect(screen.queryByText('Деньги под риском')).not.toBeInTheDocument();
    expect(screen.queryByText('Операторская очередь')).not.toBeInTheDocument();
    expect(screen.queryByText(/23\s?140\s?000 ₽/)).not.toBeInTheDocument();
  });

  it('keeps operator support metrics visible for operator role', () => {
    activeRole = 'operator';

    render(<SupportIndexPage />);

    expect(screen.getByText('Центр поддержки исполнения сделки')).toBeInTheDocument();
    expect(screen.getByText('Деньги под риском')).toBeInTheDocument();
    expect(screen.getByText('Операторская очередь')).toBeInTheDocument();
    expect(screen.getByText('Открыть очередь')).toBeInTheDocument();
  });
});
