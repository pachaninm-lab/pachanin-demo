import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { P7MoneySafetyAuditStrip } from '@/components/platform-v7/P7MoneySafetyAuditStrip';

describe('P7MoneySafetyAuditStrip', () => {
  it('renders audit shell and three decision rows with user-facing bank-check copy', () => {
    render(<P7MoneySafetyAuditStrip />);

    expect(screen.getByTestId('money-safety-audit-strip')).toBeInTheDocument();
    expect(screen.getByText('Проверка денег перед запросом в банк')).toBeInTheDocument();
    expect(screen.getByText(/Это основание для проверки, а не платёжный механизм платформы/)).toBeInTheDocument();
    expect(screen.getByText('контур проверки · без движения денег')).toBeInTheDocument();
    expect(screen.getByTestId('money-safety-audit-row-safe')).toBeInTheDocument();
    expect(screen.getByTestId('money-safety-audit-row-blocked')).toBeInTheDocument();
    expect(screen.getByTestId('money-safety-audit-row-review')).toBeInTheDocument();
  });

  it('renders the safe row as ready for bank review', () => {
    render(<P7MoneySafetyAuditStrip />);

    const row = screen.getByTestId('money-safety-audit-row-safe');
    expect(within(row).getByText('DL-9109')).toBeInTheDocument();
    expect(within(row).getByText('Готово к проверке')).toBeInTheDocument();
    expect(within(row).getByText('Деньги готовы к выпуску')).toBeInTheDocument();
  });

  it('renders the blocked row as a stop reason instead of a platform-payment decision', () => {
    render(<P7MoneySafetyAuditStrip />);

    const row = screen.getByTestId('money-safety-audit-row-blocked');
    expect(within(row).getByText('DL-9112')).toBeInTheDocument();
    expect(within(row).getByText('Есть остановка')).toBeInTheDocument();
    expect(within(row).getByText('Документный пакет не закрыт')).toBeInTheDocument();
  });

  it('renders the review row', () => {
    render(<P7MoneySafetyAuditStrip />);

    const row = screen.getByTestId('money-safety-audit-row-review');
    expect(within(row).getByText('DL-9115')).toBeInTheDocument();
    expect(within(row).getByText('Нужна сверка')).toBeInTheDocument();
    expect(within(row).getByText('Сумма события банка не совпадает')).toBeInTheDocument();
  });

  it('does not preserve internal English audit labels', () => {
    const { container } = render(<P7MoneySafetyAuditStrip />);
    const text = container.textContent || '';

    expect(text).not.toMatch(/Money safety audit/i);
    expect(text).not.toMatch(/E7 guard layer/i);
    expect(text).not.toMatch(/bank callback/i);
    expect(text).not.toMatch(/Data layer/i);
    expect(text).not.toMatch(/Idempotency key/i);
  });
});
