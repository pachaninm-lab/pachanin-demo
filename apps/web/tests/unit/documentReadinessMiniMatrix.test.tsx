import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DocumentReadinessMiniMatrix } from '@/components/platform-v7/DocumentReadinessMiniMatrix';
import SellerPage from '@/app/platform-v7/seller/page';
import BuyerPage from '@/app/platform-v7/buyer/page';
import BankPage from '@/app/platform-v7/bank/page';

function expectNoUnsafeCopy(html: string) {
  expect(html).not.toMatch(/production-ready/i);
  expect(html).not.toMatch(/fully live/i);
  expect(html).not.toMatch(/fully integrated/i);
  expect(html).not.toMatch(/платформа гарантирует оплату/i);
  expect(html).not.toMatch(/платформа выпускает деньги/i);
  expect(html).not.toMatch(/деньги переведены/i);
  expect(html).not.toMatch(/выплата выполнена/i);
  expect(html).not.toContain('/platform-v7/demo/');
}

describe('DocumentReadinessMiniMatrix component', () => {
  it('renders container with testid', () => {
    render(<DocumentReadinessMiniMatrix role='seller' />);
    expect(screen.getByTestId('platform-v7-readiness-mini-matrix')).toBeInTheDocument();
  });

  it('renders four rows for seller', () => {
    render(<DocumentReadinessMiniMatrix role='seller' />);
    expect(screen.getAllByTestId('platform-v7-readiness-mini-matrix-row')).toHaveLength(4);
  });

  it('renders four rows for buyer', () => {
    render(<DocumentReadinessMiniMatrix role='buyer' />);
    expect(screen.getAllByTestId('platform-v7-readiness-mini-matrix-row')).toHaveLength(4);
  });

  it('renders four rows for bank', () => {
    render(<DocumentReadinessMiniMatrix role='bank' />);
    expect(screen.getAllByTestId('platform-v7-readiness-mini-matrix-row')).toHaveLength(4);
  });

  it('seller rows include СДИЗ and ЭТрН', () => {
    render(<DocumentReadinessMiniMatrix role='seller' />);
    expect(screen.getByText('СДИЗ')).toBeInTheDocument();
    expect(screen.getByText('ЭТрН')).toBeInTheDocument();
  });

  it('buyer rows include банковское подтверждение резерва', () => {
    render(<DocumentReadinessMiniMatrix role='buyer' />);
    expect(screen.getByText('Банковское подтверждение резерва')).toBeInTheDocument();
  });

  it('bank rows include Основание для банковского события', () => {
    render(<DocumentReadinessMiniMatrix role='bank' />);
    expect(screen.getByText('Основание для банковского события')).toBeInTheDocument();
  });

  it('shows ответственный label in each row', () => {
    render(<DocumentReadinessMiniMatrix role='seller' />);
    expect(screen.getAllByText('ответственный').length).toBeGreaterThan(0);
  });

  it('uses controlled-pilot wording in bank role', () => {
    const { container } = render(<DocumentReadinessMiniMatrix role='bank' />);
    expect(container.innerHTML).toContain('ручная сверка оператором');
    expect(container.innerHTML).toContain('пилотный контур');
    expectNoUnsafeCopy(container.innerHTML);
  });

  it('uses controlled-pilot wording in buyer role', () => {
    const { container } = render(<DocumentReadinessMiniMatrix role='buyer' />);
    expect(container.innerHTML).toContain('ожидает банковского подтверждения');
    expectNoUnsafeCopy(container.innerHTML);
  });

  it('seller role uses no unsafe copy', () => {
    const { container } = render(<DocumentReadinessMiniMatrix role='seller' />);
    expectNoUnsafeCopy(container.innerHTML);
  });

  it('shows summary badge with pending count', () => {
    render(<DocumentReadinessMiniMatrix role='seller' />);
    expect(screen.getByTestId('platform-v7-readiness-mini-matrix-summary')).toBeInTheDocument();
    expect(screen.getByTestId('platform-v7-readiness-mini-matrix-summary').textContent).toMatch(/не готово/);
  });
});

describe('DocumentReadinessMiniMatrix page placement', () => {
  it('seller page renders mini matrix', () => {
    const { container } = render(<SellerPage />);
    expect(screen.getByTestId('platform-v7-readiness-mini-matrix')).toBeInTheDocument();
    expectNoUnsafeCopy(container.innerHTML);
  });

  it('buyer page renders mini matrix', () => {
    const { container } = render(<BuyerPage />);
    expect(screen.getByTestId('platform-v7-readiness-mini-matrix')).toBeInTheDocument();
    expectNoUnsafeCopy(container.innerHTML);
  });

  it('bank page renders mini matrix', () => {
    const { container } = render(<BankPage />);
    expect(screen.getByTestId('platform-v7-readiness-mini-matrix')).toBeInTheDocument();
    expectNoUnsafeCopy(container.innerHTML);
  });
});
