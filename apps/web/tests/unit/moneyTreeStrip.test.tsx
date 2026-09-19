import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MoneyTreeStrip } from '@/components/platform-v7/MoneyTreeStrip';

describe('MoneyTreeStrip', () => {
  it('renders the domain-backed money breakdown without technical copy', () => {
    render(<MoneyTreeStrip />);

    expect(screen.getByTestId('platform-v7-money-tree-strip')).toBeInTheDocument();
    expect(screen.getByText('Деньги · без двойного счёта')).toBeInTheDocument();
    expect(screen.getByText(/Всего в резерве:/)).toBeInTheDocument();
    expect(screen.getByText(/Сверка:/)).toBeInTheDocument();
    expect(screen.queryByText(/MoneyTree/)).not.toBeInTheDocument();
  });
});
