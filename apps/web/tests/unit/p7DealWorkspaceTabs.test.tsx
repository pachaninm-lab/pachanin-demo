import React from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { DomainDeal } from '@/lib/domain/types';
import { P7DealWorkspaceTabs } from '@/components/platform-v7/P7DealWorkspaceTabs';

const deal: DomainDeal = {
  id: 'DL-9102',
  version: 1,
  sourceOfTruth: 'MANUAL',
  createdAt: '2026-05-01T09:00:00.000Z',
  updatedAt: '2026-05-03T09:00:00.000Z',
  grain: 'Пшеница 4 класс',
  quantity: 240,
  unit: 'т',
  seller: { name: 'ООО Зерно Юг' },
  buyer: { name: 'АО Мукомол' },
  status: 'release_requested',
  reservedAmount: 3900000,
  holdAmount: 0,
  riskScore: 68,
  slaDeadline: null,
  blockers: [],
  releaseAmount: 3780000,
};

describe('P7DealWorkspaceTabs', () => {
  it('keeps bank and document facts unknown without a server binding', () => {
    render(<P7DealWorkspaceTabs deal={deal} />);

    expect(screen.getByText('Рабочая зона сделки · runtime-контур')).toBeInTheDocument();
    expect(screen.getByText(/Внешний банк, ФГИС, ЭДО и перевозчик не считаются источниками фактов/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Деньги' }));
    expect(screen.getByText('Привязка банка к сделке')).toBeInTheDocument();
    expect(screen.getByText('Неизвестно / не опубликовано (UNKNOWN / NOT EXPOSED)')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Документы' }));
    expect(screen.getAllByText('Неизвестно / не опубликовано (UNKNOWN / NOT EXPOSED)')).toHaveLength(3);
  });

  it.each([
    {
      hasDispute: true,
      holdAmount: 0,
      title: 'Спор указан в данных сделки',
      detail: /удержанная сумма равна нулю/,
      attention: true,
    },
    {
      hasDispute: true,
      holdAmount: 120000,
      title: 'Спор указан в данных сделки',
      detail: /удержано\. Исход спора/,
      attention: true,
    },
    {
      hasDispute: false,
      holdAmount: 120000,
      title: 'Удержание без опубликованного спора',
      detail: /Сведения о споре в этом чтении сделки не опубликованы/,
      attention: true,
    },
    {
      hasDispute: false,
      holdAmount: 0,
      title: 'Спор не указан в данных сделки',
      detail: /не подтверждает отсутствие внешнего разбирательства/,
      attention: false,
    },
  ])('shows dispute=$hasDispute with hold=$holdAmount without hiding attention', ({ hasDispute, holdAmount, title, detail, attention }) => {
    render(<P7DealWorkspaceTabs deal={{ ...deal, holdAmount, dispute: hasDispute ? { id: 'DSP-1' } : undefined }} />);

    const disputeTab = screen.getByRole('button', { name: attention ? 'Спор 1' : 'Спор' });
    if (attention) {
      expect(screen.getByText('1 блок. в данных сделки')).toBeInTheDocument();
    } else {
      expect(screen.getByText('В данных сделки блокеры не указаны · внешние факты неизвестны')).toBeInTheDocument();
    }

    fireEvent.click(disputeTab);
    expect(screen.getByText(title)).toBeInTheDocument();
    expect(screen.getByText(detail)).toBeInTheDocument();
    expect(screen.queryByText('Спора нет')).not.toBeInTheDocument();
  });

  it('counts an existing dispute blocker once even when a hold is also present', () => {
    render(<P7DealWorkspaceTabs deal={{ ...deal, dispute: { id: 'DSP-1' }, holdAmount: 120000, blockers: ['dispute', 'docs'] }} />);

    expect(screen.getByText('2 блок. в данных сделки')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Спор 1' })).toBeInTheDocument();
    expect(screen.queryByText('3 блок. в данных сделки')).not.toBeInTheDocument();
  });
});
