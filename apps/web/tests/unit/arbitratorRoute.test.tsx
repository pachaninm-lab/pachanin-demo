import React from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import PlatformV7ArbitratorPage from '@/app/platform-v7/arbitrator/page';

describe('PlatformV7ArbitratorPage', () => {
  it('renders arbitration summary without claiming automatic dispute resolution', () => {
    render(<PlatformV7ArbitratorPage />);

    expect(screen.getByText('Активных споров')).toBeInTheDocument();
    expect(screen.getByText('Под удержанием')).toBeInTheDocument();
    expect(screen.getByText('Решений сегодня')).toBeInTheDocument();
    expect(screen.getByText('DK-2024-89')).toBeInTheDocument();
    expect(screen.getByText('Отклонение влажности')).toBeInTheDocument();
    expect(screen.getByText('Мяч у:')).toBeInTheDocument();
  });

  it('opens dispute room with evidence package, timeline and controlled money actions', () => {
    render(<PlatformV7ArbitratorPage />);

    fireEvent.click(screen.getAllByRole('button', { name: 'Открыть комнату разбора' })[0]);

    expect(screen.getByText('Пакет доказательств (4/5)')).toBeInTheDocument();
    expect(screen.getByText('Хроника событий')).toBeInTheDocument();
    expect(screen.getByText('Решение арбитра')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Выпустить полностью/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Частичный выпуск/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Вернуть средства покупателю/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Продлить сбор доказательств/ })).toBeInTheDocument();
  });
});
