import React from 'react';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import DriverFieldPage from '@/app/platform-v7/driver/field/page';

vi.mock('@/components/platform-v7/RoleRouteHint', () => ({
  RoleRouteHint: () => <div data-testid="role-route-hint" />,
}));

vi.mock('@/components/v7r/FieldDriverRuntime', () => ({
  FieldDriverRuntime: () => <div data-testid="field-driver-runtime" />,
}));

const source = readFileSync(new URL('../../app/platform-v7/driver/field/page.tsx', import.meta.url), 'utf8');

describe('platform-v7 driver field shell polish', () => {
  it('renders a focused field-only shell with large operational hints', () => {
    render(<DriverFieldPage />);

    expect(screen.getByTestId('platform-v7-driver-field-shell')).toBeInTheDocument();
    expect(screen.getByText('Полевой режим · только рейс')).toBeInTheDocument();
    expect(screen.getByText('Рейс водителя')).toBeInTheDocument();
    expect(screen.getByText(/маршрут, связь, прибытие, фото, вес, пломба/i)).toBeInTheDocument();
    expect(screen.getByText('Следующее действие')).toBeInTheDocument();
    expect(screen.getByText('Офлайн-события')).toBeInTheDocument();
    expect(screen.getByText('Фото и пломба')).toBeInTheDocument();
  });

  it('keeps the field shell free from non-driver surfaces and money claims', () => {
    expect(source).not.toMatch(/банк/i);
    expect(source).not.toMatch(/деньг/i);
    expect(source).not.toMatch(/Control Tower/i);
    expect(source).not.toMatch(/Центр управления/i);
    expect(source).not.toMatch(/инвестор/i);
    expect(source).not.toMatch(/сменить роль/i);
    expect(source).not.toMatch(/production-ready/i);
    expect(source).not.toMatch(/fully live/i);
    expect(source).not.toMatch(/callback/i);
    expect(source).not.toMatch(/runtime/i);
  });
});
