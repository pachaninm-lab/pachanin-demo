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

  it('renders consistency links between deal detail, readiness, money, logistics, dispute and domain core', () => {
    render(<PlatformV7DealDetailPage params={{ id: 'DL-9102' }} />);

    expect(screen.getByText('Связанные контуры сделки')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Готовность/ })).toHaveAttribute('href', '/platform-v7/readiness');
    expect(screen.getByRole('link', { name: /Проверка денег/ })).toHaveAttribute('href', '/platform-v7/bank/release-safety');
    expect(screen.getByRole('link', { name: /Банк/ })).toHaveAttribute('href', '/platform-v7/bank');
    expect(screen.getByRole('link', { name: /Логистика/ }).getAttribute('href')).toMatch(/^\/platform-v7\/logistics/);
    expect(screen.getByRole('link', { name: /Спор \/ пакет доказательств/ }).getAttribute('href')).toMatch(/^\/platform-v7\/disputes/);
    expect(screen.getByRole('link', { name: /Движок сделки/ })).toHaveAttribute('href', '/platform-v7/domain-core');
  });

  it('renders deal workspace fact sources without live integration claims', () => {
    render(<PlatformV7DealDetailPage params={{ id: 'DL-9102' }} />);

    expect(screen.getByText('Рабочая зона сделки · тестовый контур')).toBeInTheDocument();
    expect(screen.getByText(/Источник: Сбер · тестовый контур/)).toBeInTheDocument();
    expect(screen.getByText(/Источник: ФГИС · ручная проверка/)).toBeInTheDocument();
    expect(screen.queryByText(/Deal Workspace/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/sandbox-aware/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Evidence/i)).not.toBeInTheDocument();
  });

  it('renders not-found deal state with safe return link', () => {
    render(<PlatformV7DealDetailPage params={{ id: 'DL-NOT-FOUND' }} />);

    expect(screen.getByText(/Сделка не найдена/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Все сделки' })).toHaveAttribute('href', '/platform-v7/deals');
  });
});
