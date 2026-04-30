import React from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import SellerFgisPartiesPage from '@/app/platform-v7/seller/fgis-parties/page';

describe('SellerFgisPartiesPage', () => {
  it('renders seller fgis sandbox route with boundary copy', () => {
    render(<SellerFgisPartiesPage />);

    expect(screen.getByText('Мои партии ФГИС')).toBeInTheDocument();
    expect(screen.getByText(/Sandbox-экран показывает/)).toBeInTheDocument();
    expect(screen.getByText(/Боевой доступ, подпись, внешний реестр и проверка СДИЗ здесь не заявляются/)).toBeInTheDocument();
    expect(screen.getByText('Интеграция: sandbox')).toBeInTheDocument();
  });

  it('renders navigation links without live claims', () => {
    render(<SellerFgisPartiesPage />);

    expect(screen.getByRole('link', { name: 'Создать лот вручную' })).toHaveAttribute('href', '/platform-v7/lots/create');
    expect(screen.getByRole('link', { name: '← Назад' })).toHaveAttribute('href', '/platform-v7/seller');
  });

  it('renders fgis parties and batches from sandbox fixtures', () => {
    render(<SellerFgisPartiesPage />);

    expect(screen.getByText('Sandbox Seller A')).toBeInTheDocument();
    expect(screen.getByText('Sandbox Seller B')).toBeInTheDocument();
    expect(screen.getByText('Sandbox Seller C')).toBeInTheDocument();
    expect(screen.getByText('Пшеница 4 кл.')).toBeInTheDocument();
    expect(screen.getByText(/SANDBOX-SDIZ-001/)).toBeInTheDocument();
  });

  it('shows create-lot gate only for usable fgis party', () => {
    render(<SellerFgisPartiesPage />);

    expect(screen.getByRole('link', { name: 'Создать лот из партии' })).toHaveAttribute('href', '/platform-v7/lots/create');

    fireEvent.click(screen.getByText('Sandbox Seller B'));
    expect(screen.getByText(/Нельзя создать лот/)).toBeInTheDocument();
  });
});
