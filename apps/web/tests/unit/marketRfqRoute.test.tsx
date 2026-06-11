import React from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import MarketRfqPage from '@/app/platform-v7/market-rfq/page';

describe('MarketRfqPage', () => {
  it('renders market rfq sandbox boundary', () => {
    render(<MarketRfqPage />);

    expect(screen.getByText('Лоты, заявки и оферты')).toBeInTheDocument();
    expect(screen.getAllByText(/Предсделочный контур/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/лот или RFQ не равны сделке/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Боевые торги здесь не заявляются/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/нет боевых торгов, биржевой функции, автоматического заключения договора или списания денег/).length).toBeGreaterThan(0);
  });

  it('renders market metrics and navigation links', () => {
    render(<MarketRfqPage />);

    expect(screen.getAllByText('Лоты').length).toBeGreaterThan(0);
    expect(screen.getAllByText('RFQ').length).toBeGreaterThan(0);
    expect(screen.getByText('Оферты')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Текущие лоты' })).toHaveAttribute('href', '/platform-v7/lots');
    expect(screen.getByRole('link', { name: 'Башня управления' })).toHaveAttribute('href', '/platform-v7/control-tower');
  });

  it('renders lots tab by default from sandbox fixtures', () => {
    render(<MarketRfqPage />);

    expect(screen.getAllByText(/Паспорт партии/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Цена/т').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Сумма').length).toBeGreaterThan(0);
  });

  it('switches to rfq tab and renders buyer demand without creating a deal', () => {
    render(<MarketRfqPage />);

    fireEvent.click(screen.getByRole('button', { name: 'RFQ' }));

    expect(screen.getAllByText('Целевая цена').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Maturity').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/т спроса/).length).toBeGreaterThan(0);
  });

  it('switches to offers tab and shows acceptance guard copy', () => {
    render(<MarketRfqPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Оферты' }));

    expect(screen.getAllByText('Можно принять').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Acceptance не создаёт сделку автоматически/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/проверка контрагента, документов, ФГИС и банкового резерва/).length).toBeGreaterThan(0);
  });
});
