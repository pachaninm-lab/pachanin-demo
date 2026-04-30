import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import PlatformV7DealsPage from '@/app/platform-v7/deals/page';
import PlatformV7DealDetailPage from '@/app/platform-v7/deals/[id]/page';

describe('PlatformV7 deals routes', () => {
  it('renders deals overview with money, risk and execution context', () => {
    render(<PlatformV7DealsPage />);

    expect(screen.getByText('Сделки')).toBeInTheDocument();
    expect(screen.getByText('Операционный обзор сделок')).toBeInTheDocument();
    expect(screen.getByText('Сделки в домене')).toBeInTheDocument();
    expect(screen.getByText('Под удержанием')).toBeInTheDocument();
    expect(screen.getByText('К выпуску')).toBeInTheDocument();
    expect(screen.getByText('Высокий риск')).toBeInTheDocument();
    expect(screen.getAllByRole('link').some((link) => link.getAttribute('href') === '/platform-v7/deals/DL-9102')).toBe(true);
  });

  it('renders deal detail with money guarantees and no production-ready claims', () => {
    render(<PlatformV7DealDetailPage params={{ id: 'DL-9102' }} />);

    expect(screen.getByText('DL-9102')).toBeInTheDocument();
    expect(screen.getByText('Гарантии сделки')).toBeInTheDocument();
    expect(screen.getByText('Резерв денег')).toBeInTheDocument();
    expect(screen.getByText('Документы')).toBeInTheDocument();
    expect(screen.getByText('ФГИС / ЕСИА')).toBeInTheDocument();
    expect(screen.getByText('Спор и удержание')).toBeInTheDocument();
    expect(screen.getByText(/Здесь нет маркетинговых обещаний/)).toBeInTheDocument();
    expect(screen.queryByText(/production-ready/i)).not.toBeInTheDocument();
  });

  it('renders not-found deal state with safe return link', () => {
    render(<PlatformV7DealDetailPage params={{ id: 'DL-NOT-FOUND' }} />);

    expect(screen.getByText(/Сделка не найдена/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Все сделки' })).toHaveAttribute('href', '/platform-v7/deals');
  });
});
