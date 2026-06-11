import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PlatformCommandCenterHub } from '@/components/v7r/PlatformCommandCenterHub';

let activeRole = 'operator';
const setRole = vi.fn((next: string) => { activeRole = next; });

vi.mock('@/stores/usePlatformV7RStore', () => ({
  usePlatformV7RStore: () => ({ role: activeRole, setRole }),
}));

const forbiddenClaims = [
  /production-ready/i,
  /simulation-grade/i,
  /fully live/i,
  /fully integrated/i,
  /платформа гарантирует оплату/i,
  /деньги переведены/i,
];

describe('PlatformCommandCenterHub', () => {
  beforeEach(() => {
    activeRole = 'operator';
  });

  it('renders the premium command center entry without production claims', () => {
    const { container } = render(<PlatformCommandCenterHub />);

    const root = container.querySelector("main[data-role='operator']");
    expect(root).not.toBeNull();
    expect(root).toHaveAttribute('data-theme', 'light');
    expect(screen.getByRole('heading', { level: 1, name: /Пшеница 4 класс · LOT-2403/ })).toBeInTheDocument();

    const html = container.innerHTML;
    for (const claim of forbiddenClaims) expect(html).not.toMatch(claim);
    expect(html).not.toContain('/platform-v7/demo/');
  });

  it('renders deal status, core snapshot and next action for the operator', () => {
    render(<PlatformCommandCenterHub />);

    expect(screen.getByLabelText('Состояние сделки')).toBeInTheDocument();
    expect(screen.getByLabelText('Главное по сделке')).toBeInTheDocument();
    expect(screen.getByLabelText('Следующее действие')).toBeInTheDocument();
    expect(screen.getByLabelText('Деньги по сделке')).toBeInTheDocument();
    expect(screen.getAllByText('DL-9106').length).toBeGreaterThan(0);
  });

  it('keeps the driver store role on the field shell without money surfaces', () => {
    activeRole = 'driver';
    render(<PlatformCommandCenterHub />);

    expect(screen.queryByLabelText('Деньги по сделке')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Сводка документов')).not.toBeInTheDocument();
    expect(screen.getAllByText(/рейс/i).length).toBeGreaterThan(0);
  });
});
