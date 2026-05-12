import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import BankReleaseSafetyPage from '@/app/platform-v7/bank/release-safety/page';

describe('platform-v7 DL-9106 panel placement', () => {
  it('renders the DL-9106 decision pack on the release safety page', () => {
    const { container } = render(<BankReleaseSafetyPage />);
    const text = container.textContent ?? '';

    expect(screen.getByTestId('platform-v7-decision-pack-mini-panel')).toBeInTheDocument();
    expect(text).toContain('DL-9106 · проверка выплаты');
    expect(text).not.toContain('/platform-v7/demo/');
  });
});
