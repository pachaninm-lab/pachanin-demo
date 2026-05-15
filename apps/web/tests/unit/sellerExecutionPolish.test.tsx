import React from 'react';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import PlatformV7SellerPage from '@/app/platform-v7/seller/page';

const source = readFileSync(new URL('../../app/platform-v7/seller/page.tsx', import.meta.url), 'utf8');

describe('platform-v7 seller execution polish', () => {
  it('renders seller execution screen with bank-boundary money language', () => {
    render(<PlatformV7SellerPage />);

    expect(screen.getByText('Продавец · партия → лот → документы → деньги')).toBeInTheDocument();
    expect(screen.getByText(/Закрыть СДИЗ и приёмку, чтобы основание ушло банку/i)).toBeInTheDocument();
    expect(screen.getByText(/СДИЗ и ЭТрН не закрыты по DL-9106/i)).toBeInTheDocument();
    expect(screen.getByText(/Банк не получает основание до закрытых документов/i)).toBeInTheDocument();
    expect(screen.getByText('К передаче банку')).toBeInTheDocument();
    expect(screen.getByText(/к передаче банку 0 ₽/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Закрыть СДИЗ/i })).toHaveAttribute('href', '/platform-v7/deals/grain-sdiz');
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
