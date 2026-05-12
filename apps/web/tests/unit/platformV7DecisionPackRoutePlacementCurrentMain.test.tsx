import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SellerLayout from '@/app/platform-v7/seller/layout';
import BuyerLayout from '@/app/platform-v7/buyer/layout';
import ElevatorLayout from '@/app/platform-v7/elevator/layout';

const navigationMock = vi.hoisted(() => ({ pathname: '/platform-v7/seller' }));

vi.mock('next/navigation', () => ({
  usePathname: () => navigationMock.pathname,
}));

const FORBIDDEN_WORDING = [
  /production-ready/i,
  /fully live/i,
  /fully integrated/i,
  /live callback/i,
  /platform releases money by itself/i,
  /platform guarantees payment/i,
  /деньги переведены/i,
  /выплата выполнена/i,
  /платформа выпускает деньги/i,
  /платформа гарантирует оплату/i,
  /нет рисков/i,
];

function renderLayout(Layout: (props: { children: React.ReactNode }) => React.ReactNode) {
  return render(React.createElement(Layout, null, React.createElement('div', null, 'page content')));
}

function assertNoForbiddenWording(text: string, label: string) {
  for (const pattern of FORBIDDEN_WORDING) {
    expect(text, `${label} contains forbidden wording: ${pattern}`).not.toMatch(pattern);
  }

  expect(text).not.toContain('/platform-v7/demo/');
}

describe('platform-v7 guarded decision pack route placement', () => {
  it('renders seller decision pack only on the exact seller route', () => {
    navigationMock.pathname = '/platform-v7/seller';
    const { container, unmount } = renderLayout(SellerLayout);

    expect(screen.getByTestId('platform-v7-decision-pack-mini-panel')).toBeInTheDocument();
    expect(container.textContent ?? '').toContain('продавец · передача документов');
    assertNoForbiddenWording(container.textContent ?? '', 'seller decision pack route placement');

    unmount();
    navigationMock.pathname = '/platform-v7/seller/batches/new';
    renderLayout(SellerLayout);

    expect(screen.queryByTestId('platform-v7-decision-pack-mini-panel')).not.toBeInTheDocument();
  });

  it('keeps seller decision pack on the normalized seller route', () => {
    navigationMock.pathname = '/platform-v7/seller/';
    const { container } = renderLayout(SellerLayout);

    expect(screen.getByTestId('platform-v7-decision-pack-mini-panel')).toBeInTheDocument();
    expect(container.textContent ?? '').toContain('продавец · передача документов');
    assertNoForbiddenWording(container.textContent ?? '', 'seller decision pack normalized route placement');
  });

  it('renders buyer decision pack only on the exact buyer route', () => {
    navigationMock.pathname = '/platform-v7/buyer';
    const { container, unmount } = renderLayout(BuyerLayout);

    expect(screen.getByTestId('platform-v7-decision-pack-mini-panel')).toBeInTheDocument();
    expect(container.textContent ?? '').toContain('покупатель · запрос резерва');
    assertNoForbiddenWording(container.textContent ?? '', 'buyer decision pack route placement');

    unmount();
    navigationMock.pathname = '/platform-v7/buyer/rfq/new';
    renderLayout(BuyerLayout);

    expect(screen.queryByTestId('platform-v7-decision-pack-mini-panel')).not.toBeInTheDocument();
  });

  it('renders elevator decision pack only on the exact elevator route', () => {
    navigationMock.pathname = '/platform-v7/elevator';
    const { container, unmount } = renderLayout(ElevatorLayout);

    expect(screen.getByTestId('platform-v7-decision-pack-mini-panel')).toBeInTheDocument();
    expect(container.textContent ?? '').toContain('DL-9102 · спор и удержание');
    assertNoForbiddenWording(container.textContent ?? '', 'elevator decision pack route placement');

    unmount();
    navigationMock.pathname = '/platform-v7/elevator/intake';
    renderLayout(ElevatorLayout);

    expect(screen.queryByTestId('platform-v7-decision-pack-mini-panel')).not.toBeInTheDocument();
  });
});
