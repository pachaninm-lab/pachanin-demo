import React from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { RoleActionDispatchBridge } from '@/components/v7r/RoleActionDispatchBridge';

describe('RoleActionDispatchBridge', () => {
  it('keeps blocked actions disabled and explains the reason', () => {
    render(
      <RoleActionDispatchBridge
        role='bank'
        dealId='DL-9113'
        actionType='confirmReserve'
        canRun={false}
        disabledReason='Банк ждёт reserve request.'
      />,
    );

    const button = screen.getByRole('button', { name: 'Выполнить sandbox' });
    expect(button).toBeDisabled();
    expect(screen.getByText('Банк ждёт reserve request.')).toBeInTheDocument();
    expect(screen.getByText(/Боевые интеграции не вызываются/)).toBeInTheDocument();
  });

  it('runs an allowed sandbox dispatch and shows audit feedback', () => {
    render(
      <RoleActionDispatchBridge
        role='buyer'
        dealId='DL-9113'
        actionType='requestReserve'
        canRun
        disabledReason={null}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Выполнить sandbox' }));

    expect(screen.getByText('Запрошен резерв средств в sandbox-контуре')).toBeInTheDocument();
    expect(screen.getByText(/Текущий статус после dispatch:/)).toBeInTheDocument();
    expect(screen.getByText(/Audit: requestReserve · DL-9113/)).toBeInTheDocument();
    expect(screen.getByText(/Timeline: Запрошен резерв средств в sandbox-контуре/)).toBeInTheDocument();
  });
});
