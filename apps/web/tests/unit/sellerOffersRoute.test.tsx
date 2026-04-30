import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import PlatformV7SellerOffersPage from '@/app/platform-v7/seller/offers/page';

describe('PlatformV7SellerOffersPage', () => {
  it('renders seller offer visibility boundary', () => {
    render(<PlatformV7SellerOffersPage />);

    expect(screen.getByText('Кто и на каких условиях готов купить товар')).toBeInTheDocument();
    expect(screen.getByText(/До принятия ставки покупатели обезличены/)).toBeInTheDocument();
    expect(screen.getByText(/не получает прямые контакты покупателя/)).toBeInTheDocument();
    expect(screen.getByText('Правило раскрытия')).toBeInTheDocument();
    expect(screen.getByText(/Личность покупателя раскрывается продавцу только после выбора ставки/)).toBeInTheDocument();
  });

  it('renders offer metrics and seller action panel', () => {
    render(<PlatformV7SellerOffersPage />);

    expect(screen.getByText('Всего ставок')).toBeInTheDocument();
    expect(screen.getByText('Лучшие ставки')).toBeInTheDocument();
    expect(screen.getByText('Готовы деньги')).toBeInTheDocument();
    expect(screen.getByText('Остановить')).toBeInTheDocument();
    expect(screen.getByText('Действие продавца по ставке')).toBeInTheDocument();
    expect(screen.getByText('Отправить ставку продавца')).toBeInTheDocument();
    expect(screen.getByText(/rollback без раскрытия контактов покупателя/)).toBeInTheDocument();
  });

  it('renders anonymized offers with money and risk gates', () => {
    render(<PlatformV7SellerOffersPage />);

    expect(screen.getByText('Ставки по лотам продавца')).toBeInTheDocument();
    expect(screen.getAllByText(/контакты скрыты/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Деньги').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Риск').length).toBeGreaterThan(0);
    expect(screen.getByText('нет допуска')).toBeInTheDocument();
    expect(screen.getByText('Операционные кнопки перенесены в E4-панель выше: там есть состояние, журнал и откат.')).toBeInTheDocument();
  });

  it('uses stable route links', () => {
    render(<PlatformV7SellerOffersPage />);

    expect(screen.getByRole('link', { name: 'Торги и ставки' })).toHaveAttribute('href', '/platform-v7/trading');
    expect(screen.getByRole('link', { name: 'Готовность сделки' })).toHaveAttribute('href', '/platform-v7/readiness');
    expect(screen.getAllByRole('link', { name: 'Проверить готовность' })[0]).toHaveAttribute('href', '/platform-v7/readiness');
  });
});
