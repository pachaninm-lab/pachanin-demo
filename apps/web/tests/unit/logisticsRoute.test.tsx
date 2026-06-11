import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import LogisticsPage from '@/app/platform-v7/logistics/page';

describe('LogisticsPage', () => {
  it('renders logistics dispatcher sandbox boundary', async () => {
    render(await LogisticsPage());

    expect(screen.getByTestId('platform-v7-logistics-execution-cockpit')).toBeInTheDocument();
    expect(screen.getByText('Логистика · рейс → водитель → ЭТрН → приёмка')).toBeInTheDocument();
    expect(screen.getByText('Довести рейс до приёмки и закрыть транспортные документы')).toBeInTheDocument();
    expect(screen.getByText(/Коммерческие условия и банковские действия скрыты/)).toBeInTheDocument();
    expect(screen.queryByText(/Live GPS/i)).not.toBeInTheDocument();
  });

  it('renders key logistics metrics and incident block', async () => {
    render(await LogisticsPage());

    expect(screen.getByText('В пути')).toBeInTheDocument();
    expect(screen.getByText('Прибыли')).toBeInTheDocument();
    expect(screen.getAllByText('Инциденты').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Документы').length).toBeGreaterThan(0);
    expect(screen.getByText('отклонение веса требует акта')).toBeInTheDocument();
    expect(screen.getByText('ЭТрН ждёт подпись')).toBeInTheDocument();
  });

  it('renders logistics orders linked to deals and route legs', async () => {
    render(await LogisticsPage());

    expect(screen.getByText('Текущая очередь заказов')).toBeInTheDocument();
    expect(screen.getByText('LOG-REQ-2403 → DL-9106')).toBeInTheDocument();
    expect(screen.getByText('LOG-9102 → DL-9102')).toBeInTheDocument();
    expect(screen.getByText('План перевозки DL-9106')).toBeInTheDocument();
    expect(screen.getAllByRole('link').some((link) => link.getAttribute('href') === '/platform-v7/driver/field')).toBe(true);
    expect(screen.getAllByRole('link').some((link) => link.getAttribute('href') === '/platform-v7/logistics/inbox')).toBe(true);
  });

  it('renders DL-9102 logistics card without live GPS or EDO claims', async () => {
    render(await LogisticsPage());

    expect(screen.getAllByText(/DL-9102/).length).toBeGreaterThan(0);
    expect(screen.getByText('ФГИС «Зерно» · СДИЗ отмечен в пилотном контуре')).toBeInTheDocument();
    expect(screen.getByText('акт расхождения не подписан')).toBeInTheDocument();
    expect(screen.queryByText(/боевой перевозчик/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/боевое ЭДО/i)).not.toBeInTheDocument();
  });

  it('links to logistics execution actions', async () => {
    render(await LogisticsPage());

    expect(screen.getByRole('link', { name: 'Открыть рейс водителя' })).toHaveAttribute('href', '/platform-v7/driver/field');
    expect(screen.getByRole('link', { name: 'Назначить водителя' })).toHaveAttribute('href', '/platform-v7/logistics/inbox');
  });
});
