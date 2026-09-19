import React from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import BuyerFinancingPage from '@/app/platform-v7/buyer/financing/page';

describe('BuyerFinancingPage', () => {
  it('renders buyer financing sandbox boundary', () => {
    render(<BuyerFinancingPage />);

    expect(screen.getByText('Финансирование закупки')).toBeInTheDocument();
    expect(screen.getAllByText(/Внешние банковские запросы не выполняются/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Боевой банковый скоринг, выдача кредита и резерв денег здесь не заявляются/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/нет кредитных решений, списаний или резервирования средств/).length).toBeGreaterThan(0);
  });

  it('renders credit limits and sandbox applications', () => {
    render(<BuyerFinancingPage />);

    expect(screen.getByText('Предварительный лимит')).toBeInTheDocument();
    expect(screen.getByText('Общий лимит')).toBeInTheDocument();
    expect(screen.getByText('Доступно')).toBeInTheDocument();
    expect(screen.getByText('cr-001')).toBeInTheDocument();
    expect(screen.getByText('cr-002')).toBeInTheDocument();
    expect(screen.getByText('Одобрено')).toBeInTheDocument();
    expect(screen.getByText('На проверке')).toBeInTheDocument();
  });

  it('opens and submits sandbox application form without live workflow claims', () => {
    render(<BuyerFinancingPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Подать заявку' }));
    expect(screen.getByText('Новая заявка')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('DL-9101')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('1000000')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('DL-9101'), { target: { value: 'DL-9101' } });
    fireEvent.change(screen.getByPlaceholderText('1000000'), { target: { value: '1000000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Подать заявку' }));

    expect(screen.getByText('Заявка создана в проверочном контуре')).toBeInTheDocument();
    expect(screen.getAllByText(/Боевой банковый workflow не запускался/).length).toBeGreaterThan(0);
  });

  it('keeps buyer financing separate from factoring and links back to buyer/deals', () => {
    render(<BuyerFinancingPage />);

    expect(screen.getByRole('link', { name: '← Назад' })).toHaveAttribute('href', '/platform-v7/buyer');
    expect(screen.getByRole('link', { name: /Открыть сделку DL-9101/ })).toHaveAttribute('href', '/platform-v7/deals/DL-9101');
    expect(screen.getAllByText(/Факторинг относится к продавцу/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/не смешивается с buyer financing/).length).toBeGreaterThan(0);
  });
});
