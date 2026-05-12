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
  it('renders bank main page with controlled-pilot wording and no live payment claims', () => {
    render(<PlatformV7BankPage />);

    expect(screen.getByText('Кабинет банка')).toBeInTheDocument();
    expect(screen.getByText(/Деньги передаются на выплату только после условий сделки/)).toBeInTheDocument();
    expect(screen.getByText(/Здесь нет кнопки прямой выплаты/)).toBeInTheDocument();
    expect(screen.getByText(/Выплата продавцу не является ручной кнопкой платформы/)).toBeInTheDocument();
    expect(screen.getByTestId('platform-v7-money-impact-state')).toHaveTextContent(/пилотный контур/);
    expect(screen.getByTestId('platform-v7-money-impact-evidence')).toHaveTextContent(/закрытые документы|приёмка|качество/);
    expect(screen.getByTestId('platform-v7-money-impact-bank-boundary')).toHaveTextContent(/банк подтверждает проверку денег/);
    expect(screen.queryByText(/production-ready/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/платформа гарантирует оплату/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/деньги автоматически выпускаются/i)).not.toBeInTheDocument();
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
    expect(screen.getByText('Пилотный банковый модуль · тестовый контур')).toBeInTheDocument();
    expect(screen.getByText(/не кредитование покупателя и не боевой банковский платёж/)).toBeInTheDocument();
    expect(screen.getByText('Заявки на факторинг')).toBeInTheDocument();
    expect(screen.getByText('FAC-201')).toBeInTheDocument();
    expect(screen.getByText('Тестовый лимит')).toBeInTheDocument();
    expect(screen.getByText('Отмеченные авансы')).toBeInTheDocument();
    expect(screen.getByText(/не кредитное решение банка/)).toBeInTheDocument();
    expect(screen.queryByText(/production-ready/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/sandbox/i)).not.toBeInTheDocument();
  });

  it('keeps factoring separate from buyer financing and live payment release', () => {
    render(<BankFactoringPage />);

    expect(screen.getByText(/Это не кредитование покупателя и не боевой банковский платёж/)).toBeInTheDocument();
    expect(screen.getByText(/Банк дочитывает финансовый профиль/)).toBeInTheDocument();
    expect(screen.getByText(/Без этого основание не передаётся на банковскую проверку/)).toBeInTheDocument();
    expect(screen.queryByText(/автоматически выпущен/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/боевой платёж выполнен/i)).not.toBeInTheDocument();
  });

  it('renders escrow money hold and release workflow without live integration claims', () => {
    render(<BankEscrowPage />);

    expect(screen.getByText('Эскроу')).toBeInTheDocument();
    expect(screen.getByText('Пилотный контур · тестовый сценарий')).toBeInTheDocument();
    expect(screen.getByText(/не боевой эскроу и не банковское списание/)).toBeInTheDocument();
    expect(screen.getByText('Активные эскроу-кейсы')).toBeInTheDocument();
    expect(screen.getByText('На удержании')).toBeInTheDocument();
    expect(screen.getByText('Условия раскрытия')).toBeInTheDocument();
    expect(screen.getAllByText('Отметить частичное раскрытие').length).toBeGreaterThan(0);
    expect(screen.getByText('ESC-301')).toBeInTheDocument();
    expect(screen.queryByText(/production-ready/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/sandbox/i)).not.toBeInTheDocument();
  });

  it('keeps escrow release gated and non-automatic', () => {
    render(<BankEscrowPage />);

    expect(screen.getByText(/Деньги остаются на удержании до закрытия качества и полного пакета документов/)).toBeInTheDocument();
    expect(screen.getByText(/движение денег заблокировано до доказательств/)).toBeInTheDocument();
    expect(screen.queryByText(/автоматическое раскрытие/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/live escrow account/i)).not.toBeInTheDocument();
  });

  it('moves escrow from hold to ready and release states without technical labels', () => {
    render(<BankEscrowPage />);

    fireEvent.click(screen.getAllByRole('button', { name: 'Снять причину удержания' })[0]);
    expect(screen.getByText(/ESC-301: причина удержания закрыта/)).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'Отметить частичное раскрытие' })[0]);
    expect(screen.getByText(/отмечено частичное раскрытие/)).toBeInTheDocument();
  });
});
