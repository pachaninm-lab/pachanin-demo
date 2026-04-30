import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EvidenceExportReadinessSummary } from '@/components/v7r/EvidenceExportReadinessSummary';

describe('EvidenceExportReadinessSummary', () => {
  it('renders export readiness metrics and sandbox boundary', () => {
    render(<EvidenceExportReadinessSummary />);
    expect(screen.getByTestId('evidence-export-readiness-summary')).toBeInTheDocument();
    expect(screen.getByText('Readiness score')).toBeInTheDocument();
    expect(screen.getByText('Evidence linked')).toBeInTheDocument();
    expect(screen.getByText('Audit linked')).toBeInTheDocument();
    expect(screen.getByText('Timeline linked')).toBeInTheDocument();
    expect(screen.getByText(/sandbox preview only/)).toBeInTheDocument();
  });

  it('renders export readiness state breakdown', () => {
    render(<EvidenceExportReadinessSummary />);
    expect(screen.getByTestId('export-readiness-states')).toBeInTheDocument();
    expect(screen.getByText('Ready for preview')).toBeInTheDocument();
    expect(screen.getByText('Needs evidence')).toBeInTheDocument();
    expect(screen.getByText('Needs audit')).toBeInTheDocument();
    expect(screen.getByText('Needs timeline')).toBeInTheDocument();
  });

  it('links readiness states to queue filters', () => {
    render(<EvidenceExportReadinessSummary />);
    expect(screen.getByRole('link', { name: /Открыть готовые/ })).toHaveAttribute('href', '/platform-v7/evidence-pack?decision=Can%20release');
    expect(screen.getAllByRole('link', { name: /Открыть review/ })[0]).toHaveAttribute('href', '/platform-v7/evidence-pack?decision=Review');
  });
});
