import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { RoleContinuityPanel } from '@/components/v7r/RoleContinuityPanel';

describe('RoleContinuityPanel', () => {
  it('renders driver continuity with deal, evidence, audit and timeline blocks', () => {
    render(<RoleContinuityPanel role='driver' compact />);

    const panel = screen.getByTestId('role-continuity-driver');
    expect(within(panel).getByText('Ролевой контур · Водитель')).toBeInTheDocument();
    expect(within(panel).getByText('Связка поля: рейс → фото/гео → прибытие → вес')).toBeInTheDocument();
    expect(within(panel).getByText('Доказательства')).toBeInTheDocument();
    expect(within(panel).getByText('Журнал')).toBeInTheDocument();
    expect(within(panel).getByText('Линия событий')).toBeInTheDocument();
    expect(within(panel).getAllByText('Следующее действие').length).toBeGreaterThan(0);
    expect(within(panel).getByText('Подтвердить прибытие / событие рейса')).toBeInTheDocument();
    expect(within(panel).getByRole('link', { name: 'Открыть сделку' })).toHaveAttribute('href', expect.stringContaining('/platform-v7/deals/'));
  });

  it('renders lab continuity with quality-specific next action and route link', () => {
    render(<RoleContinuityPanel role='lab' compact />);

    const panel = screen.getByTestId('role-continuity-lab');
    expect(within(panel).getByText('Ролевой контур · Лаборатория')).toBeInTheDocument();
    expect(within(panel).getByText('Связка качества: проба → протокол → приёмка → спор/выпуск')).toBeInTheDocument();
    expect(within(panel).getByText('Довести лабораторный результат до статуса, который открывает приёмку или спор.')).toBeInTheDocument();
    expect(within(panel).getAllByText('Создать лабораторный протокол').length).toBeGreaterThan(0);
    expect(within(panel).getByRole('link', { name: 'Открыть контур' })).toHaveAttribute('href', '/platform-v7/lab');
  });

  it('renders bank continuity with money blocker semantics', () => {
    render(<RoleContinuityPanel role='bank' />);

    const panel = screen.getByTestId('role-continuity-bank');
    expect(within(panel).getByText('Ролевой контур · Банк')).toBeInTheDocument();
    expect(within(panel).getByText('Связка денег: основание → удержание → подтверждение банка → журнал')).toBeInTheDocument();
    expect(within(panel).getByText('Деньги')).toBeInTheDocument();
    expect(within(panel).getByText('Подтвердить основание / выпуск')).toBeInTheDocument();
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

    expect(within(buyer).getByText('Ролевой контур · Покупатель')).toBeInTheDocument();
    expect(within(buyer).getByText('Связка закупки: сделка → приёмка → документы → деньги')).toBeInTheDocument();
    expect(within(buyer).getByText(/Качество, вес, лаборатория/)).toBeInTheDocument();
    expect(within(buyer).getByText('Запросить банковское основание или открыть спор')).toBeInTheDocument();

    expect(within(seller).getByText('Ролевой контур · Продавец')).toBeInTheDocument();
    expect(within(seller).getByText('Связка выплаты: лот → сделка → документы → снятие удержания')).toBeInTheDocument();
    expect(within(seller).getByText(/ФГИС\/партия/)).toBeInTheDocument();
    expect(within(seller).getByText('Закрыть выплатный блокер')).toBeInTheDocument();
  });

  it('renders logistics continuity with logistics route link and transport semantics', () => {
    render(<RoleContinuityPanel role='logistics' compact />);

    const panel = screen.getByTestId('role-continuity-logistics');
    expect(within(panel).getByText('Ролевой контур · Логистика')).toBeInTheDocument();
    expect(within(panel).getByText('Связка рейса: назначение → погрузка → прибытие → транспортное основание')).toBeInTheDocument();
    expect(within(panel).getByText(/Маршрут, водитель, прибытие/)).toBeInTheDocument();
    expect(within(panel).getByText('Назначить водителя / закрыть рейс')).toBeInTheDocument();
    expect(within(panel).getByRole('link', { name: 'Открыть контур' })).toHaveAttribute('href', '/platform-v7/logistics');
  });
});
