import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { P7ActionStateChip } from '@/components/platform-v7/P7ActionStateChip';

describe('P7ActionStateChip', () => {
  it('renders label text', () => {
    render(<P7ActionStateChip status='active' label='пилотный сценарий' />);
    expect(screen.getByText('пилотный сценарий')).toBeInTheDocument();
  });

  it('renders status dot with aria-hidden', () => {
    render(<P7ActionStateChip status='waiting' label='ожидание' />);
    const dot = document.querySelector('[data-testid="p7-action-state-dot"]');
    expect(dot).toBeTruthy();
    expect(dot).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders nextActor when provided', () => {
    render(<P7ActionStateChip status='active' label='пилотный сценарий' nextActor='покупатель' />);
    expect(screen.getByTestId('p7-action-state-next')).toHaveTextContent('покупатель');
  });

  it('does not render nextActor when absent', () => {
    render(<P7ActionStateChip status='active' label='пилотный сценарий' />);
    expect(screen.queryByTestId('p7-action-state-next')).toBeNull();
  });

  it('renders blocker when provided', () => {
    render(<P7ActionStateChip status='blocked' label='банковская проверка выплаты' blocker='СДИЗ не закрыт' />);
    expect(screen.getByTestId('p7-action-state-blocker')).toHaveTextContent('СДИЗ не закрыт');
  });

  it('does not render blocker when absent', () => {
    render(<P7ActionStateChip status='active' label='пилотный сценарий' />);
    expect(screen.queryByTestId('p7-action-state-blocker')).toBeNull();
  });

  it('renders moneyEffect when provided', () => {
    render(<P7ActionStateChip status='waiting' label='пилотный сценарий' moneyEffect='выплата остановлена' />);
    expect(screen.getByTestId('p7-action-state-money')).toHaveTextContent('выплата остановлена');
  });

  it('does not render moneyEffect when absent', () => {
    render(<P7ActionStateChip status='active' label='пилотный сценарий' />);
    expect(screen.queryByTestId('p7-action-state-money')).toBeNull();
  });

  it('renders all optional slots together', () => {
    render(
      <P7ActionStateChip
        status='blocked'
        label='банковская проверка выплаты'
        nextActor='оператор'
        blocker='СДИЗ, ЭТрН'
        moneyEffect='удержание до закрытия условий'
      />,
    );
    expect(screen.getByText('банковская проверка выплаты')).toBeInTheDocument();
    expect(screen.getByTestId('p7-action-state-next')).toBeInTheDocument();
    expect(screen.getByTestId('p7-action-state-blocker')).toBeInTheDocument();
    expect(screen.getByTestId('p7-action-state-money')).toBeInTheDocument();
  });

  it('applies correct color for blocked status', () => {
    render(<P7ActionStateChip status='blocked' label='причина остановки' />);
    const chip = screen.getByTestId('p7-action-state-chip');
    expect(chip).toHaveStyle({ border: '1px solid rgba(220,38,38,0.18)' });
  });

  it('applies correct color for manual status', () => {
    render(<P7ActionStateChip status='manual' label='ручная сверка' />);
    const chip = screen.getByTestId('p7-action-state-chip');
    expect(chip).toHaveStyle({ border: '1px solid rgba(15,23,42,0.18)' });
  });
});
