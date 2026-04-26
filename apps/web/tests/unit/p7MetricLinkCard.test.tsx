import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { P7MetricLinkCard } from '@/components/platform-v7/P7MetricLinkCard';

describe('P7MetricLinkCard', () => {
  it('renders link wrapper and content', () => {
    render(<P7MetricLinkCard href='/platform-v7/deals' title='Metric' value='42' note='note' formula='details' tone='info' testId='metric-link' />);

    const link = screen.getByTestId('metric-link');
    expect(link).toHaveAttribute('href', '/platform-v7/deals');
    expect(link).toHaveAttribute('title', 'details');
    expect(screen.getByText('Metric')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('note')).toBeInTheDocument();
    expect(screen.getByText('Открыть →')).toBeInTheDocument();
  });
});
