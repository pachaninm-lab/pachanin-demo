import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import EvidencePackIndexPage from '@/app/platform-v7/evidence-pack/page';

describe('EvidencePackIndexPage', () => {
  it('renders evidence pack operations and sample deal links', () => {
    render(<EvidencePackIndexPage />);
    expect(screen.getByTestId('evidence-export-readiness-summary')).toBeInTheDocument();
    expect(screen.getByTestId('evidence-pack-operations-queue')).toBeInTheDocument();
    expect(screen.getByTestId('evidence-pack-index')).toBeInTheDocument();
    expect(screen.getByText('Операции с доказательными пакетами')).toBeInTheDocument();
    expect(screen.getAllByText(/DL-9113/).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /DL-9113/ })).toHaveAttribute('href', '/platform-v7/deals/DL-9113/evidence-pack');
  });

  it('accepts decision search params', () => {
    render(<EvidencePackIndexPage searchParams={{ decision: 'Hold' }} />);
    expect(screen.getByTestId('evidence-queue-controls')).toBeInTheDocument();
    expect(screen.getByTestId('evidence-queue-visible-count')).toHaveTextContent(/Показано:/);
  });

  it('accepts missing search params', () => {
    render(<EvidencePackIndexPage searchParams={{ decision: 'Review', missing: 'evidence' }} />);
    expect(screen.getByTestId('active-missing-filter')).toHaveTextContent('Фильтр недостающих данных: доказательства');
  });

  it('falls back to all for invalid missing search params', () => {
    render(<EvidencePackIndexPage searchParams={{ decision: 'Review', missing: 'wrong' }} />);
    expect(screen.queryByTestId('active-missing-filter')).not.toBeInTheDocument();
    expect(screen.getByTestId('evidence-queue-visible-count')).toHaveTextContent(/Показано:/);
  });

  it('keeps sandbox boundary visible', () => {
    render(<EvidencePackIndexPage />);
    expect(screen.getByText(/Операционный индекс доказательных пакетов/)).toBeInTheDocument();
    expect(screen.getByText(/Навигация не запускает внешний PDF, ЭДО, КЭП, банк, ФГИС или СберКорус/)).toBeInTheDocument();
  });
});
