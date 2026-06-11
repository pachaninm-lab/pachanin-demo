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
    expect(screen.getAllByText('Удержано').length).toBeGreaterThan(0);
    expect(screen.getAllByText('На проверке').length).toBeGreaterThan(0);
    expect(screen.getAllByText('К выпуску').length).toBeGreaterThan(0);
  });

  it('renders decision controls and visible count', () => {
    render(<EvidencePackOperationsQueue decision='Hold' />);
    expect(screen.getByTestId('evidence-queue-controls')).toBeInTheDocument();
    expect(screen.getByTestId('evidence-queue-visible-count')).toHaveTextContent(/Показано:/);
    expect(screen.getByRole('link', { name: 'Все' })).toHaveAttribute('href', '/platform-v7/evidence-pack');
    expect(screen.getByRole('link', { name: 'Удержано' })).toHaveAttribute('href', '/platform-v7/evidence-pack?decision=Hold');
    expect(screen.getByRole('link', { name: 'На проверке' })).toHaveAttribute('href', '/platform-v7/evidence-pack?decision=Review');
    expect(screen.getByRole('link', { name: 'К выпуску' })).toHaveAttribute('href', '/platform-v7/evidence-pack?decision=Can%20release');
  });

  it('renders row-level missing hints', () => {
    render(<EvidencePackOperationsQueue />);
    expect(screen.getAllByText(/Нужно: документы|Нужно: доказательства|Нужно: журнал|Нужно: линия событий|Данных хватает/).length).toBeGreaterThan(0);
  });

  it('renders active missing filter', () => {
    render(<EvidencePackOperationsQueue decision='Review' missing='evidence' />);
    expect(screen.getByTestId('active-missing-filter')).toHaveTextContent('Фильтр недостающих данных: доказательства');
  });

  it('links missing hints to typed Review filters', () => {
    render(<EvidencePackOperationsQueue />);
    const links = screen.getAllByRole('link').filter((link) => link.getAttribute('href')?.includes('missing='));
    expect(links.length).toBeGreaterThan(0);
    expect(links[0]).toHaveAttribute('href', expect.stringContaining('/platform-v7/evidence-pack?decision=Review&missing='));
  });

  it('links queue rows to deal evidence preview routes', () => {
    render(<EvidencePackOperationsQueue />);
    const previewLinks = screen.getAllByRole('link', { name: 'Открыть пакет' });
    expect(previewLinks.length).toBeGreaterThan(0);
    expect(previewLinks[0]).toHaveAttribute('href', expect.stringContaining('/platform-v7/deals/'));
    expect(previewLinks[0]).toHaveAttribute('href', expect.stringContaining('/evidence-pack'));
  });
});
