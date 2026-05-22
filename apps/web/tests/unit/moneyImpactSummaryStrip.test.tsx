import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MoneyImpactSummaryStrip } from '@/components/platform-v7/MoneyImpactSummaryStrip';
import SellerPage from '@/app/platform-v7/seller/page';
import BuyerPage from '@/app/platform-v7/buyer/page';
import BankPage from '@/app/platform-v7/bank/page';

const BASE_PROPS = {
  amountContext: 'резерв 9,65 млн ₽ · к выплате 0 ₽',
  pilotState: 'waiting' as const,
  pilotStateLabel: 'контур исполнения · ожидание',
  responsible: 'продавец · ФГИС «Зерно»',
  nextStep: 'закрыть СДИЗ и ЭТрН',
};

describe('MoneyImpactSummaryStrip component', () => {
  it('renders core money impact slots', () => {
    render(<MoneyImpactSummaryStrip {...BASE_PROPS} />);

    expect(screen.getByTestId('platform-v7-money-impact-strip')).toBeInTheDocument();
    expect(screen.getByTestId('platform-v7-money-impact-amount')).toHaveTextContent('резерв 9,65 млн ₽ · к выплате 0 ₽');
    expect(screen.getByTestId('platform-v7-money-impact-state')).toHaveTextContent('контур исполнения · ожидание');
    expect(screen.getByTestId('platform-v7-money-impact-responsible')).toHaveTextContent('продавец · ФГИС «Зерно»');
    expect(screen.getByTestId('platform-v7-money-impact-next')).toHaveTextContent('закрыть СДИЗ и ЭТрН');
  });

  it('renders stop reason only when provided', () => {
    const { rerender } = render(<MoneyImpactSummaryStrip {...BASE_PROPS} />);
    expect(screen.queryByTestId('platform-v7-money-impact-stop')).toBeNull();

    rerender(<MoneyImpactSummaryStrip {...BASE_PROPS} stopReason='проверка выплаты остановлена: СДИЗ не закрыт' />);
    expect(screen.getByTestId('platform-v7-money-impact-stop')).toHaveTextContent('проверка выплаты остановлена: СДИЗ не закрыт');
  });

  it('renders resolution basis and bank/platform boundary', () => {
    render(
      <MoneyImpactSummaryStrip
        amountContext='резерв 9,65 млн ₽ · удержание 624 тыс. ₽'
        pilotState='waiting'
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
});

describe('MoneyImpactSummaryStrip page placement', () => {
  it('seller, buyer and bank pages render the strip', () => {
    for (const Page of [SellerPage, BuyerPage, BankPage]) {
      const { unmount } = render(<Page />);
      expect(screen.getByTestId('platform-v7-money-impact-strip')).toBeInTheDocument();
      unmount();
    }
  });
});
