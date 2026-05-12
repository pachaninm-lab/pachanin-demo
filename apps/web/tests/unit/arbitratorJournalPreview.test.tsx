import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import PlatformV7ArbitratorPage from '@/app/platform-v7/arbitrator/page';
import { JournalPreview } from '@/components/platform-v7/JournalPreview';
import { getJournalPreviewEntries } from '@/lib/platform-v7/journal-preview';

describe('arbitrator journal preview', () => {
  it('returns arbitrator-specific entries', () => {
    const entries = getJournalPreviewEntries('arbitrator', 10);

    expect(entries.length).toBeGreaterThan(0);
    expect(entries.some((entry) => entry.actor === 'арбитр')).toBe(true);
    expect(entries.some((entry) => entry.objectId === 'DK-2024-89')).toBe(true);
    expect(entries.some((entry) => entry.objectId === 'DL-9102')).toBe(true);
  });

  it('renders journal preview with arbitrator role attribute', () => {
    render(<JournalPreview role='arbitrator' />);

    const preview = screen.getByTestId('journal-preview');
    expect(preview).toHaveAttribute('data-role', 'arbitrator');
    expect(screen.getAllByTestId('journal-preview-entry').length).toBeGreaterThan(0);
    expect(preview.innerHTML).toContain('DK-2024-89');
  });

  it('renders on platform-v7 arbitrator page after the decision guard', () => {
    render(<PlatformV7ArbitratorPage />);

    expect(screen.getByTestId('platform-v7-arbitrator-decision-guard')).toBeInTheDocument();
    const preview = screen.getByTestId('journal-preview');
    expect(preview).toHaveAttribute('data-role', 'arbitrator');
    expect(preview.innerHTML).toContain('журнал сделки');
  });
});
