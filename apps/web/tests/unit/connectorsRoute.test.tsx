import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import PlatformV7ConnectorsPage from '@/app/platform-v7/connectors/page';

describe('PlatformV7ConnectorsPage', () => {
  it('renders named integration contours with sandbox boundary and no production claims', async () => {
    render(await PlatformV7ConnectorsPage());

    expect(screen.getByText('Именные контуры сделки')).toBeInTheDocument();
    expect(screen.getByText('Реестр интеграций')).toBeInTheDocument();
    expect(screen.getByText(/Боевой статус не заявляется/)).toBeInTheDocument();
    expect(screen.getByText('Контуров')).toBeInTheDocument();
    expect(screen.getAllByText(/ФГИС/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/production-ready/i)).not.toBeInTheDocument();
  });

  it('keeps connectors tied to execution modules instead of isolated integration cards', async () => {
    render(await PlatformV7ConnectorsPage());

    expect(screen.getByText('Интеграции по именам')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Документы' })).toHaveAttribute('href', '/platform-v7/documents');
    expect(screen.getByRole('link', { name: 'Деньги' })).toHaveAttribute('href', '/platform-v7/bank');
    expect(screen.getByRole('link', { name: /Сбер · Безопасные сделки/ })).toHaveAttribute('href', '/platform-v7/bank');
    expect(screen.getByRole('link', { name: /СБИС \/ Saby ЭТрН/ })).toHaveAttribute('href', '/platform-v7/logistics');
    expect(screen.getByRole('link', { name: /Wialon/ })).toHaveAttribute('href', '/platform-v7/driver');
  });
});
