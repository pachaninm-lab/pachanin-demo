import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { RoleContinuityPanel } from '@/components/v7r/RoleContinuityPanel';

describe('RoleContinuityPanel', () => {
  it('renders driver continuity with deal, evidence, audit and timeline blocks', () => {
    render(<RoleContinuityPanel role='driver' compact />);

    const panel = screen.getByTestId('role-continuity-driver');
    expect(within(panel).getByText('P0-04 · continuity · Водитель')).toBeInTheDocument();
    expect(within(panel).getByText('Связка поля: рейс → фото/гео → прибытие → вес')).toBeInTheDocument();
    expect(within(panel).getByText('Evidence')).toBeInTheDocument();
    expect(within(panel).getByText('Audit')).toBeInTheDocument();
    expect(within(panel).getByText('Timeline')).toBeInTheDocument();
    expect(within(panel).getByText('Action handoff')).toBeInTheDocument();
    expect(within(panel).getByText('Подтвердить прибытие / событие рейса')).toBeInTheDocument();
    expect(within(panel).getByText('confirmArrival')).toBeInTheDocument();
    expect(within(panel).getByRole('link', { name: 'Открыть сделку' })).toHaveAttribute('href', expect.stringContaining('/platform-v7/deals/'));
  });

  it('renders lab continuity with quality-specific next action and route link', () => {
    render(<RoleContinuityPanel role='lab' compact />);

    const panel = screen.getByTestId('role-continuity-lab');
    expect(within(panel).getByText('P0-04 · continuity · Лаборатория')).toBeInTheDocument();
    expect(within(panel).getByText('Связка качества: проба → протокол → приёмка → спор/выпуск')).toBeInTheDocument();
    expect(within(panel).getByText('Довести лабораторный результат до статуса, который открывает приёмку или спор.')).toBeInTheDocument();
    expect(within(panel).getByText('Создать лабораторный протокол')).toBeInTheDocument();
    expect(within(panel).getByText('createLabProtocol')).toBeInTheDocument();
    expect(within(panel).getByRole('link', { name: 'Открыть контур' })).toHaveAttribute('href', '/platform-v7/lab');
  });

  it('renders bank continuity with money blocker semantics', () => {
    render(<RoleContinuityPanel role='bank' />);

    const panel = screen.getByTestId('role-continuity-bank');
    expect(within(panel).getByText('P0-04 · continuity · Банк')).toBeInTheDocument();
    expect(within(panel).getByText('Связка денег: reserve → hold → release → audit')).toBeInTheDocument();
    expect(within(panel).getByText('Деньги')).toBeInTheDocument();
    expect(within(panel).getByText('Подтвердить резерв / выпуск')).toBeInTheDocument();
    expect(within(panel).getByText('confirmReserve')).toBeInTheDocument();
    expect(within(panel).getByRole('link', { name: 'Открыть контур' })).toHaveAttribute('href', '/platform-v7/bank');
  });

  it('renders buyer and seller continuity with commercial execution semantics', () => {
    render(
      <>
        <RoleContinuityPanel role='buyer' compact />
        <RoleContinuityPanel role='seller' compact />
      </>,
    );

    const buyer = screen.getByTestId('role-continuity-buyer');
    const seller = screen.getByTestId('role-continuity-seller');

    expect(within(buyer).getByText('P0-04 · continuity · Покупатель')).toBeInTheDocument();
    expect(within(buyer).getByText('Связка закупки: сделка → приёмка → документы → деньги')).toBeInTheDocument();
    expect(within(buyer).getByText(/Качество, вес, лаборатория/)).toBeInTheDocument();
    expect(within(buyer).getByText('Запросить резерв или открыть спор')).toBeInTheDocument();
    expect(within(buyer).getByText('requestReserve')).toBeInTheDocument();

    expect(within(seller).getByText('P0-04 · continuity · Продавец')).toBeInTheDocument();
    expect(within(seller).getByText('Связка выплаты: лот → сделка → документы → снятие удержания')).toBeInTheDocument();
    expect(within(seller).getByText(/ФГИС\/партия/)).toBeInTheDocument();
    expect(within(seller).getByText('Закрыть выплатный blocker')).toBeInTheDocument();
    expect(within(seller).getByText('publishLot')).toBeInTheDocument();
  });

  it('renders logistics continuity with logistics route link and transport semantics', () => {
    render(<RoleContinuityPanel role='logistics' compact />);

    const panel = screen.getByTestId('role-continuity-logistics');
    expect(within(panel).getByText('P0-04 · continuity · Логистика')).toBeInTheDocument();
    expect(within(panel).getByText('Связка рейса: назначение → погрузка → прибытие → транспортный gate')).toBeInTheDocument();
    expect(within(panel).getByText(/Маршрут, водитель, прибытие/)).toBeInTheDocument();
    expect(within(panel).getByText('Назначить водителя / закрыть рейс')).toBeInTheDocument();
    expect(within(panel).getByText('assignDriver')).toBeInTheDocument();
    expect(within(panel).getByRole('link', { name: 'Открыть контур' })).toHaveAttribute('href', '/platform-v7/logistics');
  });
});
