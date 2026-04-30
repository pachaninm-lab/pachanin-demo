import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import PlatformV7OfferToDealPage from '@/app/platform-v7/offer-to-deal/page';

describe('PlatformV7OfferToDealPage', () => {
  it('renders offer to deal sandbox bridge copy', () => {
    render(<PlatformV7OfferToDealPage />);

    expect(screen.getByText('Как принятая ставка становится сделкой')).toBeInTheDocument();
    expect(screen.getByText(/ставка → черновик сделки/i)).toBeInTheDocument();
    expect(screen.getByText(/Черновик сделки не выпускает деньги/)).toBeInTheDocument();
    expect(screen.getByText(/не создаёт обязательство автоматически/)).toBeInTheDocument();
  });

  it('renders transfer fields and pre-deal gates', () => {
    render(<PlatformV7OfferToDealPage />);

    expect(screen.getByText('Что переносится из ставки')).toBeInTheDocument();
    expect(screen.getByText('Проверки до запуска сделки')).toBeInTheDocument();
    expect(screen.getByText('ФГИС')).toBeInTheDocument();
    expect(screen.getByText('Качество')).toBeInTheDocument();
    expect(screen.getByText('Логистика')).toBeInTheDocument();
    expect(screen.getByText('Документы')).toBeInTheDocument();
    expect(screen.getByText('Банк')).toBeInTheDocument();
    expect(screen.getByText('Обход платформы')).toBeInTheDocument();
  });

  it('renders execution actions without live claims', () => {
    render(<PlatformV7OfferToDealPage />);

    expect(screen.getByText('Сквозные действия сделки')).toBeInTheDocument();
    expect(screen.getByText('Создать черновик сделки')).toBeInTheDocument();
    expect(screen.getByText('Запросить резерв денег')).toBeInTheDocument();
    expect(screen.getByText('Назначить логистику')).toBeInTheDocument();
    expect(screen.getByText(/Это не выпуск денег и не live bank adapter/)).toBeInTheDocument();
    expect(screen.getByText(/Это не ЭДО, не УКЭП и не СберКорус/)).toBeInTheDocument();
  });

  it('uses stable route links for next actions', () => {
    render(<PlatformV7OfferToDealPage />);

    expect(screen.getByRole('link', { name: 'Ставки продавца' })).toHaveAttribute('href', '/platform-v7/seller/offers');
    expect(screen.getAllByRole('link', { name: 'Готовность сделки' })[0]).toHaveAttribute('href', '/platform-v7/readiness');
    expect(screen.getByRole('link', { name: 'Проверить готовность' })).toHaveAttribute('href', '/platform-v7/readiness');
    expect(screen.getByRole('link', { name: 'Назначить логистику' })).toHaveAttribute('href', '/platform-v7/logistics');
    expect(screen.getByRole('link', { name: 'Проверить деньги' })).toHaveAttribute('href', '/platform-v7/bank/release-safety');
    expect(screen.getByRole('link', { name: 'Реестр сделок' })).toHaveAttribute('href', '/platform-v7/deals');
  });
});
