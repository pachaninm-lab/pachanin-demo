import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import PlatformV7ConnectorsPage from '@/app/platform-v7/connectors/page';
import {
  PLATFORM_V7_BANK_ROUTE,
} from '@/lib/platform-v7/routes';

describe('PlatformV7ConnectorsPage', () => {
  it('renders ESIA/FGIS connectors with sandbox boundary and no production claims', async () => {
    render(await PlatformV7ConnectorsPage());

    expect(screen.getByText('Именные контуры сделки')).toBeInTheDocument();
    expect(screen.getAllByText(/ФГИС/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Боевой статус не заявляется без договора/)).toBeInTheDocument();
    
    
    expect(screen.queryByText(/production-ready/i)).not.toBeInTheDocument();
  });

  it('keeps connectors tied to execution modules instead of isolated integration cards', async () => {
    render(await PlatformV7ConnectorsPage());

    expect(screen.getAllByText(/контур/i).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link').some((l) => l.getAttribute('href') === '/platform-v7/bank')).toBe(true);
    expect(screen.getAllByRole('link').some((l) => l.getAttribute('href') === '/platform-v7/deals/DL-9106/clean')).toBe(true);
    expect(screen.getAllByRole('link').some((l) => l.getAttribute('href') === '/platform-v7/documents')).toBe(true);
    expect(screen.getAllByRole('link').some((l) => l.getAttribute('href') === '/platform-v7/bank')).toBe(true);
  });
});
