import React from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MarketEntryFoundation } from '@/components/platform-v7/MarketEntryFoundation';
import { MARKET_ENTRY_FLOW, marketEntryStatusLabel } from '@/lib/platform-v7/market-entry-foundation';

describe('MarketEntryFoundation', () => {
  it('keeps the pre-deal flow tied to execution', () => {
    expect(MARKET_ENTRY_FLOW.map((item) => item.title)).toEqual(['Цена', 'Заявка', 'Предложение', 'Проверка', 'Сделка', 'Исполнение']);
    expect(marketEntryStatusLabel('source_required')).toBe('нужен источник');
  });

  it('renders price, logistics and launch gate', () => {
    render(<MarketEntryFoundation />);

    expect(screen.getByText('Рынок и заявки')).toBeInTheDocument();
    expect(screen.getByText('1. Цена с источником')).toBeInTheDocument();
    expect(screen.getByText('Gate запуска сделки')).toBeInTheDocument();
    expect(screen.getByText(/Цена до точки/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Оферты и RFQ' })).toHaveAttribute('href', '/platform-v7/market-rfq');
    expect(screen.getByRole('link', { name: 'Создать лот' })).toHaveAttribute('href', '/platform-v7/lots/create');
  });

  it('creates a trade intent in the current workspace session', () => {
    render(<MarketEntryFoundation />);

    fireEvent.click(screen.getByRole('button', { name: 'Создать намерение' }));

    expect(screen.getByText(/Продажа · Пшеница 4 класса/)).toBeInTheDocument();
    expect(screen.getByText(/220 т/)).toBeInTheDocument();
  });
});
