import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import HealthPage from '@/app/platform-v7/health/page';

describe('PR-6 health screen page', () => {
  it('renders the health cockpit with key observability sections', () => {
    render(<HealthPage />);
    expect(screen.getByTestId('platform-v7-health-page')).toBeInTheDocument();
    expect(screen.getByText(/Manual Review Queue/)).toBeInTheDocument();
    expect(screen.getByText(/Stuck Deal Monitor/)).toBeInTheDocument();
    expect(screen.getByText(/Adapter Health · pre-integration/)).toBeInTheDocument();
  });
});
