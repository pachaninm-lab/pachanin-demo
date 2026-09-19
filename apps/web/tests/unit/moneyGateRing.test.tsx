import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MoneyGateRing, formatMoneyGateAmount } from '@/components/v7r/MoneyGateRing';

const SEGMENTS = [
  { label: 'Выплачено', amountRub: 0, state: 'released' as const },
  { label: 'В резерве', amountRub: 5_616_000, state: 'reserved' as const },
  { label: 'Удержано по спору', amountRub: 624_000, state: 'held' as const },
];

describe('MoneyGateRing', () => {
  it('renders total, segment labels and amounts with text-duplicated states', () => {
    render(<MoneyGateRing title='Деньги по сделке DL-9102' totalRub={6_240_000} segments={SEGMENTS} />);

    expect(screen.getByTestId('money-gate-ring')).toBeInTheDocument();
    expect(screen.getAllByText('6,24 млн ₽').length).toBeGreaterThan(0);
    expect(screen.getByText('Удержано по спору')).toBeInTheDocument();
    expect(screen.getByText(/удержано$/)).toBeInTheDocument();
    expect(screen.getByText(/в резерве$/)).toBeInTheDocument();
  });

  it('does not claim released money when nothing is released', () => {
    render(<MoneyGateRing title='Деньги по сделке' totalRub={6_240_000} segments={SEGMENTS} />);

    const released = screen.getByText('Выплачено').closest('li');
    expect(released?.textContent).toContain('0 ₽');
  });

  it('formats amounts in honest ruble units', () => {
    expect(formatMoneyGateAmount(9_648_000)).toContain('млн ₽');
    expect(formatMoneyGateAmount(624_000)).toBe('624 тыс. ₽');
    expect(formatMoneyGateAmount(950)).toBe('950 ₽');
  });
});
