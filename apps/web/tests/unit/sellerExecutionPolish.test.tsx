import React from 'react';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import PlatformV7SellerPage from '@/app/platform-v7/seller/page';

const source = readFileSync(new URL('../../app/platform-v7/seller/page.tsx', import.meta.url), 'utf8');

describe('platform-v7 seller execution polish', () => {
  it('renders seller execution screen with bank-boundary money language', () => {
    render(<PlatformV7SellerPage />);

    expect(screen.getByText('Кабинет продавца')).toBeInTheDocument();
    expect(screen.getByText(/Лоты, предложения, документы и проверка выплаты/i)).toBeInTheDocument();
    expect(screen.getByText('К передаче банку')).toBeInTheDocument();
    expect(screen.getByText(/к передаче банку 0 ₽/i)).toBeInTheDocument();
    expect(screen.getByText(/закрыть СДИЗ и ЭТрН для передачи основания банку на проверку/i)).toBeInTheDocument();
    expect(screen.getByText(/сделка передаёт основание банку/i)).toBeInTheDocument();
  });

  it('keeps seller source free from direct payout framing and overclaims', () => {
    expect(source).not.toMatch(/К выплате сейчас/);
    expect(source).not.toMatch(/к выплате 0 ₽/);
    expect(source).not.toMatch(/передачи выплаты/);
    expect(source).not.toMatch(/платформа выпускает деньги/i);
    expect(source).not.toMatch(/деньги автоматически выпускаются/i);
    expect(source).not.toMatch(/production-ready/i);
    expect(source).not.toMatch(/fully live/i);
    expect(source).not.toMatch(/callback/i);
    expect(source).not.toMatch(/runtime/i);
  });
});
