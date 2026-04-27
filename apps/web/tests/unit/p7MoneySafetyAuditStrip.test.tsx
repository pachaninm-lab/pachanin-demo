import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { P7MoneySafetyAuditStrip } from '@/components/platform-v7/P7MoneySafetyAuditStrip';

describe('P7MoneySafetyAuditStrip', () => {
  it('renders audit shell and three decision rows', () => {
    render(<P7MoneySafetyAuditStrip />);

    expect(screen.getByTestId('money-safety-audit-strip')).toBeInTheDocument();
    expect(screen.getByText('Money safety audit')).toBeInTheDocument();
    expect(screen.getByTestId('money-safety-audit-row-safe')).toBeInTheDocument();
    expect(screen.getByTestId('money-safety-audit-row-blocked')).toBeInTheDocument();
    expect(screen.getByTestId('money-safety-audit-row-review')).toBeInTheDocument();
  });

  it('renders the safe row', () => {
    render(<P7MoneySafetyAuditStrip />);

    const row = screen.getByTestId('money-safety-audit-row-safe');
    expect(within(row).getByText('DL-9109')).toBeInTheDocument();
    expect(within(row).getByText('Можно выпускать')).toBeInTheDocument();
    expect(within(row).getByText('Деньги готовы к выпуску')).toBeInTheDocument();
  });

  it('renders the blocked row', () => {
    render(<P7MoneySafetyAuditStrip />);

    const row = screen.getByTestId('money-safety-audit-row-blocked');
    expect(within(row).getByText('DL-9112')).toBeInTheDocument();
    expect(within(row).getByText('Заблокировано')).toBeInTheDocument();
    expect(within(row).getByText('Документный пакет не закрыт')).toBeInTheDocument();
  });

  it('renders the review row', () => {
    render(<P7MoneySafetyAuditStrip />);

    const row = screen.getByTestId('money-safety-audit-row-review');
    expect(within(row).getByText('DL-9115')).toBeInTheDocument();
    expect(within(row).getByText('Нужна сверка')).toBeInTheDocument();
    expect(within(row).getByText('Сумма события банка не совпадает')).toBeInTheDocument();
  });
});
