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

describe('P7ExecutionActionsPanel runtime events', () => {
  it('shows bank reserve as requested and waiting for bank confirmation', async () => {
    const { container } = render(
      <P7ExecutionActionsPanel
        title='Сквозные действия сделки'
        subtitle='Оператор видит доступные шаги, причины остановки и журнал действий.'
        initialState={readyForReserveState}
        items={[
          {
            title: 'Запросить резерв денег',
            description: 'Создаёт только запрос на резерв. Банк должен отдельно подтвердить резерв и дальнейшее решение.',
            targetId: 'e4-request-money-reserve',
            actionId: 'requestMoneyReserve',
            actorRole: 'buyer',
            entityId: 'RESERVE-DL-DRAFT-2403',
            mode: 'manual',
          },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Запросить резерв денег' }));

    await waitFor(() => {
      expect(screen.getByTestId('p7-runtime-event-status')).toHaveTextContent('ожидает банковской проверки');
    });

    expect(screen.getByTestId('p7-runtime-event-status')).toHaveTextContent('Создан запрос. Платформа ждёт подтверждение банка');
    expect(screen.getByTestId('p7-runtime-event-status')).toHaveTextContent('не считает действие внешне подтверждённым');
    expect(screen.getByText(/запрос создан, ждём подтверждение банка/)).toBeInTheDocument();
    expect(screen.getByText('bank_reserve_review_requested')).toBeInTheDocument();
    expect(screen.getByText(/Ожидается подтверждение внешней системы: bank/)).toBeInTheDocument();
    expect(screen.getByText(/Не подтверждает резерв/)).toBeInTheDocument();
    expect(container.querySelector('[data-status="started"]')).toBeTruthy();
    unsafeCopyGuard(container.textContent || '');
  });

  it('shows internal document action as internal record without external confirmation', async () => {
    const { container } = render(
      <P7ExecutionActionsPanel
        title='Сквозные действия сделки'
        subtitle='Оператор видит доступные шаги, причины остановки и журнал действий.'
        initialState={readyForDocumentState}
        items={[
          {
            title: 'Приложить документ',
            description: 'Фиксирует внутренний документ как условие сделки и доказательство. Это не ЭДО, не УКЭП и не СберКорус.',
            targetId: 'e4-attach-document',
            actionId: 'attachDocument',
            actorRole: 'operator',
            entityId: 'DOC-INTERNAL-2403',
            mode: 'manual',
          },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Приложить документ' }));

    await waitFor(() => {
      expect(screen.getByTestId('p7-runtime-event-status')).toHaveTextContent('внутренняя запись создана');
    });

    expect(screen.getByTestId('p7-runtime-event-status')).toHaveTextContent('Действие зафиксировано как внутренняя запись');
    expect(screen.getByText(/действие зафиксировано во внутреннем контуре/)).toBeInTheDocument();
    expect(screen.getByText('internal_document_attached')).toBeInTheDocument();
    expect(screen.getByText(/Не является ЭДО, УКЭП или внешним подтверждением/)).toBeInTheDocument();
    unsafeCopyGuard(container.textContent || '');
  });
});
