import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import PlatformV7ControlTowerPage from '@/app/platform-v7/control-tower/page';
import { vi } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: () => '/platform-v7/control-tower',
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: () => {}, replace: () => {}, prefetch: () => {}, back: () => {} }),
}));

const source = readFileSync(resolve(__dirname, '../../app/platform-v7/control-tower/page.tsx'), 'utf8');

describe('platform-v7 control tower visual hierarchy', () => {
  it('renders the operator control room with stronger bank-boundary language', async () => {
    render(await PlatformV7ControlTowerPage());

    expect(screen.getByTestId('platform-v7-control-tower-page')).toBeInTheDocument();
    expect(screen.getByText('Центр управления')).toBeInTheDocument();
    expect(screen.getByText('Деньги по стадиям')).toBeInTheDocument();
    expect(screen.getAllByText('Удержание').length).toBeGreaterThan(0);
    expect(screen.getByText(/влияют на банковскую проверку/i)).toBeInTheDocument();
    expect(screen.getByText('Спор / удержание')).toBeInTheDocument();
    expect(screen.getAllByText(/Ручная проверка/).length).toBeGreaterThan(0);
  });

  it('keeps the control-tower source free from old direct payout framing', () => {
    expect(source).not.toMatch(/К выпуску/);
    expect(source).not.toMatch(/удержание \/ выпуск/);
    expect(source).not.toMatch(/Блокирует выпуск/);
    expect(source).not.toMatch(/Заблокировано интеграцией' value=.*К выпуску/s);
    expect(source).not.toMatch(/bank callback/i);
    expect(source).not.toMatch(/production-ready/i);
    expect(source).not.toMatch(/fully live/i);
    expect(source).not.toMatch(/платформа выпускает деньги/i);
  });
});
