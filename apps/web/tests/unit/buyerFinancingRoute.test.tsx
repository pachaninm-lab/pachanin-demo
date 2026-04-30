import React from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import BuyerFinancingPage from '@/app/platform-v7/buyer/financing/page';

describe('BuyerFinancingPage', () => {
  it('renders buyer financing sandbox boundary', () => {
    render(<BuyerFinancingPage />);

    expect(screen.getByText('Финансирование закупки')).toBeInTheDocument();
    expect(screen.getByText(/Buyer-only sandbox экран/)).toBeInTheDocument();
    expect(screen.getByText(/Боевой банковый скоринг, выдача кредита и резерв денег здесь не заявляются/)).toBeInTheDocument();
    expect(screen.getByText(/Реальных запросов в банк, кредитных решений, списаний или резервирования средств нет/)).toBeInTheDocument();
  });

  it('renders credit limits and sandbox applications', () => {
    render(<BuyerFinancingPage />);

    expect(screen.getByText('Sandbox-лимит')).toBeInTheDocument();
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
    expect(screen.getByText('Новая sandbox-заявка')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('DL-9101')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('1000000')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('DL-9101'), { target: { value: 'DL-9101' } });
    fireEvent.change(screen.getByPlaceholderText('1000000'), { target: { value: '1000000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Подать заявку sandbox' }));

    expect(screen.getByText('Заявка создана в sandbox')).toBeInTheDocument();
    expect(screen.getByText(/Боевой банковый workflow не запускался/)).toBeInTheDocument();
  });

  it('keeps buyer financing separate from factoring and links back to buyer/deals', () => {
    render(<BuyerFinancingPage />);

    expect(screen.getByRole('link', { name: '← Назад' })).toHaveAttribute('href', '/platform-v7/buyer');
    expect(screen.getByRole('link', { name: /Открыть сделку DL-9101/ })).toHaveAttribute('href', '/platform-v7/deals/DL-9101');
    expect(screen.getByText(/Факторинг относится к продавцу/)).toBeInTheDocument();
    expect(screen.getByText(/не смешивается с buyer financing/)).toBeInTheDocument();
  });
});
