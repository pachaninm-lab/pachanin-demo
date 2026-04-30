import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import PlatformV7AntiBypassPage from '@/app/platform-v7/anti-bypass/page';
import {
  PLATFORM_V7_ANTI_BYPASS_ROUTE,
  PLATFORM_V7_COMMAND_ROUTE_SURFACE,
  PLATFORM_V7_OFFER_LOG_ROUTE,
  PLATFORM_V7_OFFER_TO_DEAL_ROUTE,
} from '@/lib/platform-v7/routes';

describe('PlatformV7AntiBypassPage', () => {
  it('renders anti-bypass as a deal-retention control, not a contact marketplace', () => {
    render(<PlatformV7AntiBypassPage />);

    expect(screen.getByText('Как платформа удерживает сделку внутри контура')).toBeInTheDocument();
    expect(screen.getByText(/не использовали платформу как витрину контактов/)).toBeInTheDocument();
    expect(screen.getByText(/Контакты раскрываются только после выбора ставки и создания черновика сделки/)).toBeInTheDocument();
    expect(screen.queryByText(/production-ready/i)).not.toBeInTheDocument();
  });

  it('keeps trade journal and draft deal links on route constants', () => {
    render(<PlatformV7AntiBypassPage />);

    expect(screen.getByRole('link', { name: 'Журнал торгов' })).toHaveAttribute('href', PLATFORM_V7_OFFER_LOG_ROUTE);
    expect(screen.getByRole('link', { name: 'Черновик сделки' })).toHaveAttribute('href', PLATFORM_V7_OFFER_TO_DEAL_ROUTE);
  });

  it('keeps buyers anonymized before the draft deal and exposes full data only to operator and bank', () => {
    render(<PlatformV7AntiBypassPage />);

    expect(screen.getByText(/До черновика сделки продавец видит обезличенного покупателя/)).toBeInTheDocument();
    expect(screen.getByText(/Покупатель и продавец раскрываются друг другу только внутри черновика сделки/)).toBeInTheDocument();
    expect(screen.getAllByText('полный доступ')).toHaveLength(2);
    expect(screen.getByText('Оператор')).toBeInTheDocument();
    expect(screen.getByText('Банк')).toBeInTheDocument();
  });

  it('registers anti-bypass route in command surface', () => {
    expect(PLATFORM_V7_ANTI_BYPASS_ROUTE).toBe('/platform-v7/anti-bypass');
    expect(PLATFORM_V7_COMMAND_ROUTE_SURFACE).toContain(PLATFORM_V7_ANTI_BYPASS_ROUTE);
  });
});
