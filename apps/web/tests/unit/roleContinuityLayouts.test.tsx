import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import BuyerLayout from '@/app/platform-v7/buyer/layout';
import SellerLayout from '@/app/platform-v7/seller/layout';
import BankLayout from '@/app/platform-v7/bank/layout';
import LogisticsLayout from '@/app/platform-v7/logistics/layout';

function Child() {
  return <div data-testid='layout-child'>role child</div>;
}

describe('role continuity route layouts', () => {
  it('renders buyer continuity before buyer page children', () => {
    render(<BuyerLayout><Child /></BuyerLayout>);
    expect(screen.getByTestId('role-continuity-buyer')).toBeInTheDocument();
    expect(screen.getByTestId('layout-child')).toBeInTheDocument();
  });

  it('renders seller continuity before seller page children', () => {
    render(<SellerLayout><Child /></SellerLayout>);
    expect(screen.getByTestId('role-continuity-seller')).toBeInTheDocument();
    expect(screen.getByTestId('layout-child')).toBeInTheDocument();
  });

  it('renders bank continuity before bank page children', () => {
    render(<BankLayout><Child /></BankLayout>);
    expect(screen.getByTestId('role-continuity-bank')).toBeInTheDocument();
    expect(screen.getByTestId('layout-child')).toBeInTheDocument();
  });

  it('renders logistics continuity before logistics page children', () => {
    render(<LogisticsLayout><Child /></LogisticsLayout>);
    expect(screen.getByTestId('role-continuity-logistics')).toBeInTheDocument();
    expect(screen.getByTestId('layout-child')).toBeInTheDocument();
  });
});
