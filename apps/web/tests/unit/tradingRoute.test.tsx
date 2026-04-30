import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import PlatformV7TradingPage from '@/app/platform-v7/trading/page';

describe('PlatformV7TradingPage', () => {
  it('renders trading sandbox boundary and rule', () => {
    render(<PlatformV7TradingPage />);

    expect(screen.getByText('Лоты, заявки, ставки и допуск к сделке')).toBeInTheDocument();
    expect(screen.getByText(/Торги и ставки · песочница/)).toBeInTheDocument();
    expect(screen.getByText(/Экран показывает не просто цену/)).toBeInTheDocument();
    expect(screen.getByText('Правило торгов')).toBeInTheDocument();
    expect(screen.getByText(/Ставка не становится сделкой автоматически/)).toBeInTheDocument();
  });

  it('renders metrics and active trading rows', () => {
    render(<PlatformV7TradingPage />);

    expect(screen.getByText('Лоты и заявки')).toBeInTheDocument();
    expect(screen.getByText('Ставки и предложения')).toBeInTheDocument();
    expect(screen.getByText('Готовы в сделку')).toBeInTheDocument();
    expect(screen.getByText('Требуют проверки')).toBeInTheDocument();
    expect(screen.getByText('Активные торги')).toBeInTheDocument();
    expect(screen.getAllByText('Целевая цена').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Лучшая ставка').length).toBeGreaterThan(0);
  });

  it('renders blockers and risk cells', () => {
    render(<PlatformV7TradingPage />);

    expect(screen.getByText('нет СДИЗ')).toBeInTheDocument();
    expect(screen.getByText('расхождение качества')).toBeInTheDocument();
    expect(screen.getByText('Высокий')).toBeInTheDocument();
  });

  it('uses stable route links', () => {
    render(<PlatformV7TradingPage />);

    expect(screen.getByRole('link', { name: 'Рынок и заявки' })).toHaveAttribute('href', '/platform-v7/market-rfq');
    expect(screen.getAllByRole('link', { name: 'Открыть карточку торгов' })[0]).toHaveAttribute('href', '/platform-v7/market-rfq');
    expect(screen.getAllByRole('link', { name: 'Проверить готовность' })[0]).toHaveAttribute('href', '/platform-v7/readiness');
  });
});
