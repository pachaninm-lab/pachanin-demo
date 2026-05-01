import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import PlatformV7DealsPage from '@/app/platform-v7/deals/page';
import PlatformV7DealDetailPage from '@/app/platform-v7/deals/[id]/page';

describe('PlatformV7 deals routes', () => {
  it('renders deals overview with money, risk and execution context', () => {
    render(<PlatformV7DealsPage />);

    expect(screen.getByText('Сделки')).toBeInTheDocument();
    expect(screen.getByText('Операционный обзор сделок')).toBeInTheDocument();
    expect(screen.getByText('Сделки в домене')).toBeInTheDocument();
    expect(screen.getByText('Под удержанием')).toBeInTheDocument();
    expect(screen.getByText('К выпуску')).toBeInTheDocument();
    expect(screen.getByText('Высокий риск')).toBeInTheDocument();
    expect(screen.getAllByRole('link').some((link) => link.getAttribute('href') === '/platform-v7/deals/DL-9102')).toBe(true);
  });

  it('renders the execution-contour deal detail without production-ready claims', () => {
    render(<PlatformV7DealDetailPage />);

    expect(screen.getByText(/путь сделки/)).toBeInTheDocument();
    expect(screen.getByText('Экономика из принятой ставки')).toBeInTheDocument();
    expect(screen.getByText('Лот')).toBeInTheDocument();
    expect(screen.getByText('Принятая ставка')).toBeInTheDocument();
    expect(screen.getByText('Цена')).toBeInTheDocument();
    expect(screen.getByText('Сумма')).toBeInTheDocument();
    expect(screen.queryByText(/production-ready/i)).not.toBeInTheDocument();
  });

  it('renders the complete execution timeline from lot to money', () => {
    render(<PlatformV7DealDetailPage />);

    expect(screen.getByText('Таймлайн исполнения')).toBeInTheDocument();
    expect(screen.getByText('Лот опубликован')).toBeInTheDocument();
    expect(screen.getByText('Ставка принята')).toBeInTheDocument();
    expect(screen.getByText('Сделка создана')).toBeInTheDocument();
    expect(screen.getByText('Заявка в логистику создана')).toBeInTheDocument();
    expect(screen.getByText('Перевозчик предложил условия')).toBeInTheDocument();
    expect(screen.getByText('Рейс создан')).toBeInTheDocument();
    expect(screen.getByText('Приёмка завершена')).toBeInTheDocument();
    expect(screen.getByText('Документы собраны')).toBeInTheDocument();
    expect(screen.getByText('К выпуску денег')).toBeInTheDocument();
  });
});
