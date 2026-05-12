import React from 'react';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import PlatformV7ControlTowerPage from '@/app/platform-v7/control-tower/page';

const source = readFileSync(new URL('../../app/platform-v7/control-tower/page.tsx', import.meta.url), 'utf8');

describe('platform-v7 control tower visual hierarchy', () => {
  it('renders the operator control room with stronger bank-boundary language', () => {
    render(<PlatformV7ControlTowerPage />);

    expect(screen.getByTestId('platform-v7-control-tower-page')).toBeInTheDocument();
    expect(screen.getByText('Центр управления')).toBeInTheDocument();
    expect(screen.getByText('К проверке')).toBeInTheDocument();
    expect(screen.getByText('Ручная сверка')).toBeInTheDocument();
    expect(screen.getByText(/основание для банковской проверки выплаты/i)).toBeInTheDocument();
    expect(screen.getByText('удержание / проверка')).toBeInTheDocument();
    expect(screen.getByText('К проверке банком')).toBeInTheDocument();
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
