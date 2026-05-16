import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { P7PersistenceQueueStatus } from '@/components/platform-v7/P7PersistenceQueueStatus';

describe('P7PersistenceQueueStatus', () => {
  it('renders persistence shell and bank-check disclaimer', () => {
    render(<P7PersistenceQueueStatus />);

    expect(screen.getByTestId('persistence-queue-status')).toBeInTheDocument();
    expect(screen.getByText('Статус очереди подтверждений')).toBeInTheDocument();
    expect(screen.getByText(/операционный журнал статусов/i)).toBeInTheDocument();
    expect(screen.getByText('Журнал · без удаления')).toBeInTheDocument();
  });

  it('renders stable ledger, queue, manual review and timeline metrics', () => {
    render(<P7PersistenceQueueStatus />);

    const shell = screen.getByTestId('persistence-queue-status');
    expect(within(shell).getByText('Записи журнала')).toBeInTheDocument();
    expect(within(shell).getByText('Элементы очереди')).toBeInTheDocument();
    expect(within(shell).getByText('Ручная сверка')).toBeInTheDocument();
    expect(within(shell).getByText('События сделки')).toBeInTheDocument();
    expect(within(shell).getByText('3')).toBeInTheDocument();
    expect(within(shell).getAllByText('8')).toHaveLength(2);
    expect(within(shell).getByText('1')).toBeInTheDocument();
  });

  it('renders the manual reconciliation queue item with idempotency key', () => {
    render(<P7PersistenceQueueStatus />);

    const item = screen.getByTestId('manual-reconciliation-item');
    expect(within(item).getByText('DL-9102')).toBeInTheDocument();
    expect(within(item).getByText('AMOUNT_MISMATCH')).toBeInTheDocument();
    expect(within(item).getByText(/money:dl-9102:hold_applied:sber_safe_deals:cb-442/i)).toBeInTheDocument();
  });
});
