import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { EvidenceDisputeContinuityPanel } from '@/components/v7r/EvidenceDisputeContinuityPanel';

describe('EvidenceDisputeContinuityPanel', () => {
  it('renders evidence, dispute, money and timeline continuity', () => {
    render(<EvidenceDisputeContinuityPanel />);

    const panel = screen.getByTestId('evidence-dispute-continuity-panel');
    expect(within(panel).getByText(/P0-05 · evidence → dispute → money · sandbox/)).toBeInTheDocument();
    expect(within(panel).getByText(/Доказательный пакет сделки/)).toBeInTheDocument();
    expect(within(panel).getByText('Evidence pack')).toBeInTheDocument();
    expect(within(panel).getByText('Dispute context')).toBeInTheDocument();
    expect(within(panel).getByText('Audit trail')).toBeInTheDocument();
    expect(within(panel).getByText('Deal timeline')).toBeInTheDocument();
  });

  it('explains money hold or release decision without live integration claims', () => {
    render(<EvidenceDisputeContinuityPanel />);

    const panel = screen.getByTestId('evidence-dispute-continuity-panel');
    expect(within(panel).getByText('Money hold / release explanation')).toBeInTheDocument();
    expect(within(panel).getByText(/Деньги удерживаются|Есть спорный след|Выпуск ограничен|Спор не блокирует/)).toBeInTheDocument();
    expect(within(panel).getByText(/simulation-only слой/)).toBeInTheDocument();
    expect(within(panel).getByText(/не вызывает боевые банковские, ФГИС или ЭДО-интеграции/)).toBeInTheDocument();
  });

  it('renders dispute pack readiness score, checklist and sandbox export boundary', () => {
    render(<EvidenceDisputeContinuityPanel />);

    const readiness = screen.getByTestId('dispute-pack-readiness');
    expect(within(readiness).getByText('Dispute pack readiness')).toBeInTheDocument();
    expect(within(readiness).getByText(/\d+% ·/)).toBeInTheDocument();
    expect(within(readiness).getByText('Evidence attached')).toBeInTheDocument();
    expect(within(readiness).getByText('Dispute context')).toBeInTheDocument();
    expect(within(readiness).getByText('Audit trail')).toBeInTheDocument();
    expect(within(readiness).getByText('Timeline linked')).toBeInTheDocument();
    expect(within(readiness).getByText('Money decision explained')).toBeInTheDocument();
    expect(within(readiness).getByText(/Export-ready summary: sandbox preview only/)).toBeInTheDocument();
    expect(within(readiness).getByText(/PDF\/ЭДО\/КЭП экспорт не заявлен как live/)).toBeInTheDocument();
  });

  it('links to deal, disputes and bank routes', () => {
    render(<EvidenceDisputeContinuityPanel />);

    const panel = screen.getByTestId('evidence-dispute-continuity-panel');
    expect(within(panel).getByRole('link', { name: 'Открыть сделку' })).toHaveAttribute('href', expect.stringContaining('/platform-v7/deals/'));
    expect(within(panel).getByRole('link', { name: 'Открыть споры' })).toHaveAttribute('href', '/platform-v7/disputes');
    expect(within(panel).getByRole('link', { name: 'Открыть банк' })).toHaveAttribute('href', '/platform-v7/bank');
  });
});
