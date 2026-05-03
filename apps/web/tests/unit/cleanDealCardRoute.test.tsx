import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import PlatformV7CleanDealPage from '@/app/platform-v7/deals/[id]/clean/page';

describe('PlatformV7 clean deal card route', () => {
  it('renders real deal data, money and execution workspace', () => {
    render(<PlatformV7CleanDealPage params={{ id: 'DL-9102' }} />);

    expect(screen.getByText('Карточка сделки · пилотный контур')).toBeInTheDocument();
    expect(screen.getByText('DL-9102')).toBeInTheDocument();
    expect(screen.getByText('Резерв денег')).toBeInTheDocument();
    expect(screen.getByText('Удержание')).toBeInTheDocument();
    expect(screen.getByText('К выпуску')).toBeInTheDocument();
    expect(screen.getByText('Рабочая зона сделки · тестовый контур')).toBeInTheDocument();
    expect(screen.getByText(/Источник: Сбер · тестовый контур/)).toBeInTheDocument();
  });

  it('renders safe not found state', () => {
    render(<PlatformV7CleanDealPage params={{ id: 'DL-NOT-FOUND' }} />);

    expect(screen.getByText('Сделка не найдена')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Все сделки' })).toHaveAttribute('href', '/platform-v7/deals');
  });
});
