import React from 'react';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import PlatformV7BuyerPage from '@/app/platform-v7/buyer/page';

const source = readFileSync(new URL('../../app/platform-v7/buyer/page.tsx', import.meta.url), 'utf8');

describe('platform-v7 buyer execution polish', () => {
  it('renders buyer execution screen with reserve and hold focus', () => {
    render(<PlatformV7BuyerPage />);

    expect(screen.getByText('Покупатель · RFQ → оффер → резерв → логистика')).toBeInTheDocument();
    expect(screen.getByText(/Подтвердить резерв и условия, чтобы сделка пошла в исполнение/i)).toBeInTheDocument();
    expect(screen.getByText(/Резерв ещё не подтверждён банком/i)).toBeInTheDocument();
    expect(screen.getByText(/Сделка не переходит к логистике до банковского статуса/i)).toBeInTheDocument();
    expect(screen.getByText('Мой резерв')).toBeInTheDocument();
    expect(screen.getByText('Удержание')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Запросить подтверждение резерва/i })).toHaveAttribute('href', '/platform-v7/deals/DL-9106/money');
    expect(screen.getByText(/ожидать банковского подтверждения резерва/i)).toBeInTheDocument();
    expect(screen.getByText(/готовность денег без преждевременного движения денег/i)).toBeInTheDocument();
  });

  it('keeps buyer source free from premature payment movement and overclaims', () => {
    expect(source).not.toMatch(/преждевременного выпуска/);
    expect(source).not.toMatch(/платформа выпускает деньги/i);
    expect(source).not.toMatch(/деньги автоматически выпускаются/i);
    expect(source).not.toMatch(/прямой выплаты/i);
    expect(source).not.toMatch(/production-ready/i);
    expect(source).not.toMatch(/fully live/i);
    expect(source).not.toMatch(/callback/i);
    expect(source).not.toMatch(/runtime/i);
  });
});
