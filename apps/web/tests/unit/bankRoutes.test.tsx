import React from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import PlatformV7BankPage from '@/app/platform-v7/bank/page';
import BankFactoringPage from '@/app/platform-v7/bank/factoring/page';
import BankEscrowPage from '@/app/platform-v7/bank/escrow/page';
import {
  PLATFORM_V7_BANK_ESCROW_ROUTE,
  PLATFORM_V7_BANK_FACTORING_ROUTE,
  PLATFORM_V7_COMMAND_ROUTE_SURFACE,
  PLATFORM_V7_EXECUTION_MACHINE_STRIP_ROUTES,
  PLATFORM_V7_SHELL_ROUTE_SURFACE,
} from '@/lib/platform-v7/routes';

describe('PlatformV7 bank routes', () => {
  it('renders bank route with route-constant quick links and sandbox wording', () => {
    render(<PlatformV7BankPage />);

    expect(screen.getByText('Банковый контур с guard-контролем')).toBeInTheDocument();
    expect(screen.getByText('Банк · sandbox')).toBeInTheDocument();
    expect(screen.getByText(/не заявляют боевую банковую интеграцию/)).toBeInTheDocument();
    expect(screen.getByText(/sandbox\/controlled-pilot/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Факторинг/ })).toHaveAttribute('href', PLATFORM_V7_BANK_FACTORING_ROUTE);
    expect(screen.getByRole('link', { name: /Эскроу/ })).toHaveAttribute('href', PLATFORM_V7_BANK_ESCROW_ROUTE);
    expect(screen.queryByText(/production-ready/i)).not.toBeInTheDocument();
  });

  it('registers factoring and escrow in command, shell and execution route surfaces', () => {
    expect(PLATFORM_V7_COMMAND_ROUTE_SURFACE).toContain(PLATFORM_V7_BANK_FACTORING_ROUTE);
    expect(PLATFORM_V7_COMMAND_ROUTE_SURFACE).toContain(PLATFORM_V7_BANK_ESCROW_ROUTE);
    expect(PLATFORM_V7_SHELL_ROUTE_SURFACE).toContain(PLATFORM_V7_BANK_FACTORING_ROUTE);
    expect(PLATFORM_V7_SHELL_ROUTE_SURFACE).toContain(PLATFORM_V7_BANK_ESCROW_ROUTE);
    expect(PLATFORM_V7_EXECUTION_MACHINE_STRIP_ROUTES).toContain(PLATFORM_V7_BANK_FACTORING_ROUTE);
    expect(PLATFORM_V7_EXECUTION_MACHINE_STRIP_ROUTES).toContain(PLATFORM_V7_BANK_ESCROW_ROUTE);
  });

  it('renders factoring as a separate pilot banking module with application workflow', () => {
    render(<BankFactoringPage />);

    expect(screen.getByText('Факторинг')).toBeInTheDocument();
    expect(screen.getByText('Пилотный банковый модуль')).toBeInTheDocument();
    expect(screen.getByText('Заявки на факторинг')).toBeInTheDocument();
    expect(screen.getByText('FAC-201')).toBeInTheDocument();
    expect(screen.getByText('Доступный лимит')).toBeInTheDocument();
    expect(screen.getByText('Выплаченные авансы')).toBeInTheDocument();
    expect(screen.queryByText(/buyer-only/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/production-ready/i)).not.toBeInTheDocument();
  });

  it('renders escrow money hold and release workflow without live integration claims', () => {
    render(<BankEscrowPage />);

    expect(screen.getByText('Эскроу')).toBeInTheDocument();
    expect(screen.getByText('Контур безопасной сделки')).toBeInTheDocument();
    expect(screen.getByText('Активные эскроу-счета')).toBeInTheDocument();
    expect(screen.getByText('На удержании')).toBeInTheDocument();
    expect(screen.getByText('Условия раскрытия')).toBeInTheDocument();
    expect(screen.getByText('ESC-301')).toBeInTheDocument();
    expect(screen.queryByText(/production-ready/i)).not.toBeInTheDocument();
  });

  it('moves escrow from hold to ready and partial release states', () => {
    render(<BankEscrowPage />);

    fireEvent.click(screen.getAllByRole('button', { name: 'Снять блокер' })[0]);
    expect(screen.getByText(/ESC-301: блокер снят/)).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'Частично раскрыть' })[0]);
    expect(screen.getByText(/частично раскрыто/)).toBeInTheDocument();
  });
});
