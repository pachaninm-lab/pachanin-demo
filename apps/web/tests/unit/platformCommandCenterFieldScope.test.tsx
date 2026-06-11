import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PlatformCommandCenterHub } from '@/components/v7r/PlatformCommandCenterHub';

let activeRole = 'driver';
const setRole = vi.fn();

vi.mock('@/stores/usePlatformV7RStore', () => ({
  usePlatformV7RStore: () => ({ role: activeRole, setRole }),
}));

describe('PlatformCommandCenterHub field scope', () => {
  beforeEach(() => {
    activeRole = 'driver';
  });

  it('renders a field-safe command center for driver role', () => {
    const { container } = render(<PlatformCommandCenterHub />);
    const text = container.textContent || '';

    expect(screen.getAllByText(/рейс/i).length).toBeGreaterThan(0);
    expect(screen.queryByLabelText('Деньги по сделке')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Сводка документов')).not.toBeInTheDocument();
    expect(text).not.toMatch(/банковск/i);
    expect(text).not.toMatch(/проверка выплаты/i);
  });

  it('keeps full command center for operator role', () => {
    activeRole = 'operator';
    render(<PlatformCommandCenterHub />);

    expect(screen.getByLabelText('Состояние сделки')).toBeInTheDocument();
    expect(screen.getByLabelText('Деньги по сделке')).toBeInTheDocument();
    expect(screen.getByLabelText('Следующее действие')).toBeInTheDocument();
  });
});
