import React from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
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

// The demo deals (DL-9106 / DL-9102) are intentionally not release-ready: the
// bank-basis handoff is gated by evaluateReleaseGuard, so the panel safely
// blocks instead of fabricating a created request. These tests assert that
// canonical safe-blocked behaviour without any fake-payout copy.
describe('P7BankPaymentBasisRuntimePanel', () => {
  it('keeps the initial state with no basis handed to the bank yet', () => {
    render(<P7BankPaymentBasisRuntimePanel dealId='DL-9106' actorRole='operator' />);

    expect(screen.getByTestId('p7-bank-payment-basis-runtime-panel')).toHaveTextContent('запрос ещё не создан');
    expect(screen.getAllByText(/Основание ещё не передавалось банку/).length).toBeGreaterThan(0);
  });

  it('safely blocks the bank-basis handoff while the deal is not release-ready', () => {
    const { container } = render(<P7BankPaymentBasisRuntimePanel dealId='DL-9106' actorRole='operator' />);

    fireEvent.click(screen.getByRole('button', { name: 'Передать основание банку' }));

    const status = screen.getByTestId('p7-bank-payment-basis-runtime-status');
    expect(status).toHaveTextContent('действие остановлено');
    expect(status).toHaveTextContent('основание не передано');
    expect(within(status).getByText(/Основание для банковской проверки заблокировано/)).toBeInTheDocument();
    expect(screen.queryByText('bank_payment_basis_review_requested')).not.toBeInTheDocument();
    unsafeMoneyCopyGuard(container.textContent || '');
  });

  it('also blocks the handoff for a field role that cannot pass payment basis to bank', () => {
    const { container } = render(<P7BankPaymentBasisRuntimePanel dealId='DL-9106' actorRole='driver' />);

    fireEvent.click(screen.getByRole('button', { name: 'Передать основание банку' }));

    const status = screen.getByTestId('p7-bank-payment-basis-runtime-status');
    expect(status).toHaveTextContent('действие остановлено');
    expect(status).toHaveTextContent('основание не передано');
    expect(screen.queryByText('bank_payment_basis_review_requested')).not.toBeInTheDocument();
    unsafeMoneyCopyGuard(container.textContent || '');
  });
});
