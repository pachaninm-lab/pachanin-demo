import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import PlatformV7DisputesPage from '@/app/platform-v7/disputes/page';
import PlatformV7BankPage from '@/app/platform-v7/bank/page';

describe('evidence dispute continuity routes', () => {
  it('renders evidence dispute continuity on the disputes page', () => {
    render(<PlatformV7DisputesPage />);

    expect(screen.getByTestId('evidence-dispute-continuity-panel')).toBeInTheDocument();
    expect(screen.getByText(/Доказательный пакет сделки/)).toBeInTheDocument();
    expect(screen.getByText('Evidence pack')).toBeInTheDocument();
    expect(screen.getByText('Money hold / release explanation')).toBeInTheDocument();
  });

  it('renders evidence dispute continuity on the bank page', () => {
    render(<PlatformV7BankPage />);

    expect(screen.getByTestId('evidence-dispute-continuity-panel')).toBeInTheDocument();
    expect(screen.getByText(/Доказательный пакет сделки/)).toBeInTheDocument();
    expect(screen.getByText('Bank decision')).toBeInTheDocument();
    expect(screen.getByText(/simulation-only слой/)).toBeInTheDocument();
  });
});
