import React from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { P7BankPaymentBasisRuntimePanel } from '@/components/platform-v7/P7BankPaymentBasisRuntimePanel';

function unsafeMoneyCopyGuard(text: string) {
  expect(text).not.toMatch(/production-ready/i);
  expect(text).not.toMatch(/fully live/i);
  expect(text).not.toMatch(/fully integrated/i);
  expect(text).not.toMatch(/деньги выпущены/i);
  expect(text).not.toMatch(/выплата подтверждена/i);
  expect(text).not.toMatch(/оплата подтверждена/i);
  expect(text).not.toMatch(/платформа выпустила деньги/i);
  expect(text).not.toMatch(/платформа гарантирует оплату/i);
}

describe('P7BankPaymentBasisRuntimePanel', () => {
  it('creates a visible pending bank payment-basis request without payment confirmation claims', () => {
    const { container } = render(<P7BankPaymentBasisRuntimePanel dealId='DL-9106' actorRole='operator' />);

    expect(screen.getByTestId('p7-bank-payment-basis-runtime-panel')).toHaveTextContent('запрос ещё не создан');
    expect(screen.getByText(/Основание ещё не передавалось банку/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Передать основание банку' }));

    expect(screen.getByTestId('p7-bank-payment-basis-runtime-status')).toHaveTextContent('запрос создан');
    expect(screen.getByTestId('p7-bank-payment-basis-runtime-status')).toHaveTextContent('основание передано на банковскую проверку');
    expect(screen.getByTestId('p7-bank-payment-basis-runtime-status')).toHaveTextContent('не выпуск денег');
    expect(screen.getByTestId('p7-bank-payment-basis-runtime-status')).toHaveTextContent('не подтверждение выплаты');
    expect(screen.getByTestId('p7-bank-payment-basis-runtime-status')).toHaveTextContent('ожидается подтверждение банка');
    expect(screen.getByText('bank_payment_basis_review_requested')).toBeInTheDocument();
    expect(screen.getByText(/Ожидается подтверждение внешней системы: bank/)).toBeInTheDocument();
    expect(screen.getByText(/Не выпускает деньги и не подтверждает выплату силами платформы/)).toBeInTheDocument();
    unsafeMoneyCopyGuard(container.textContent || '');
  });

  it('shows blocked state for a role that cannot pass payment basis to bank', () => {
    const { container } = render(<P7BankPaymentBasisRuntimePanel dealId='DL-9106' actorRole='driver' />);

    fireEvent.click(screen.getByRole('button', { name: 'Передать основание банку' }));

    expect(screen.getByTestId('p7-bank-payment-basis-runtime-status')).toHaveTextContent('действие остановлено');
    expect(screen.getByTestId('p7-bank-payment-basis-runtime-status')).toHaveTextContent('основание не передано');
    expect(screen.getByText('У роли нет права выполнить это действие.')).toBeInTheDocument();
    expect(screen.queryByText('bank_payment_basis_review_requested')).not.toBeInTheDocument();
    unsafeMoneyCopyGuard(container.textContent || '');
  });
});
