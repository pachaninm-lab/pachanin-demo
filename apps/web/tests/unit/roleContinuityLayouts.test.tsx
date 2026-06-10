import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import BuyerLayout from '@/app/platform-v7/buyer/layout';
import SellerLayout from '@/app/platform-v7/seller/layout';
import BankLayout from '@/app/platform-v7/bank/layout';
import LogisticsLayout from '@/app/platform-v7/logistics/layout';

const usePathname = vi.fn(() => '/platform-v7/buyer');

vi.mock('next/navigation', () => ({
  usePathname: () => usePathname(),
}));

vi.mock('next/headers', () => ({
  cookies: () => ({ get: () => undefined }),
}));

function Child() {
  return <div data-testid='layout-child'>role child</div>;
}

describe('role continuity route layouts', () => {
  it('renders buyer decision pack alongside buyer page children', () => {
    usePathname.mockReturnValue('/platform-v7/buyer');
    render(<BuyerLayout><Child /></BuyerLayout>);
    expect(screen.getByTestId('layout-child')).toBeInTheDocument();
    expect(screen.getByTestId('platform-v7-decision-pack-mini-panel')).toBeInTheDocument();
  });

  it('renders seller decision pack alongside seller page children', () => {
    usePathname.mockReturnValue('/platform-v7/seller');
    render(<SellerLayout><Child /></SellerLayout>);
    expect(screen.getByTestId('layout-child')).toBeInTheDocument();
    expect(screen.getByTestId('platform-v7-decision-pack-mini-panel')).toBeInTheDocument();
  });

  it('keeps bank children behind the RBAC guard with bank section nav', () => {
    render(<BankLayout><Child /></BankLayout>);
    expect(screen.getByTestId('layout-child')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Банковские действия' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Банковый контур' })).toHaveAttribute('href', '/platform-v7/bank');
  });

  it('renders logistics page children', () => {
    render(<LogisticsLayout><Child /></LogisticsLayout>);
    expect(screen.getByTestId('layout-child')).toBeInTheDocument();
  });
});
