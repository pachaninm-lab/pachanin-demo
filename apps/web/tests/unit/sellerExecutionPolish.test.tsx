import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';

vi.mock('@/lib/first-customer-workspace-server', () => ({
  firstCustomerWorkspaceRequired: () => false,
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
import { getDealsSnapshot } from '@/lib/deals-server';
import { getDisputesSnapshot } from '@/lib/disputes-server';

const source = readFileSync(resolve(__dirname, '../../app/platform-v7/seller/page.tsx'), 'utf8');
const mockDealsSnapshot = vi.mocked(getDealsSnapshot);
const mockDisputesSnapshot = vi.mocked(getDisputesSnapshot);

describe('platform-v7 seller execution polish', () => {
  beforeEach(() => {
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
