import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import PlatformV7SellerPage from '@/app/platform-v7/seller/page';

describe('seller mobile clarity copy', () => {
  it('uses bank-boundary wording and avoids payout-control claims', () => {
    const { container } = render(<PlatformV7SellerPage />);
    const text = container.textContent || '';

    expect(screen.getByText('Лоты, документы и банковская проверка')).toBeInTheDocument();
    expect(text).toContain('Выплату подтверждает банк');
    expect(text).toContain('платформа показывает статус и причину остановки');
    expect(text).toContain('На проверку банку');
    expect(text).toContain('готовность денег; это ещё не выплата');
    expect(text).not.toMatch(/платформа выпускает деньги/i);
    expect(text).not.toMatch(/деньги автоматически выпускаются/i);
    expect(text).not.toMatch(/к передаче банку/i);
    expect(text).not.toMatch(/проверка выплаты остановлена/i);
  });
});
