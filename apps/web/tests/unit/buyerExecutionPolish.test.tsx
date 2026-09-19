import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import PlatformV7BuyerPage from '@/app/platform-v7/buyer/page';

const source = readFileSync(resolve(__dirname, '../../app/platform-v7/buyer/page.tsx'), 'utf8');

describe('platform-v7 buyer execution polish', () => {
  it('renders buyer execution screen with reserve and hold focus', async () => {
    render(await PlatformV7BuyerPage());

    expect(screen.getByText('Кабинет покупателя · запрос → резерв → логистика')).toBeInTheDocument();
    expect(screen.getByText(/контур закупки: запрос, выбранную партию, ставку, резерв, удержание, документы/i)).toBeInTheDocument();
    expect(screen.getByText('Мой резерв')).toBeInTheDocument();
    expect(screen.getByText('Под удержанием')).toBeInTheDocument();
    expect(screen.getByText(/ожидать банковского подтверждения резерва/i)).toBeInTheDocument();
    expect(screen.getByText(/готовность денег без преждевременного движения денег/i)).toBeInTheDocument();
  });

  it('keeps buyer source free from premature payment movement and overclaims', () => {
    expect(source).not.toMatch(/преждевременного выпуска/);
    expect(source).not.toMatch(/платформа выпускает деньги/i);
    expect(source).not.toMatch(/деньги автоматически выпускаются/i);
    expect(source).not.toMatch(/прямой выплаты/i);
    expect(source).not.toMatch(/production-ready/i);
    expect(source).not.toMatch(/fully live/i);
    expect(source).not.toMatch(/callback/i);
    expect(source).not.toMatch(/runtime/i);
  });
});
