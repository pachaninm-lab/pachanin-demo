import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { P7Grid, P7LinkButton, P7MetricCard, P7Notice, P7PanelShell, P7StatusPill } from '@/components/platform-v7/P7UiPrimitives';

describe('P7UiPrimitives', () => {
  it('renders shell, status, metric, notice and grid primitives', () => {
    render(
      <P7PanelShell>
        <P7StatusPill tone='green'>Готово</P7StatusPill>
        <P7MetricCard title='К выпуску' value='12 млн ₽' note='sandbox metric' tone='green' />
        <P7Notice title='Правило' tone='amber'>Без live-claims</P7Notice>
        <P7Grid>
          <div>Grid item</div>
        </P7Grid>
      </P7PanelShell>,
    );

    expect(screen.getByText('Готово')).toBeInTheDocument();
    expect(screen.getByText('К выпуску')).toBeInTheDocument();
    expect(screen.getByText('12 млн ₽')).toBeInTheDocument();
    expect(screen.getByText('sandbox metric')).toBeInTheDocument();
    expect(screen.getByText('Правило')).toBeInTheDocument();
    expect(screen.getByText('Без live-claims')).toBeInTheDocument();
    expect(screen.getByText('Grid item')).toBeInTheDocument();
  });

  it('renders platform links through Link primitive', () => {
    render(<P7LinkButton href='/platform-v7/bank'>Банк</P7LinkButton>);
    expect(screen.getByRole('link', { name: 'Банк' })).toHaveAttribute('href', '/platform-v7/bank');
  });
});
