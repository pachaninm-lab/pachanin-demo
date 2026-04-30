import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EvidencePackOperationsQueue } from '@/components/v7r/EvidencePackOperationsQueue';

describe('EvidencePackOperationsQueue', () => {
  it('renders evidence operations metrics and queue cards', () => {
    render(<EvidencePackOperationsQueue />);

    expect(screen.getByTestId('evidence-pack-operations-queue')).toBeInTheDocument();
    expect(screen.getByText('Очередь доказательных пакетов')).toBeInTheDocument();
    expect(screen.getByText('Средняя готовность')).toBeInTheDocument();
    expect(screen.getByText('Hold')).toBeInTheDocument();
    expect(screen.getByText('Review')).toBeInTheDocument();
    expect(screen.getByText('Can release')).toBeInTheDocument();
  });

  it('renders decision controls and visible count', () => {
    render(<EvidencePackOperationsQueue decision='Hold' />);

    expect(screen.getByTestId('evidence-queue-controls')).toBeInTheDocument();
    expect(screen.getByTestId('evidence-queue-visible-count')).toHaveTextContent(/Показано:/);
    expect(screen.getByRole('link', { name: 'Все' })).toHaveAttribute('href', '/platform-v7/evidence-pack');
    expect(screen.getByRole('link', { name: 'Hold' })).toHaveAttribute('href', '/platform-v7/evidence-pack?decision=Hold');
    expect(screen.getByRole('link', { name: 'Review' })).toHaveAttribute('href', '/platform-v7/evidence-pack?decision=Review');
    expect(screen.getByRole('link', { name: 'Can release' })).toHaveAttribute('href', '/platform-v7/evidence-pack?decision=Can%20release');
  });

  it('links queue rows to deal evidence preview routes', () => {
    render(<EvidencePackOperationsQueue />);

    const previewLinks = screen.getAllByRole('link', { name: 'Preview' });
    expect(previewLinks.length).toBeGreaterThan(0);
    expect(previewLinks[0]).toHaveAttribute('href', expect.stringContaining('/platform-v7/deals/'));
    expect(previewLinks[0]).toHaveAttribute('href', expect.stringContaining('/evidence-pack'));
  });
});
