import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import PlatformV7CleanDealPage from '@/app/platform-v7/deals/[id]/clean/page';

describe('PlatformV7 clean deal card route', () => {
  it('renders real deal data, money and execution workspace', () => {
    render(<PlatformV7CleanDealPage params={{ id: 'DL-9102' }} />);

    expect(screen.getByText('Карточка сделки · контур исполнения')).toBeInTheDocument();
    expect(screen.getAllByText('DL-9102').length).toBeGreaterThan(0);
    expect(screen.getByText('Резерв денег')).toBeInTheDocument();
    expect(screen.getAllByText('Удержание').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/К выплате/).length).toBeGreaterThan(0);
    expect(screen.getByText('Рабочая зона сделки · предынтеграционный контур')).toBeInTheDocument();
    expect(screen.getByText(/Источник: Сбер · предынтеграционный контур/)).toBeInTheDocument();
  });

  it('renders release guard money stop reasons on the deal card', () => {
    render(<PlatformV7CleanDealPage params={{ id: 'DL-9102' }} />);

    expect(screen.getByText('Что сейчас невозможно')).toBeInTheDocument();
    expect(screen.getByText(/документы не закрыты|ФГИС\/СДИЗ не подтверждены|есть активное удержание|стадия сделки не готова к выплате/)).toBeInTheDocument();
  });

  it('renders safe not found state', () => {
    render(<PlatformV7CleanDealPage params={{ id: 'DL-NOT-FOUND' }} />);

    expect(screen.getByText('Сделка не найдена')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Все сделки' })).toHaveAttribute('href', '/platform-v7/deals');
  });
});
