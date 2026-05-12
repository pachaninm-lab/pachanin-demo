import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import PlatformV7BankPage from '@/app/platform-v7/bank/page';

describe('platform-v7 bank release review decision pack placement', () => {
  it('keeps the bank release review decision pack on the bank page', () => {
    const { container } = render(<PlatformV7BankPage />);
    const text = container.textContent ?? '';

    expect(screen.getAllByTestId('platform-v7-decision-pack-mini-panel')).toHaveLength(1);
    expect(text).toContain('банк · условия выплаты');
    expect(text).toContain('банк не должен продолжать проверку выплаты без закрытых документов');
    expect(text).toContain('ручная проверка');
    expect(text).not.toContain('/platform-v7/demo/');
    expect(text).not.toMatch(/production-ready|fully live|fully integrated/i);
    expect(text).not.toContain('платформа выпускает деньги');
  });
});
