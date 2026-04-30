import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import LogisticsPage from '@/app/platform-v7/logistics/page';

describe('LogisticsPage', () => {
  it('renders logistics dispatcher sandbox boundary', () => {
    render(<LogisticsPage />);

    expect(screen.getByText('Диспетчерская')).toBeInTheDocument();
    expect(screen.getByText(/Логистический заказ привязан к сделке/)).toBeInTheDocument();
    expect(screen.getByText(/заказ → рейсы → инциденты → транспортный gate/)).toBeInTheDocument();
    expect(screen.getByText(/Live GPS, перевозчик и ЭДО здесь не заявляются/)).toBeInTheDocument();
  });

  it('renders key logistics metrics and incident block', () => {
    render(<LogisticsPage />);

    expect(screen.getByText('В пути')).toBeInTheDocument();
    expect(screen.getByText('Прибыли')).toBeInTheDocument();
    expect(screen.getByText('Инцидентов')).toBeInTheDocument();
    expect(screen.getByText('Сделок охвачено')).toBeInTheDocument();
    expect(screen.getByText(/Открытые инциденты/)).toBeInTheDocument();
  });

  it('renders logistics orders linked to deals and route legs', () => {
    render(<LogisticsPage />);

    expect(screen.getByText('Логистические заказы')).toBeInTheDocument();
    expect(screen.getAllByText(/Сделка/).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link').some((link) => link.getAttribute('href')?.startsWith('/platform-v7/deals/'))).toBe(true);
    expect(screen.getByText('Рейсы')).toBeInTheDocument();
    expect(screen.getByText(/Транспортный gate/)).toBeInTheDocument();
  });

  it('renders DL-9102 logistics card without live GPS or EDO claims', () => {
    render(<LogisticsPage />);

    expect(screen.getByText(/DL-9102/)).toBeInTheDocument();
    expect(screen.getByText(/Транспортный gate:/)).toBeInTheDocument();
    expect(screen.getByText(/Live GPS, ЭДО и боевой перевозчик здесь не заявляются/)).toBeInTheDocument();
  });

  it('links back to control tower', () => {
    render(<LogisticsPage />);

    expect(screen.getByRole('link', { name: 'Башня управления' })).toHaveAttribute('href', '/platform-v7/control-tower');
  });
});
