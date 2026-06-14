import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

vi.mock('next/navigation', () => ({ usePathname: () => '/platform-v7/buyer' }));
vi.mock('@/components/v7r/CommandPalette', () => ({ CommandPalette: () => null }));
vi.mock('@/components/v7r/BrandMark', () => ({ BrandMark: () => null }));

import { AppShellV4 } from '@/components/v7r/AppShellV4';

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute('data-theme');
  window.localStorage.clear();
});

describe('AppShellV4 cabinet shell', () => {
  it('toggles data-theme between light and dark from the top-bar control', async () => {
    render(<AppShellV4 initialRole="buyer"><div>child</div></AppShellV4>);

    const toDark = await screen.findByRole('button', { name: /тёмную тему/i });
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');

    fireEvent.click(toDark);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(window.localStorage.getItem('pc-theme')).toBe('dark');

    const toLight = screen.getByRole('button', { name: /светлую тему/i });
    fireEvent.click(toLight);
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(window.localStorage.getItem('pc-theme')).toBe('light');
  });

  it('does not expose an all-roles role switcher inside a cabinet', () => {
    render(<AppShellV4 initialRole="buyer"><div>child</div></AppShellV4>);

    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.queryByText('Сменить роль')).toBeNull();
    // вместо переключения ролей — выход к выбору кабинета
    expect(screen.getByRole('link', { name: /Сменить кабинет/i })).toBeInTheDocument();
  });

  it('renders a role-scoped bottom navigation bar', () => {
    render(<AppShellV4 initialRole="buyer"><div>child</div></AppShellV4>);

    const bottomNav = screen.getByRole('navigation', { name: 'Навигация кабинета' });
    expect(bottomNav).toBeInTheDocument();
  });
});
