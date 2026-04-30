import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import PlatformV7ConnectorsPage from '@/app/platform-v7/connectors/page';

describe('PlatformV7ConnectorsPage', () => {
  it('renders ESIA/FGIS connectors with sandbox boundary and no production claims', () => {
    render(<PlatformV7ConnectorsPage />);

    expect(screen.getByText('Коннекторы')).toBeInTheDocument();
    expect(screen.getByText(/ESIA и ФГИС/)).toBeInTheDocument();
    expect(screen.getByText(/Без ложных production claims/)).toBeInTheDocument();
    expect(screen.getAllByText('ESIA').length).toBeGreaterThan(0);
    expect(screen.getAllByText('FGIS').length).toBeGreaterThan(0);
    expect(screen.queryByText(/production-ready/i)).not.toBeInTheDocument();
  });

  it('keeps connectors tied to execution modules instead of isolated integration cards', () => {
    render(<PlatformV7ConnectorsPage />);

    expect(screen.getByText('Связанные модули платформы')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Банковый контур/ })).toHaveAttribute('href', '/platform-v7/bank');
    expect(screen.getByRole('link', { name: /Status-ready контур/ })).toHaveAttribute('href', '/platform-v7/status');
    expect(screen.getByRole('link', { name: /Trust-слой/ })).toHaveAttribute('href', '/platform-v7/profile');
    expect(screen.getByRole('link', { name: 'Открыть очередь' })).toHaveAttribute('href', '/platform-v7/operator-cockpit/queues');
  });
});
