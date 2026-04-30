import React from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import PlatformV7DomainCorePage from '@/app/platform-v7/domain-core/page';

describe('PlatformV7DomainCorePage', () => {
  it('renders simulation-grade domain core boundary and metrics', () => {
    render(<PlatformV7DomainCorePage />);

    expect(screen.getByText('Движок сделки и actions')).toBeInTheDocument();
    expect(screen.getByText('DOMAIN CORE · SANDBOX')).toBeInTheDocument();
    expect(screen.getByText(/Это честная симуляция/)).toBeInTheDocument();
    expect(screen.getByText('GMV fixtures')).toBeInTheDocument();
    expect(screen.getByText('Сделок')).toBeInTheDocument();
    expect(screen.getByText('Audit trail')).toBeInTheDocument();
  });

  it('exposes first ten simulated actions and stable links', () => {
    render(<PlatformV7DomainCorePage />);

    expect(screen.getByRole('button', { name: 'Создать лот' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Опубликовать лот' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Принять оффер' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Создать сделку' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Запросить резерв' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Подтвердить резерв' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Назначить водителя' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Подтвердить прибытие' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Создать лаб. протокол' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Открыть спор' })).toBeInTheDocument();

    expect(screen.getByRole('link', { name: 'Банк' })).toHaveAttribute('href', '/platform-v7/bank');
    expect(screen.getByRole('link', { name: 'Споры' })).toHaveAttribute('href', '/platform-v7/disputes');
  });

  it('writes action feedback when a sandbox action is clicked', () => {
    render(<PlatformV7DomainCorePage />);

    fireEvent.click(screen.getByRole('button', { name: 'Создать лот' }));

    expect(screen.getByText(/Последнее действие:/)).toBeInTheDocument();
    expect(screen.getByText(/create_lot/)).toBeInTheDocument();
  });
});
