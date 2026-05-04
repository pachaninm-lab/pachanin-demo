import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PlatformCommandCenterHub } from '@/components/v7r/PlatformCommandCenterHub';

describe('PlatformCommandCenterHub', () => {
  it('renders the premium command center entry without production claims', () => {
    render(<PlatformCommandCenterHub />);

    expect(screen.getByTestId('platform-command-center-hero')).toBeInTheDocument();
    expect(screen.getByTestId('platform-command-center-spine')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Дорогой контур исполнения зерновой сделки' })).toBeInTheDocument();
    expect(screen.getByText('controlled-pilot')).toBeInTheDocument();
    expect(screen.getByText('simulation-grade')).toBeInTheDocument();
    expect(screen.getByText('не production-ready')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Пройти сделку за 3 минуты' })).toHaveAttribute('href', '/platform-v7/demo');
    expect(screen.getByRole('link', { name: 'Открыть Deal 360' })).toHaveAttribute('href', '/platform-v7/deals/DL-9106/clean');
  });

  it('renders execution spine anchors and 5-second answers', () => {
    render(<PlatformCommandCenterHub />);

    expect(screen.getByText('лот')).toBeInTheDocument();
    expect(screen.getByText('LOT-2403')).toBeInTheDocument();
    expect(screen.getByText('сделка')).toBeInTheDocument();
    expect(screen.getByText('DL-9106')).toBeInTheDocument();
    expect(screen.getByText('логистика')).toBeInTheDocument();
    expect(screen.getByText('TRIP-SIM-001')).toBeInTheDocument();
    expect(screen.getByText('Что происходит')).toBeInTheDocument();
    expect(screen.getByText('Где деньги')).toBeInTheDocument();
    expect(screen.getByText('Где груз')).toBeInTheDocument();
    expect(screen.getByText('Где документы')).toBeInTheDocument();
    expect(screen.getByText('Что заблокировано')).toBeInTheDocument();
    expect(screen.getByText('Кто следующий')).toBeInTheDocument();
  });

  it('keeps role entry points explicit and role-safe', () => {
    render(<PlatformCommandCenterHub />);

    expect(screen.getByRole('link', { name: /Продавец/ })).toHaveAttribute('href', '/platform-v7/seller?as=seller');
    expect(screen.getByRole('link', { name: /Покупатель/ })).toHaveAttribute('href', '/platform-v7/buyer?as=buyer');
    expect(screen.getByRole('link', { name: /Логистика/ })).toHaveAttribute('href', '/platform-v7/logistics?as=logistics');
    expect(screen.getByRole('link', { name: /Водитель/ })).toHaveAttribute('href', '/platform-v7/driver?as=driver');
    expect(screen.getByRole('link', { name: /Банк/ })).toHaveAttribute('href', '/platform-v7/bank?as=bank');
    expect(screen.getByRole('link', { name: /Оператор/ })).toHaveAttribute('href', '/platform-v7/control-tower?as=operator');
  });
});
