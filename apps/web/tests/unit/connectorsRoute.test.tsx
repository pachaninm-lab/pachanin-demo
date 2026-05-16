import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import PlatformV7ConnectorsPage from '@/app/platform-v7/connectors/page';
import { PLATFORM_V7_BANK_ROUTE } from '@/lib/platform-v7/routes';

describe('PlatformV7ConnectorsPage', () => {
  it('renders named execution connectors with external-boundary copy and no production claims', () => {
    render(<PlatformV7ConnectorsPage />);

    expect(screen.getByText('Именные контуры сделки')).toBeInTheDocument();
    expect(screen.getByText(/без заявления внешнего интеграционного статуса/i)).toBeInTheDocument();
    expect(screen.getAllByText('ФГИС «Зерно»').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Сбер · Безопасные сделки').length).toBeGreaterThan(0);
    expect(screen.queryByText(/production-ready/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/sandbox/i)).not.toBeInTheDocument();
  });

  it('keeps connectors tied to execution modules instead of isolated integration cards', () => {
    render(<PlatformV7ConnectorsPage />);

    expect(screen.getByText('Интеграции по именам')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Сбер · Безопасные сделки/ })).toHaveAttribute('href', PLATFORM_V7_BANK_ROUTE);
    expect(screen.getByRole('link', { name: /СДИЗ и партия зерна/ })).toHaveAttribute('href', '/platform-v7/documents');
    expect(screen.getByRole('link', { name: /электронная транспортная накладная/ })).toHaveAttribute('href', '/platform-v7/logistics');
  });
});
