import React from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { P7ExecutionActionsPanel } from '@/components/platform-v7/P7ExecutionActionsPanel';
import type { PlatformV7ExecutionActionState } from '@/lib/platform-v7/execution-action-core';

const readyForReserveState: PlatformV7ExecutionActionState = {
  lotId: 'LOT-2403',
  offerId: 'OFFER-2403-A',
  dealId: 'DL-DRAFT-2403',
  submittedOfferIds: [],
  acceptedOfferId: 'OFFER-2403-A',
  rejectedOfferIds: [],
  counterOfferIds: [],
  draftDealId: 'DL-DRAFT-2403',
  moneyReserveIntentId: null,
  logisticsOrderId: null,
  documentIds: [],
  fieldEventIds: [],
  disputeId: null,
  sdizIssuedStatus: 'not_issued',
  sdizSignedStatus: 'not_signed',
  sdizTransferredStatus: 'not_transferred',
  sdizRedeemedStatus: 'not_redeemed',
  sdizRefusalStatus: 'none',
  sdizManualReviewStatus: 'not_requested',
  roleNotificationIds: [],
};

const readyForDocumentState: PlatformV7ExecutionActionState = {
  ...readyForReserveState,
};

function unsafeCopyGuard(text: string) {
  expect(text).not.toMatch(/production-ready/i);
  expect(text).not.toMatch(/fully live/i);
  expect(text).not.toMatch(/fully integrated/i);
  expect(text).not.toMatch(/платформа гарантирует оплату/i);
  expect(text).not.toMatch(/платформа выпускает деньги/i);
  expect(text).not.toMatch(/К выпуску/i);
  expect(text).not.toMatch(/Выпущено/i);
}

describe('P7ExecutionActionsPanel runtime-safe actions', () => {
  it('shows bank reserve as an internal request without claiming bank confirmation', async () => {
    const { container } = render(
      <P7ExecutionActionsPanel
        title='Сквозные действия сделки'
        subtitle='Оператор видит доступные шаги, причины остановки и журнал действий.'
        initialState={readyForReserveState}
        items={[{
          title: 'Запросить резерв денег',
          description: 'Создаёт только запрос на резерв. Банк должен отдельно подтвердить резерв и дальнейшее решение.',
          targetId: 'e4-request-money-reserve',
          actionId: 'requestMoneyReserve',
          actorRole: 'buyer',
          entityId: 'RESERVE-DL-DRAFT-2403',
          mode: 'manual',
        }]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Запросить резерв денег' }));

    await waitFor(() => {
      expect(screen.getByTestId('execution-action-receipt')).toBeInTheDocument();
    });

    expect(screen.getByTestId('execution-action-receipt')).toHaveTextContent('ручная проверка / ожидает внешнее подтверждение');
    expect(screen.getByText(/Намерение резерва создано/)).toBeInTheDocument();
    unsafeCopyGuard(container.textContent || '');
  });

  it('shows internal document action as an internal record without external confirmation', async () => {
    const { container } = render(
      <P7ExecutionActionsPanel
        title='Сквозные действия сделки'
        subtitle='Оператор видит доступные шаги, причины остановки и журнал действий.'
        initialState={readyForDocumentState}
        items={[{
          title: 'Приложить документ',
          description: 'Фиксирует внутренний документ как условие сделки и доказательство. Это не ЭДО, не УКЭП и не СберКорус.',
          targetId: 'e4-attach-document',
          actionId: 'attachDocument',
          actorRole: 'operator',
          entityId: 'DOC-INTERNAL-2403',
          mode: 'manual',
        }]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Приложить документ' }));

    await waitFor(() => {
      expect(screen.getByTestId('execution-action-receipt')).toBeInTheDocument();
    });

    expect(screen.getByTestId('execution-action-receipt')).toHaveTextContent('ручная проверка / ожидает внешнее подтверждение');
    expect(screen.getByText(/Внутренний документ приложен/)).toBeInTheDocument();
    unsafeCopyGuard(container.textContent || '');
  });
});
