import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EvidenceExportReadinessSummary } from '@/components/v7r/EvidenceExportReadinessSummary';

describe('EvidenceExportReadinessSummary', () => {
  it('renders export readiness metrics and sandbox boundary', () => {
    render(<EvidenceExportReadinessSummary />);
    expect(screen.getByTestId('evidence-export-readiness-summary')).toBeInTheDocument();
    expect(screen.getAllByText('Готовность').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Доказательства').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Журнал').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Линия событий').length).toBeGreaterThan(0);
    expect(screen.getByText(/Граница просмотра: проверочный контур/)).toBeInTheDocument();
  });

  it('renders export readiness state breakdown', () => {
    render(<EvidenceExportReadinessSummary />);
    expect(screen.getByTestId('export-readiness-states')).toBeInTheDocument();
    expect(screen.getByText('Готовы к просмотру')).toBeInTheDocument();
    expect(screen.getByText('Нужны доказательства')).toBeInTheDocument();
    expect(screen.getByText('Нужны записи журнала')).toBeInTheDocument();
    expect(screen.getByText('Нужна линия событий')).toBeInTheDocument();
  });

  it('links readiness states to queue filters', () => {
    render(<EvidenceExportReadinessSummary />);
    expect(screen.getByRole('link', { name: /Открыть готовые/ })).toHaveAttribute('href', '/platform-v7/evidence-pack?decision=Can%20release');
    expect(screen.getAllByRole('link', { name: /Открыть проверку/ })[0]).toHaveAttribute('href', '/platform-v7/evidence-pack?decision=Review');
  });
});
