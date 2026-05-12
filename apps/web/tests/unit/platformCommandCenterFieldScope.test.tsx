import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PlatformCommandCenterHub } from '@/components/v7r/PlatformCommandCenterHub';

let activeRole = 'driver';
const setRole = vi.fn();

vi.mock('@/stores/usePlatformV7RStore', () => ({
  usePlatformV7RStore: () => ({ role: activeRole, setRole }),
}));

describe('PlatformCommandCenterHub field scope', () => {
  it('renders a field-safe command center for driver role', () => {
    activeRole = 'driver';
    const { container } = render(<PlatformCommandCenterHub />);
    const text = container.textContent || '';

    expect(screen.getByTestId('platform-command-center-field-hero')).toBeInTheDocument();
    expect(screen.getByText('Работа по моему рейсу')).toBeInTheDocument();
    expect(screen.getByText('Открыть рейс')).toBeInTheDocument();
    expect(screen.getByText('Сообщить о проблеме')).toBeInTheDocument();
    expect(text).not.toContain('Открыть список ролей');
    expect(text).not.toContain('Продавец');
    expect(text).not.toContain('Покупатель');
    expect(text).not.toContain('ставка');
    expect(text).not.toContain('резерв');
    expect(text).not.toContain('Деньги');
    expect(text).not.toMatch(/банковск/i);
    expect(text).not.toMatch(/проверка выплаты/i);
  });

  it('keeps full command center for operator role', () => {
    activeRole = 'operator';
    render(<PlatformCommandCenterHub />);

    expect(screen.getByTestId('platform-command-center-hero')).toBeInTheDocument();
    expect(screen.getByText('Центр исполнения сделки')).toBeInTheDocument();
    expect(screen.getByText('Открыть список ролей')).toBeInTheDocument();
  });
});
