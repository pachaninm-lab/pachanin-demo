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
  /live bank callback/i,
  /sandbox/i,
  /simulation-only/i,
  /runtime/i,
  /callback/i,
  /evidence pack/i,
  /bank decision/i,
  /actionType/i,
  /actorRole/i,
  /платформа гарантирует оплату/i,
  /платформа выпускает деньги/i,
  /платформа сама выпускает деньги/i,
  /деньги автоматически выпускаются/i,
  /деньги переведены/i,
  /выплата выполнена/i,
  /деньги отправлены/i,
  /выпуск остановлен/i,
  /удержание выпуска/i,
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
  pilotStateLabel: 'контур исполнения · ожидание',
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
    render(<MoneyImpactSummaryStrip {...BASE_PROPS} stopReason='проверка выплаты остановлена: СДИЗ не закрыт' />);
    expect(screen.getByTestId('platform-v7-money-impact-stop')).toHaveTextContent('проверка выплаты остановлена: СДИЗ не закрыт');
  });

  it('does not render stop reason when absent', () => {
    render(<MoneyImpactSummaryStrip {...BASE_PROPS} />);
    expect(screen.queryByTestId('platform-v7-money-impact-stop')).toBeNull();
  });

  it('renders user-facing reason label when stop reason is present', () => {
    const { container } = render(<MoneyImpactSummaryStrip {...BASE_PROPS} stopReason='причина остановки активна' />);
    expect(container.innerHTML).toContain('причина остановки');
  });

  it('renders blocked state for bank data', () => {
    render(
      <MoneyImpactSummaryStrip
        amountContext='в резерве 15,89 млн ₽'
        pilotState='blocked'
        pilotStateLabel='пилотный контур · удержание до закрытия условий'
        pilotStateLabel='контур исполнения · удержание до закрытия условий'
        responsible='банк · оператор'
        nextStep='ручная сверка после закрытия условий'
        stopReason='банковская проверка выплаты остановлена'
      />,
    );
    expect(screen.getByTestId('platform-v7-money-impact-state')).toHaveTextContent('пилотный контур · удержание до закрытия условий');
    expect(screen.getByTestId('platform-v7-money-impact-responsible')).toHaveTextContent('банк · оператор');
    expect(screen.getByTestId('platform-v7-money-impact-stop')).toBeInTheDocument();
  });

  it('renders fallback basis, after-resolution effect and boundary for blocked bank data', () => {
    render(
      <MoneyImpactSummaryStrip
        amountContext='в резерве 15,89 млн ₽ · к выплате 0 ₽'
        pilotState='blocked'
        pilotStateLabel='пилотный контур · удержание до закрытия условий'
        pilotStateLabel='контур исполнения · удержание до закрытия условий'
        responsible='банк · оператор'
        nextStep='ручная сверка после закрытия условий'
        stopReason='банковская проверка выплаты остановлена'
      />,
    );

    expect(screen.getByTestId('platform-v7-money-impact-resolution')).toBeInTheDocument();
    expect(screen.getByTestId('platform-v7-money-impact-evidence')).toHaveTextContent('закрытые документы, приёмка, качество');
    expect(screen.getByTestId('platform-v7-money-impact-after-resolved')).toHaveTextContent('банк получает основание для проверки выплаты');
    expect(screen.getByTestId('platform-v7-money-impact-bank-boundary')).toHaveTextContent('платформа показывает основание');
    expect(screen.getByTestId('platform-v7-money-impact-bank-boundary')).toHaveTextContent('банк подтверждает проверку денег');
  });

  it('renders the needed basis, after-resolution effect and bank/platform boundary', () => {
    render(
      <MoneyImpactSummaryStrip
        amountContext='резерв 9,65 млн ₽ · удержание 624 тыс. ₽'
        pilotState='waiting'
        pilotStateLabel='пилотный контур · ожидание подтверждения'
        pilotStateLabel='контур исполнения · ожидание подтверждения'
        responsible='покупатель · банк'
        nextStep='ожидать банковского подтверждения резерва'
        stopReason='сделка не переходит к логистике до банковского подтверждения'
        requiredEvidence='банковское подтверждение резерва; по спорной части — акт приёмки и протокол качества'
        afterResolved='после подтверждения резерва сделка переходит к логистике; спорная часть остаётся под удержанием до закрытия расхождения'
        bankPlatformBoundary='платформа показывает причину и следующий шаг, банк подтверждает резерв и дальнейшее движение денег'
      />,
    );

    expect(screen.getByTestId('platform-v7-money-impact-resolution')).toBeInTheDocument();
    expect(screen.getByTestId('platform-v7-money-impact-evidence')).toHaveTextContent('акт приёмки и протокол качества');
    expect(screen.getByTestId('platform-v7-money-impact-after-resolved')).toHaveTextContent('спорная часть остаётся под удержанием');
    expect(screen.getByTestId('platform-v7-money-impact-bank-boundary')).toHaveTextContent('банк подтверждает резерв');
  });

  it('does not render resolution block when no resolution context is provided', () => {
    render(<MoneyImpactSummaryStrip {...BASE_PROPS} />);
    expect(screen.queryByTestId('platform-v7-money-impact-resolution')).toBeNull();
  });

  it('uses controlled-pilot wording only', () => {
    const { container } = render(
      <MoneyImpactSummaryStrip
        amountContext='резерв 9,65 млн ₽'
        pilotState='waiting'
        pilotStateLabel='пилотный контур · ожидание'
        pilotStateLabel='контур исполнения · ожидание'
        responsible='банк · оператор'
        nextStep='ручная сверка'
        stopReason='проверка выплаты остановлена'
        requiredEvidence='акт приёмки и протокол качества'
        afterResolved='банк проверяет основание по своим правилам'
        bankPlatformBoundary='платформа показывает основание и статус, банк подтверждает движение денег'
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

  it('seller page explains the evidence needed before bank review', () => {
    render(<SellerPage />);
    expect(screen.getByTestId('platform-v7-money-impact-evidence')).toHaveTextContent('закрытый СДИЗ');
    expect(screen.getByTestId('platform-v7-money-impact-evidence')).toHaveTextContent('ЭТрН');
    expect(screen.getByTestId('platform-v7-money-impact-bank-boundary')).toHaveTextContent('банк подтверждает проверку');
  });

  it('seller page strip shows pilot label', () => {
    render(<SellerPage />);
    expect(screen.getByTestId('platform-v7-money-impact-state').textContent).toMatch(/пилотный контур/);
  });

  it('buyer page renders money impact strip', () => {
    const { container } = render(<BuyerPage />);
    expect(screen.getByTestId('platform-v7-money-impact-strip')).toBeInTheDocument();
    expect(screen.getByTestId('platform-v7-money-impact-stop')).toBeInTheDocument();
    expectNoUnsafeCopy(container.innerHTML);
  });

  it('buyer page explains reserve confirmation and disputed amount handling', () => {
    render(<BuyerPage />);
    expect(screen.getByTestId('platform-v7-money-impact-next').textContent).toMatch(/банковского подтверждения/);
    expect(screen.getByTestId('platform-v7-money-impact-after-resolved')).toHaveTextContent('спорная часть остаётся под удержанием');
    expect(screen.getByTestId('platform-v7-money-impact-bank-boundary')).toHaveTextContent('банк подтверждает резерв');
  });

  it('buyer page strip shows bank confirmation in next step', () => {
    render(<BuyerPage />);
    expect(screen.getByTestId('platform-v7-money-impact-next').textContent).toMatch(/банковского подтверждения/);
  });

  it('bank page renders money impact strip', () => {
    const { container } = render(<BankPage />);
    expect(screen.getByTestId('platform-v7-money-impact-strip')).toBeInTheDocument();
    expect(screen.getByTestId('platform-v7-money-impact-stop')).toBeInTheDocument();
    expectNoUnsafeCopy(container.innerHTML);
  });

  it('bank page explains the platform and bank boundary for blocked money', () => {
    render(<BankPage />);
    expect(screen.getByTestId('platform-v7-money-impact-evidence')).toHaveTextContent('закрытые документы');
    expect(screen.getByTestId('platform-v7-money-impact-after-resolved')).toHaveTextContent('банк получает основание');
    expect(screen.getByTestId('platform-v7-money-impact-bank-boundary')).toHaveTextContent('платформа показывает основание');
    expect(screen.getByTestId('platform-v7-money-impact-bank-boundary')).toHaveTextContent('банк подтверждает проверку денег');
  });

  it('bank page strip shows manual review in next step', () => {
    render(<BankPage />);
    expect(screen.getByTestId('platform-v7-money-impact-next').textContent).toMatch(/ручная сверка/);
  });
});
