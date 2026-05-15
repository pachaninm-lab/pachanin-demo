import React from 'react';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import LogisticsPage from '@/app/platform-v7/logistics/page';

const source = readFileSync(new URL('../../app/platform-v7/logistics/page.tsx', import.meta.url), 'utf8');

describe('platform-v7 logistics execution polish', () => {
  it('renders logistics execution screen focused on route, documents and next action', () => {
    render(<LogisticsPage />);

    expect(screen.getByText('Логистика · рейс → водитель → ЭТрН → приёмка')).toBeInTheDocument();
    expect(screen.getByText(/Довести рейс до приёмки и закрыть транспортные документы/i)).toBeInTheDocument();
    expect(screen.getByText(/Коммерческие условия и банковские действия скрыты/i)).toBeInTheDocument();
    expect(screen.getByText(/ЭТрН не закрыта грузополучателем/i)).toBeInTheDocument();
    expect(screen.getByText('Документные условия перевозки')).toBeInTheDocument();
    expect(screen.getByText('Водители на линии')).toBeInTheDocument();
    expect(screen.getByText('Текущая очередь заказов')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Открыть рейс водителя/i })).toHaveAttribute('href', '/platform-v7/driver/field');
    expect(screen.getByText(/Следующее действие логиста: контроль прибытия и подписи ЭТрН/i)).toBeInTheDocument();
  });

  it('keeps logistics source free from money leakage and live overclaims', () => {
    expect(source).not.toMatch(/ставка\s*\d/i);
    expect(source).not.toMatch(/к выплате/i);
    expect(source).not.toMatch(/платформа выпускает деньги/i);
    expect(source).not.toMatch(/деньги автоматически выпускаются/i);
    expect(source).not.toMatch(/production-ready/i);
    expect(source).not.toMatch(/fully live/i);
    expect(source).not.toMatch(/live gps/i);
    expect(source).not.toMatch(/callback/i);
  });
});
