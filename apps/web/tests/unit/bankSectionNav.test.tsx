import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BankSectionNav } from '@/components/platform-v7/BankSectionNav';
import {
  PLATFORM_V7_BANK_PAYMENT_BASIS_ROUTE,
  PLATFORM_V7_BANK_ROUTE,
  PLATFORM_V7_RELEASE_SAFETY_ROUTE,
} from '@/lib/platform-v7/routes';

const usePathnameMock = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => usePathnameMock(),
}));

const bankLinks = [
  { href: PLATFORM_V7_BANK_ROUTE, label: 'Банковый контур' },
  { href: PLATFORM_V7_RELEASE_SAFETY_ROUTE, label: 'Проверка выплаты' },
  { href: PLATFORM_V7_BANK_PAYMENT_BASIS_ROUTE, label: 'Передать основание банку' },
] as const;

describe('BankSectionNav', () => {
  beforeEach(() => {
    usePathnameMock.mockReset();
  });

  it('renders compact bank navigation with active payment-basis state', () => {
    usePathnameMock.mockReturnValue(PLATFORM_V7_BANK_PAYMENT_BASIS_ROUTE);

    render(<BankSectionNav links={bankLinks} />);

    const bankLink = screen.getByRole('link', { name: 'Банковый контур' });
    const releaseSafetyLink = screen.getByRole('link', { name: 'Проверка выплаты' });
    const paymentBasisLink = screen.getByRole('link', { name: 'Передать основание банку' });

    expect(screen.getByRole('navigation', { name: 'Банковские действия' })).toBeInTheDocument();
    expect(bankLink).toHaveAttribute('href', PLATFORM_V7_BANK_ROUTE);
    expect(releaseSafetyLink).toHaveAttribute('href', PLATFORM_V7_RELEASE_SAFETY_ROUTE);
    expect(paymentBasisLink).toHaveAttribute('href', PLATFORM_V7_BANK_PAYMENT_BASIS_ROUTE);
    expect(paymentBasisLink).toHaveAttribute('aria-current', 'page');
    expect(paymentBasisLink).toHaveAttribute('data-active', 'true');
    expect(bankLink).toHaveAttribute('data-active', 'false');
    expect(releaseSafetyLink).toHaveAttribute('data-active', 'false');
  });

  it('keeps the main bank tab active only on the exact bank route', () => {
    usePathnameMock.mockReturnValue(PLATFORM_V7_BANK_ROUTE);

    render(<BankSectionNav links={bankLinks} />);

    expect(screen.getByRole('link', { name: 'Банковый контур' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Банковый контур' })).toHaveAttribute('data-active', 'true');
    expect(screen.getByRole('link', { name: 'Передать основание банку' })).toHaveAttribute('data-active', 'false');
  });
});
