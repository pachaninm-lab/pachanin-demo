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
    expect(screen.getByText(/Боевые подключения требуют договоров/)).toBeInTheDocument();
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

  it('renders factoring as a separate sandbox banking module with application workflow', () => {
    render(<BankFactoringPage />);

    expect(screen.getByText('Факторинг')).toBeInTheDocument();
    expect(screen.getByText('Пилотный банковый модуль · sandbox')).toBeInTheDocument();
    expect(screen.getByText(/не buyer financing и не боевой банковский платёж/)).toBeInTheDocument();
    expect(screen.getByText('Заявки на факторинг')).toBeInTheDocument();
    expect(screen.getByText('FAC-201')).toBeInTheDocument();
    expect(screen.getByText('Sandbox-лимит')).toBeInTheDocument();
    expect(screen.getByText('Sandbox-авансы')).toBeInTheDocument();
    expect(screen.getByText(/не кредитное решение банка/)).toBeInTheDocument();
    expect(screen.queryByText(/production-ready/i)).not.toBeInTheDocument();
  });

  it('keeps factoring separate from buyer financing and live payment release', () => {
    render(<BankFactoringPage />);

    expect(screen.getByText(/Это не buyer financing и не боевой банковский платёж/)).toBeInTheDocument();
    expect(screen.getByText(/Банк дочитывает финансовый профиль/)).toBeInTheDocument();
    expect(screen.getByText(/Без этого деньги не должны выпускаться/)).toBeInTheDocument();
    expect(screen.queryByText(/автоматически выпущен/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/боевой платёж выполнен/i)).not.toBeInTheDocument();
  });

  it('renders escrow money hold and release workflow without live integration claims', () => {
    render(<BankEscrowPage />);

    expect(screen.getByText('Эскроу')).toBeInTheDocument();
    expect(screen.getByText('Controlled-pilot · sandbox')).toBeInTheDocument();
    expect(screen.getByText(/не live escrow и не боевое банковское списание/)).toBeInTheDocument();
    expect(screen.getByText('Активные escrow-кейсы')).toBeInTheDocument();
    expect(screen.getByText('На удержании')).toBeInTheDocument();
    expect(screen.getByText('Условия раскрытия')).toBeInTheDocument();
    expect(screen.getByText('Sandbox release')).toBeInTheDocument();
    expect(screen.getByText('ESC-301')).toBeInTheDocument();
    expect(screen.queryByText(/production-ready/i)).not.toBeInTheDocument();
  });

  it('keeps escrow release gated and non-automatic', () => {
    render(<BankEscrowPage />);

    expect(screen.getByText(/Деньги стоят в sandbox hold до закрытия качества и полного пакета документов/)).toBeInTheDocument();
    expect(screen.getByText(/выпуск денег заблокирован до доказательств/)).toBeInTheDocument();
    expect(screen.queryByText(/автоматическое раскрытие/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/live escrow account/i)).not.toBeInTheDocument();
  });

  it('moves escrow from hold to ready and sandbox release states', () => {
    render(<BankEscrowPage />);

    fireEvent.click(screen.getAllByRole('button', { name: 'Снять блокер' })[0]);
    expect(screen.getByText(/ESC-301: блокер снят/)).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'Sandbox release' })[0]);
    expect(screen.getByText(/sandbox-раскрытие/)).toBeInTheDocument();
  });
});
