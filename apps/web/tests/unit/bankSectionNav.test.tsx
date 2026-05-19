import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BankSectionNav } from '@/components/platform-v7/BankSectionNav';
import {
  PLATFORM_V7_BANK_PAYMENT_BASIS_ROUTE,
  PLATFORM_V7_BANK_ROUTE,
  PLATFORM_V7_RELEASE_SAFETY_ROUTE,
} from '@/lib/platform-v7/routes';

const bankLinks = [
  { href: PLATFORM_V7_BANK_ROUTE, label: 'Банковый контур' },
  { href: PLATFORM_V7_RELEASE_SAFETY_ROUTE, label: 'Проверка выплаты' },
  { href: PLATFORM_V7_BANK_PAYMENT_BASIS_ROUTE, label: 'Передать основание банку' },
] as const;

describe('BankSectionNav', () => {
  it('renders compact bank navigation with active payment-basis state', () => {
    window.history.pushState({}, '', PLATFORM_V7_BANK_PAYMENT_BASIS_ROUTE);

    render(<BankSectionNav links={bankLinks} />);

    expect(screen.getByRole('navigation', { name: 'Банковские действия' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Банковый контур' })).toHaveAttribute('href', PLATFORM_V7_BANK_ROUTE);
    expect(screen.getByRole('link', { name: 'Проверка выплаты' })).toHaveAttribute('href', PLATFORM_V7_RELEASE_SAFETY_ROUTE);
    expect(screen.getByRole('link', { name: 'Передать основание банку' })).toHaveAttribute(
      'href',
      PLATFORM_V7_BANK_PAYMENT_BASIS_ROUTE,
    );
    expect(screen.getByRole('link', { name: 'Передать основание банку' })).toHaveAttribute('aria-current', 'page');
  });
});
