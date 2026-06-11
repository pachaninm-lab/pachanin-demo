import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import PlatformV7SellerPage from '@/app/platform-v7/seller/page';

describe('seller mobile clarity copy', () => {
  it('uses bank-boundary wording and avoids payout-control claims', async () => {
    const { container } = render(await PlatformV7SellerPage());
    const text = container.textContent || '';

    expect(screen.getByText('Закрыть документы, чтобы передать основание банку')).toBeInTheDocument();
    expect(text).toContain('Кабинет продавца · сделка → документы → деньги');
    expect(text).toContain('платформа показывает основание и статус');
    expect(text).toContain('банк подтверждает проверку и движение денег');
    expect(text).toContain('На проверку банку');
    expect(text).toContain('готовность денег; это ещё не выплата');
    expect(text).toContain('банковская проверка выплаты остановлена до подтверждения');
    expect(text).not.toMatch(/платформа выпускает деньги/i);
    expect(text).not.toMatch(/деньги автоматически выпускаются/i);
    expect(text).not.toMatch(/к передаче банку/i);
    expect(text).not.toMatch(/выплата выполнена/i);
  });
});
