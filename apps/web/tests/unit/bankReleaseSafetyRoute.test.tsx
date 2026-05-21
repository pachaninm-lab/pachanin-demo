import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import BankReleaseSafetyPage from '@/app/platform-v7/bank/release-safety/page';

const FORBIDDEN = [
  /production-ready/i,
  /fully live/i,
  /fully integrated/i,
  /live bank/i,
  /live callback/i,
  /bank callback/i,
  /платформа гарантирует оплату/i,
  /платформа выпускает деньги/i,
  /платформа сама выпускает деньги/i,
  /деньги автоматически выпускаются/i,
];

describe('BankReleaseSafetyPage', () => {
  it('renders payout review as a bank-check screen, not a payment mechanism', () => {
    render(<BankReleaseSafetyPage />);

    expect(screen.getByText('Банковская проверка выплаты')).toBeInTheDocument();
    expect(screen.getByText(/Экран показывает, почему запрос в банк не должен обходить резерв/)).toBeInTheDocument();
    expect(screen.getByText(/Это контрольный экран, а не платёжный механизм/)).toBeInTheDocument();
    expect(screen.getByText('Основание выплаты по зерновой сделке')).toBeInTheDocument();
    expect(screen.getByText(/без заявления о самостоятельном платёжном механизме/)).toBeInTheDocument();
  });

  it('keeps the bank request gated by deal evidence and conditions', () => {
    render(<BankReleaseSafetyPage />);

    expect(screen.getByText(/Запрос к банку допустим только после закрытия условий/)).toBeInTheDocument();
    expect(screen.getByText(/резерв, сумма к выплате, отсутствие удержания, документы/)).toBeInTheDocument();
    expect(screen.getByText(/ФГИС\/СДИЗ, рейс, приёмка, качество/)).toBeInTheDocument();
    expect(screen.getAllByText('К запросу').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Причины остановки').length).toBeGreaterThan(0);
  });

  it('does not expose live-bank or platform-payment claims', () => {
    const { container } = render(<BankReleaseSafetyPage />);
    const text = container.textContent || '';

    for (const pattern of FORBIDDEN) {
      expect(text).not.toMatch(pattern);
    }
  });
});
