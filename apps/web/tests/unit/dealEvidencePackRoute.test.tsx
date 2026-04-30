import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import DealEvidencePackPage from '@/app/platform-v7/deals/[id]/evidence-pack/page';

describe('DealEvidencePackPage', () => {
  it('renders deal evidence pack preview route', () => {
    render(<DealEvidencePackPage params={{ id: 'DL-9113' }} />);

    expect(screen.getByText('Evidence pack preview · DL-9113')).toBeInTheDocument();
    expect(screen.getByTestId('deal-evidence-pack-preview')).toBeInTheDocument();
    expect(screen.getByTestId('evidence-dispute-continuity-panel')).toBeInTheDocument();
  });

  it('links back to the deal route', () => {
    render(<DealEvidencePackPage params={{ id: 'DL-9113' }} />);

    expect(screen.getByRole('link', { name: 'Назад к сделке' })).toHaveAttribute('href', '/platform-v7/deals/DL-9113');
  });
});
