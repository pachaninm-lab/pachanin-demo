import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
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
  holdAmount: 120000,
  riskScore: 68,
  slaDeadline: null,
  blockers: ['docs', 'fgis'],
  releaseAmount: 3780000,
};

describe('P7DealWorkspaceTabs', () => {
  it('shows Russian deal workspace and fact sources', () => {
    render(<P7DealWorkspaceTabs deal={deal} />);

    expect(screen.getByText('Рабочая зона сделки · тестовый контур')).toBeInTheDocument();
    expect(screen.getByText('Доказательства')).toBeInTheDocument();
    expect(screen.getByText(/Источник: Сбер · тестовый контур/)).toBeInTheDocument();
    expect(screen.getByText(/Источник: ФГИС · ручная проверка/)).toBeInTheDocument();
    expect(screen.getByText(/Источник: Сфера Перевозки · модель ЭПД/)).toBeInTheDocument();
  });
});
