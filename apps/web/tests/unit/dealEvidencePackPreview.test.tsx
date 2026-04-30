import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { DealEvidencePackPreview } from '@/components/v7r/DealEvidencePackPreview';

describe('DealEvidencePackPreview', () => {
  it('renders deal-level evidence pack preview with shared evidence continuity', () => {
    render(<DealEvidencePackPreview dealId='DL-9113' />);

    const preview = screen.getByTestId('deal-evidence-pack-preview');
    expect(within(preview).getByText('P0-06 · deal-level evidence pack · sandbox')).toBeInTheDocument();
    expect(within(preview).getByText('Evidence pack preview по сделке DL-9113')).toBeInTheDocument();
    expect(within(preview).getByText(/без live PDF, ЭДО или КЭП-экспорта/)).toBeInTheDocument();
    expect(within(preview).getByTestId('evidence-dispute-continuity-panel')).toBeInTheDocument();
    expect(within(preview).getByText('Dispute pack readiness')).toBeInTheDocument();
  });

  it('links deal preview to deal, disputes and bank routes', () => {
    render(<DealEvidencePackPreview dealId='DL-9113' />);

    const preview = screen.getByTestId('deal-evidence-pack-preview');
    expect(within(preview).getByRole('link', { name: 'Сделка' })).toHaveAttribute('href', '/platform-v7/deals/DL-9113');
    expect(within(preview).getByRole('link', { name: 'Споры' })).toHaveAttribute('href', '/platform-v7/disputes');
    expect(within(preview).getByRole('link', { name: 'Банк' })).toHaveAttribute('href', '/platform-v7/bank');
  });
});
