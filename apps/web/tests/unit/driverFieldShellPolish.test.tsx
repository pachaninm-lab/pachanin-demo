import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import DriverFieldPage from '@/app/platform-v7/driver/field/page';

vi.mock('@/components/platform-v7/RoleRouteHint', () => ({
  RoleRouteHint: () => <div data-testid="role-route-hint" />,
}));

vi.mock('@/components/v7r/FieldDriverRuntime', () => ({
  FieldDriverRuntime: () => <div data-testid="field-driver-runtime" />,
}));

describe('platform-v7 driver field shell polish', () => {
  it('renders a focused field-only shell with large operational hints', async () => {
    render(await DriverFieldPage());

    expect(screen.getByTestId('platform-v7-driver-field-shell')).toBeInTheDocument();
    expect(screen.getByText('Полевой режим')).toBeInTheDocument();
    expect(screen.getByText('Текущий рейс')).toBeInTheDocument();
    expect(screen.getByText(/маршрут, связь, прибытие, фото, пломба/i)).toBeInTheDocument();
    expect(screen.getByText('Подтвердить следующее действие по рейсу')).toBeInTheDocument();
    expect(screen.getByText('Фото / пломба')).toBeInTheDocument();
    expect(screen.getByTestId('field-driver-runtime')).toBeInTheDocument();
  });

  it('keeps the field shell free from non-driver surfaces and money claims', async () => {
    const { container } = render(await DriverFieldPage());
    const html = container.innerHTML;

    expect(html).not.toMatch(/банк/i);
    expect(html).not.toMatch(/деньг/i);
    expect(html).not.toMatch(/Control Tower/i);
    expect(html).not.toMatch(/Центр управления/i);
    expect(html).not.toMatch(/инвестор/i);
    expect(html).not.toMatch(/сменить роль/i);
    expect(html).not.toMatch(/production-ready/i);
    expect(html).not.toMatch(/fully live/i);
    expect(html).not.toMatch(/callback/i);
  });
});
