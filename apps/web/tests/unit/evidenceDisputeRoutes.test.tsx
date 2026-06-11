import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import PlatformV7DisputesPage from '@/app/platform-v7/disputes/page';
import PlatformV7BankPage from '@/app/platform-v7/bank/page';

describe('evidence dispute continuity routes', () => {
  it('renders evidence dispute continuity on the disputes page', async () => {
    render(await PlatformV7DisputesPage());

    expect(screen.getByTestId('platform-v7-evidence-readiness-mini-matrix')).toBeInTheDocument();
    expect(screen.getAllByText(/[Дд]оказательн/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/пакет/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/удержан/i).length).toBeGreaterThan(0);
  });

  it('renders evidence dispute continuity on the bank page', async () => {
    render(await PlatformV7BankPage());

    expect(screen.getByTestId('platform-v7-evidence-readiness-mini-matrix')).toBeInTheDocument();
    expect(screen.getAllByText(/[Дд]оказательн/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/банковск[а-яё]+ провер/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/удержан/i).length).toBeGreaterThan(0);
  });
});
