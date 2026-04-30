import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EvidenceExportReadinessSummary } from '@/components/v7r/EvidenceExportReadinessSummary';

describe('EvidenceExportReadinessSummary', () => {
  it('renders export readiness metrics and sandbox boundary', () => {
    render(<EvidenceExportReadinessSummary />);

    expect(screen.getByTestId('evidence-export-readiness-summary')).toBeInTheDocument();
    expect(screen.getByText('Готовность доказательных пакетов к preview-export')).toBeInTheDocument();
    expect(screen.getByText('Readiness score')).toBeInTheDocument();
    expect(screen.getByText('Evidence linked')).toBeInTheDocument();
    expect(screen.getByText('Audit linked')).toBeInTheDocument();
    expect(screen.getByText('Timeline linked')).toBeInTheDocument();
    expect(screen.getByText(/sandbox preview only/)).toBeInTheDocument();
  });
});
