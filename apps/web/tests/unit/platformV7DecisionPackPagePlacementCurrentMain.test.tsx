import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import BankPage from '@/app/platform-v7/bank/page';
import DisputesPage from '@/app/platform-v7/disputes/page';

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

function assertNoForbiddenWording(text: string, label: string) {
  for (const pattern of FORBIDDEN_WORDING) {
    expect(text, `${label} contains forbidden wording: ${pattern}`).not.toMatch(pattern);
  }

  expect(text).not.toContain('/platform-v7/demo/');
}

describe('platform-v7 decision pack page placement', () => {
  it('renders the decision pack mini panel on the bank page', () => {
    const { container } = render(React.createElement(BankPage));

    expect(screen.getByTestId('platform-v7-decision-pack-mini-panel')).toBeInTheDocument();
    expect(container.textContent ?? '').toContain('банк · условия выплаты');
    expect(container.textContent ?? '').toContain('ручная проверка');
    assertNoForbiddenWording(container.textContent ?? '', 'bank page decision pack placement');
  });

  it('renders the decision pack mini panel on the disputes page', () => {
    const { container } = render(React.createElement(DisputesPage));

    expect(screen.getByTestId('platform-v7-decision-pack-mini-panel')).toBeInTheDocument();
    expect(container.textContent ?? '').toContain('DL-9102 · спор и удержание');
    expect(container.textContent ?? '').toContain('ручная проверка');
    assertNoForbiddenWording(container.textContent ?? '', 'disputes page decision pack placement');
  });
});
