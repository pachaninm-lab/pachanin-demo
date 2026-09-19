import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { P7PersistenceQueueStatus } from '@/components/platform-v7/P7PersistenceQueueStatus';

describe('P7PersistenceQueueStatus', () => {
  it('renders persistence shell and pilot-only disclaimer', () => {
    render(<P7PersistenceQueueStatus />);

    expect(screen.getByTestId('persistence-queue-status')).toBeInTheDocument();
    expect(screen.getByText('Статус журнала и очереди')).toBeInTheDocument();
    expect(screen.getByText(/controlled-pilot слой данных/i)).toBeInTheDocument();
    expect(screen.getAllByText(/неизменяем/i).length).toBeGreaterThan(0);
  });

  it('renders stable ledger, queue, manual review and timeline metrics', () => {
    render(<P7PersistenceQueueStatus />);

    const shell = screen.getByTestId('persistence-queue-status');
    expect(within(shell).getByText('Записи журнала')).toBeInTheDocument();
    expect(within(shell).getByText('Элементы очереди')).toBeInTheDocument();
    expect(within(shell).getByText('Ручная проверка')).toBeInTheDocument();
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
