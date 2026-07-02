import React from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { RoleActionDispatchBridge } from '@/components/v7r/RoleActionDispatchBridge';

describe('RoleActionDispatchBridge', () => {
  it('keeps blocked actions disabled and explains the reason', () => {
    render(
      <RoleActionDispatchBridge
        role='bank'
        dealId='DL-9122'
        actionType='confirmReserve'
        canRun={false}
        disabledReason='Банк ждёт reserve request.'
      />,
    );

    const button = screen.getByRole('button', { name: 'Проверить действие' });
    expect(button).toBeDisabled();
    expect(screen.getByText('Банк ждёт reserve request.')).toBeInTheDocument();
    expect(screen.getByText(/Промышленные интеграции не вызываются/)).toBeInTheDocument();
    expect(screen.getByTestId('role-action-journal')).toHaveTextContent('Журнал появится после проверки действия.');
  });

  it('runs an allowed sandbox dispatch and shows audit feedback', () => {
    render(
      <RoleActionDispatchBridge
        role='buyer'
        dealId='DL-9122'
        actionType='requestReserve'
        canRun
        disabledReason={null}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Проверить действие' }));

    expect(screen.getAllByText('Запрошен резерв средств в предынтеграционном контуре').length).toBeGreaterThan(0);
    expect(screen.getByText(/Текущий статус после проверки: PAYMENT_RELEASE_REQUESTED/)).toBeInTheDocument();
    expect(screen.getByText(/Журнал: Запросить банковское основание · DL-9122/)).toBeInTheDocument();
    expect(screen.getByText(/Событие: Запрошен резерв средств в предынтеграционном контуре/)).toBeInTheDocument();
  });

  it('writes the sandbox result to the role action journal', () => {
    render(
      <RoleActionDispatchBridge
        role='buyer'
        dealId='DL-9122'
        actionType='requestReserve'
        canRun
        disabledReason={null}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Проверить действие' }));

    const journal = screen.getByTestId('role-action-journal');
    expect(screen.getByText('Журнал действия')).toBeInTheDocument();
    expect(within(journal).getByText('Запросить банковское основание · готово')).toBeInTheDocument();
    expect(within(journal).getByText('Запрошен резерв средств в предынтеграционном контуре')).toBeInTheDocument();
    expect(within(journal).getByText(/статус: PAYMENT_RELEASE_REQUESTED/)).toBeInTheDocument();
    expect(within(journal).getByText(/журнал: Запросить банковское основание · DL-9122/)).toBeInTheDocument();
    expect(within(journal).getByText(/событие: Запрошен резерв средств в предынтеграционном контуре/)).toBeInTheDocument();
  });
});
