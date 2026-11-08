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
const useLocaleMock = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => usePathnameMock(),
}));
vi.mock('next-intl', () => ({ useLocale: () => useLocaleMock() }));

const bankLinks = [
  { href: PLATFORM_V7_BANK_ROUTE, label: 'Банковый контур' },
  { href: PLATFORM_V7_RELEASE_SAFETY_ROUTE, label: 'Проверка выплаты' },
  { href: PLATFORM_V7_BANK_PAYMENT_BASIS_ROUTE, label: 'Передать основание банку' },
] as const;

describe('BankSectionNav', () => {
  beforeEach(() => {
    usePathnameMock.mockReset();
    useLocaleMock.mockReturnValue('ru');
  });

  it('renders only permitted shared navigation with active payment-basis state', () => {
    usePathnameMock.mockReturnValue(PLATFORM_V7_BANK_PAYMENT_BASIS_ROUTE);

    render(<BankSectionNav links={bankLinks} />);

    const paymentBasisLink = screen.getByRole('link', { name: 'Основание выплаты' });
    const homeLink = screen.getByRole('link', { name: 'На главную' });

    expect(screen.getByRole('navigation', { name: 'Банковские действия' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Банковый контур' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Проверка выплаты' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('link')).toHaveLength(2);
    expect(paymentBasisLink).toHaveAttribute('href', PLATFORM_V7_BANK_PAYMENT_BASIS_ROUTE);
    expect(paymentBasisLink).toHaveAttribute('aria-current', 'page');
    expect(paymentBasisLink).toHaveAttribute('data-active', 'true');
    expect(homeLink).toHaveAttribute('href', '/platform-v7');
    expect(homeLink).toHaveAttribute('data-active', 'false');
  });

  it('keeps the main bank tab active only on the exact bank route', () => {
    usePathnameMock.mockReturnValue(PLATFORM_V7_BANK_ROUTE);

    render(<BankSectionNav links={bankLinks} />);

    expect(screen.getByRole('link', { name: 'Банковый контур' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Банковый контур' })).toHaveAttribute('data-active', 'true');
    expect(screen.getByRole('link', { name: 'Основание выплаты' })).toHaveAttribute('data-active', 'false');
    expect(screen.getAllByRole('link')).toHaveLength(3);
  });

  it('changes the visible link set on sibling navigation without remounting', () => {
    usePathnameMock.mockReturnValue(PLATFORM_V7_BANK_ROUTE);
    const mounted = render(<BankSectionNav links={bankLinks} />);
    expect(screen.getAllByRole('link')).toHaveLength(3);
    usePathnameMock.mockReturnValue(PLATFORM_V7_BANK_PAYMENT_BASIS_ROUTE);
    mounted.rerender(<BankSectionNav links={bankLinks} />);
    expect(screen.getAllByRole('link').map(link => link.getAttribute('href'))).toEqual([PLATFORM_V7_BANK_PAYMENT_BASIS_ROUTE, '/platform-v7']);
    usePathnameMock.mockReturnValue(PLATFORM_V7_RELEASE_SAFETY_ROUTE);
    mounted.rerender(<BankSectionNav links={bankLinks} />);
    expect(screen.getByRole('link', { name: 'Проверка выплаты' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getAllByRole('link')).toHaveLength(3);
  });

  it.each([
    { locale: 'en', nav: 'Bank navigation', basis: 'Payment basis', home: 'Platform home' },
    { locale: 'zh', nav: '银行导航', basis: '付款依据', home: '平台首页' },
  ])('localizes the shared safe links in $locale', copy => {
    usePathnameMock.mockReturnValue(PLATFORM_V7_BANK_PAYMENT_BASIS_ROUTE);
    useLocaleMock.mockReturnValue(copy.locale);
    render(<BankSectionNav links={bankLinks} />);
    expect(screen.getByRole('navigation', { name: copy.nav })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: copy.basis })).toHaveAttribute('href', PLATFORM_V7_BANK_PAYMENT_BASIS_ROUTE);
    expect(screen.getByRole('link', { name: copy.home })).toHaveAttribute('href', '/platform-v7');
  });
});
