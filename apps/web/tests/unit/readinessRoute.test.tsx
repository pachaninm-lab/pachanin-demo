import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import PlatformV7ReadinessPage from '@/app/platform-v7/readiness/page';

describe('PlatformV7ReadinessPage', () => {
  it('renders readiness sandbox/operator boundary', () => {
    render(<PlatformV7ReadinessPage />);

    expect(screen.getByText('Готовность сделки к исполнению и выпуску денег')).toBeInTheDocument();
    expect(screen.getByText(/Матрица готовности · песочница/)).toBeInTheDocument();
    expect(screen.getByText(/Это не платёжный механизм/)).toBeInTheDocument();
    expect(screen.getByText(/проверочная панель оператора/)).toBeInTheDocument();
  });

  it('renders readiness metrics and execution strip', () => {
    render(<PlatformV7ReadinessPage />);

    expect(screen.getByText('Готовы полностью')).toBeInTheDocument();
    expect(screen.getByText('С блокерами')).toBeInTheDocument();
    expect(screen.getByText('Под удержанием')).toBeInTheDocument();
    expect(screen.getByText(/ФГИС/)).toBeInTheDocument();
    expect(screen.getByText(/Документы/)).toBeInTheDocument();
    expect(screen.getByText(/Логистика/)).toBeInTheDocument();
    expect(screen.getByText(/Банк/)).toBeInTheDocument();
  });

  it('renders DL-9102 readiness card and money lock state', () => {
    render(<PlatformV7ReadinessPage />);

    expect(screen.getByText(/DL-9102/)).toBeInTheDocument();
    expect(screen.getByText(/Демо-сделка/)).toBeInTheDocument();
    expect(screen.getByText(/Выпуск:/)).toBeInTheDocument();
    expect(screen.getByText(/Блокеры:/)).toBeInTheDocument();
  });

  it('uses stable route links', () => {
    render(<PlatformV7ReadinessPage />);

    expect(screen.getByRole('link', { name: 'Центр управления' })).toHaveAttribute('href', '/platform-v7/control-tower');
    expect(screen.getByRole('link', { name: 'Проверка денег' })).toHaveAttribute('href', '/platform-v7/bank/release-safety');
    expect(screen.getAllByRole('link').some((link) => link.getAttribute('href')?.startsWith('/platform-v7/deals/'))).toBe(true);
  });
});
