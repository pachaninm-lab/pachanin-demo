import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MoneyImpactSummaryStrip } from '@/components/platform-v7/MoneyImpactSummaryStrip';
import SellerPage from '@/app/platform-v7/seller/page';
import BuyerPage from '@/app/platform-v7/buyer/page';
import BankPage from '@/app/platform-v7/bank/page';

const FORBIDDEN = [
  /production-ready/i,
  /fully live/i,
  /fully integrated/i,
  /live callback/i,
  /платформа гарантирует оплату/i,
  /платформа выпускает деньги/i,
  /деньги переведены/i,
  /выплата выполнена/i,
  /деньги отправлены/i,
];

function expectNoUnsafeCopy(html: string) {
  for (const pattern of FORBIDDEN) {
    expect(html).not.toMatch(pattern);
  }
  expect(html).not.toContain('/platform-v7/demo/');
}

const BASE_PROPS = {
  amountContext: 'резерв 9,65 млн ₽ · к выплате 0 ₽',
  pilotState: 'waiting' as const,
  pilotStateLabel: 'пилотный контур · ожидание',
  responsible: 'продавец · ФГИС «Зерно»',
  nextStep: 'закрыть СДИЗ и ЭТрН',
};

describe('MoneyImpactSummaryStrip component', () => {
  it('renders container with testid', () => {
    render(<MoneyImpactSummaryStrip {...BASE_PROPS} />);
    expect(screen.getByTestId('platform-v7-money-impact-strip')).toBeInTheDocument();
  });

  it('renders amount context slot', () => {
    render(<MoneyImpactSummaryStrip {...BASE_PROPS} />);
    expect(screen.getByTestId('platform-v7-money-impact-amount')).toHaveTextContent('резерв 9,65 млн ₽ · к выплате 0 ₽');
  });

  it('renders pilot state badge', () => {
    render(<MoneyImpactSummaryStrip {...BASE_PROPS} />);
    expect(screen.getByTestId('platform-v7-money-impact-state')).toHaveTextContent('пилотный контур · ожидание');
  });

  it('renders responsible slot', () => {
    render(<MoneyImpactSummaryStrip {...BASE_PROPS} />);
    expect(screen.getByTestId('platform-v7-money-impact-responsible')).toHaveTextContent('продавец · ФГИС «Зерно»');
  });

  it('renders next step slot', () => {
    render(<MoneyImpactSummaryStrip {...BASE_PROPS} />);
    expect(screen.getByTestId('platform-v7-money-impact-next')).toHaveTextContent('закрыть СДИЗ и ЭТрН');
  });

  it('renders stop reason when provided', () => {
    render(<MoneyImpactSummaryStrip {...BASE_PROPS} stopReason='выпуск остановлен: СДИЗ не закрыт' />);
    expect(screen.getByTestId('platform-v7-money-impact-stop')).toHaveTextContent('выпуск остановлен: СДИЗ не закрыт');
  });

  it('does not render stop reason when absent', () => {
    render(<MoneyImpactSummaryStrip {...BASE_PROPS} />);
    expect(screen.queryByTestId('platform-v7-money-impact-stop')).toBeNull();
  });

  it('renders причина остановки label when stop reason present', () => {
    const { container } = render(
      <MoneyImpactSummaryStrip {...BASE_PROPS} stopReason='причина остановки активна' />,
    );
    expect(container.innerHTML).toContain('причина остановки');
  });

  it('renders blocked state for bank role data', () => {
    render(
      <MoneyImpactSummaryStrip
        amountContext='в резерве 15,89 млн ₽'
        pilotState='blocked'
        pilotStateLabel='пилотный контур · удержание выпуска'
        responsible='банк · оператор'
        nextStep='ручная сверка после закрытия условий'
        stopReason='выпуск остановлен'
      />,
    );
    expect(screen.getByTestId('platform-v7-money-impact-state')).toHaveTextContent('пилотный контур · удержание выпуска');
    expect(screen.getByTestId('platform-v7-money-impact-responsible')).toHaveTextContent('банк · оператор');
    expect(screen.getByTestId('platform-v7-money-impact-stop')).toBeInTheDocument();
  });

  it('uses controlled-pilot wording — no unsafe copy', () => {
    const { container } = render(
      <MoneyImpactSummaryStrip
        amountContext='резерв 9,65 млн ₽'
        pilotState='waiting'
        pilotStateLabel='пилотный контур · ожидание'
        responsible='банк · оператор'
        nextStep='ручная сверка'
        stopReason='выпуск остановлен'
      />,
    );
    expectNoUnsafeCopy(container.innerHTML);
  });
});

describe('MoneyImpactSummaryStrip page placement', () => {
  it('seller page renders money impact strip', () => {
    const { container } = render(<SellerPage />);
    expect(screen.getByTestId('platform-v7-money-impact-strip')).toBeInTheDocument();
    expect(screen.getByTestId('platform-v7-money-impact-stop')).toBeInTheDocument();
    expectNoUnsafeCopy(container.innerHTML);
  });

  it('seller page strip shows пилотный контур label', () => {
    render(<SellerPage />);
    expect(screen.getByTestId('platform-v7-money-impact-state').textContent).toMatch(/пилотный контур/);
  });

  it('buyer page renders money impact strip', () => {
    const { container } = render(<BuyerPage />);
    expect(screen.getByTestId('platform-v7-money-impact-strip')).toBeInTheDocument();
    expect(screen.getByTestId('platform-v7-money-impact-stop')).toBeInTheDocument();
    expectNoUnsafeCopy(container.innerHTML);
  });

  it('buyer page strip shows банковского подтверждения in next step', () => {
    render(<BuyerPage />);
    expect(screen.getByTestId('platform-v7-money-impact-next').textContent).toMatch(/банковского подтверждения/);
  });

  it('bank page renders money impact strip', () => {
    const { container } = render(<BankPage />);
    expect(screen.getByTestId('platform-v7-money-impact-strip')).toBeInTheDocument();
    expect(screen.getByTestId('platform-v7-money-impact-stop')).toBeInTheDocument();
    expectNoUnsafeCopy(container.innerHTML);
  });

  it('bank page strip shows ручная сверка in next step', () => {
    render(<BankPage />);
    expect(screen.getByTestId('platform-v7-money-impact-next').textContent).toMatch(/ручная сверка/);
  });
});
