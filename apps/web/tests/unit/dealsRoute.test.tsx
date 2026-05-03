import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import PlatformV7DealsPage from '@/app/platform-v7/deals/page';
import PlatformV7DealDetailPage from '@/app/platform-v7/deals/[id]/page';

const redirectMock = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}));

describe('PlatformV7 deals routes', () => {
  beforeEach(() => {
    redirectMock.mockClear();
  });

  it('renders deals overview with money, risk and execution context', () => {
    render(<PlatformV7DealsPage />);

    expect(screen.getByText('Сделки')).toBeInTheDocument();
    expect(screen.getByText('Операционный обзор сделок')).toBeInTheDocument();
    expect(screen.getByText('Сделки в домене')).toBeInTheDocument();
    expect(screen.getByText('Под удержанием')).toBeInTheDocument();
    expect(screen.getByText('К выпуску')).toBeInTheDocument();
    expect(screen.getByText('Высокий риск')).toBeInTheDocument();
    expect(screen.getAllByRole('link').some((link) => link.getAttribute('href') === '/platform-v7/deals/DL-9102')).toBe(true);
  });

  it('redirects deal detail route to the clean deal card', () => {
    PlatformV7DealDetailPage({ params: { id: 'DL-9102' } });

    expect(redirectMock).toHaveBeenCalledWith('/platform-v7/deals/DL-9102/clean');
  });
});
