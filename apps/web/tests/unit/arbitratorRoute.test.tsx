import React from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import PlatformV7ArbitratorPage from '@/app/platform-v7/arbitrator/page';

describe('PlatformV7ArbitratorPage', () => {
  it('renders arbitration summary without claiming automatic dispute resolution', async () => {
    render(await PlatformV7ArbitratorPage());

    expect(screen.getByTestId('platform-v7-arbitrator-decision-guard')).toBeInTheDocument();
    expect(screen.getByText('Решение арбитра создаёт основание для ручной проверки')).toBeInTheDocument();
    expect(screen.getByText('Сумма спора')).toBeInTheDocument();
    expect(screen.getByText('Доказательства')).toBeInTheDocument();
    expect(screen.getByText('Следующий шаг')).toBeInTheDocument();
    expect(screen.getByText('Журнал')).toBeInTheDocument();
    expect(screen.getByText('Активных споров')).toBeInTheDocument();
    expect(screen.getByText('Под удержанием')).toBeInTheDocument();
    expect(screen.getByText('Решений сегодня')).toBeInTheDocument();
    expect(screen.getAllByText('DK-2024-89').length).toBeGreaterThan(0);
    expect(screen.getByText('Отклонение влажности')).toBeInTheDocument();
    expect(screen.getAllByText(/Мяч у:/).length).toBeGreaterThan(0);
  });

  it('opens dispute room with evidence package, timeline and controlled money actions', async () => {
    render(await PlatformV7ArbitratorPage());

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
