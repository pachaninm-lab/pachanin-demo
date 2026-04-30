import React from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import MarketRfqPage from '@/app/platform-v7/market-rfq/page';

describe('MarketRfqPage', () => {
  it('renders market rfq sandbox boundary', () => {
    render(<MarketRfqPage />);

    expect(screen.getByText('Лоты, заявки и оферты')).toBeInTheDocument();
    expect(screen.getByText(/Предсделочный контур/)).toBeInTheDocument();
    expect(screen.getByText(/лот или RFQ не равны сделке/)).toBeInTheDocument();
    expect(screen.getByText(/Live-торги здесь не заявляются/)).toBeInTheDocument();
    expect(screen.getByText(/нет боевых торгов, биржевой функции, автоматического заключения договора или списания денег/)).toBeInTheDocument();
  });

  it('renders market metrics and navigation links', () => {
    render(<MarketRfqPage />);

    expect(screen.getByText('Лоты')).toBeInTheDocument();
    expect(screen.getByText('RFQ')).toBeInTheDocument();
    expect(screen.getByText('Оферты')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Текущие лоты' })).toHaveAttribute('href', '/platform-v7/lots');
    expect(screen.getByRole('link', { name: 'Башня управления' })).toHaveAttribute('href', '/platform-v7/control-tower');
  });

  it('renders lots tab by default from sandbox fixtures', () => {
    render(<MarketRfqPage />);

    expect(screen.getByText(/Паспорт партии/)).toBeInTheDocument();
    expect(screen.getAllByText('Цена/т').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Сумма').length).toBeGreaterThan(0);
  });

  it('switches to rfq tab and renders buyer demand without creating a deal', () => {
    render(<MarketRfqPage />);

    fireEvent.click(screen.getByRole('button', { name: 'RFQ' }));

    expect(screen.getByText('Целевая цена')).toBeInTheDocument();
    expect(screen.getByText('Maturity')).toBeInTheDocument();
    expect(screen.getByText(/т спроса/)).toBeInTheDocument();
  });

  it('switches to offers tab and shows acceptance guard copy', () => {
    render(<MarketRfqPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Оферты' }));

    expect(screen.getByText('Можно принять')).toBeInTheDocument();
    expect(screen.getByText(/Acceptance не создаёт сделку автоматически/)).toBeInTheDocument();
    expect(screen.getByText(/проверка контрагента, документов, ФГИС и банкового резерва/)).toBeInTheDocument();
  });
});
