import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { RoleContinuityPanel } from '@/components/v7r/RoleContinuityPanel';

describe('RoleContinuityPanel', () => {
  it.each(['driver', 'lab', 'bank', 'buyer', 'seller', 'logistics'] as const)('renders %s continuity shell', (role) => {
    render(<RoleContinuityPanel role={role} compact />);

    const panel = screen.getByTestId(`role-continuity-${role}`);
    expect(within(panel).getByRole('link', { name: 'Открыть сделку' })).toHaveAttribute('href', expect.stringContaining('/platform-v7/deals/'));
    expect(within(panel).getByRole('link', { name: 'Открыть контур' })).toHaveAttribute('href', expect.stringContaining('/platform-v7/'));
    expect(within(panel).getAllByText('Следующее действие').length).toBeGreaterThan(0);
    expect(within(panel).getByText('Доказательства')).toBeInTheDocument();
    expect(within(panel).getByText('Журнал')).toBeInTheDocument();
    expect(within(panel).getByText('Линия событий')).toBeInTheDocument();
  });

  it('keeps role-specific routes stable', () => {
    render(
      <>
        <RoleContinuityPanel role='bank' />
        <RoleContinuityPanel role='lab' compact />
        <RoleContinuityPanel role='logistics' compact />
      </>,
    );

    expect(within(screen.getByTestId('role-continuity-bank')).getByRole('link', { name: 'Открыть контур' })).toHaveAttribute('href', '/platform-v7/bank');
    expect(within(screen.getByTestId('role-continuity-lab')).getByRole('link', { name: 'Открыть контур' })).toHaveAttribute('href', '/platform-v7/lab');
    expect(within(screen.getByTestId('role-continuity-logistics')).getByRole('link', { name: 'Открыть контур' })).toHaveAttribute('href', '/platform-v7/logistics');
  });
});
