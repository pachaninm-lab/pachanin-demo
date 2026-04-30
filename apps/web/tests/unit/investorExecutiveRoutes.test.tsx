import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import InvestorPage from '@/app/platform-v7/investor/page';
import AnalyticsRedirectPage from '@/app/platform-v7/analytics/page';
import {
  PLATFORM_V7_COMMAND_ROUTE_SURFACE,
  PLATFORM_V7_EXECUTIVE_ROUTE,
  PLATFORM_V7_INVESTOR_ROUTE,
  PLATFORM_V7_SHELL_ROUTE_SURFACE,
} from '@/lib/platform-v7/routes';

const redirectMock = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}));

describe('PlatformV7 investor and executive routes', () => {
  beforeEach(() => {
    redirectMock.mockClear();
  });

  it('renders investor page as a demo investment slice without production claims', () => {
    render(<InvestorPage />);

    expect(screen.getByText('Инвестор и раунд')).toBeInTheDocument();
    expect(screen.getByText(/демонстрационный инвестиционный срез/)).toBeInTheDocument();
    expect(screen.getByText(/Боевые интеграции, подтверждённый оборот и полная готовность не заявляются/)).toBeInTheDocument();
    expect(screen.getByText('Что уже встроено в продукт')).toBeInTheDocument();
    expect(screen.getByText('План на 90 дней')).toBeInTheDocument();
    expect(screen.queryByText(/production-ready/i)).not.toBeInTheDocument();
  });

  it('keeps investor and executive routes in command and shell surfaces', () => {
    expect(PLATFORM_V7_INVESTOR_ROUTE).toBe('/platform-v7/investor');
    expect(PLATFORM_V7_EXECUTIVE_ROUTE).toBe('/platform-v7/executive');
    expect(PLATFORM_V7_COMMAND_ROUTE_SURFACE).toContain(PLATFORM_V7_INVESTOR_ROUTE);
    expect(PLATFORM_V7_COMMAND_ROUTE_SURFACE).toContain(PLATFORM_V7_EXECUTIVE_ROUTE);
    expect(PLATFORM_V7_SHELL_ROUTE_SURFACE).toContain(PLATFORM_V7_INVESTOR_ROUTE);
    expect(PLATFORM_V7_SHELL_ROUTE_SURFACE).toContain(PLATFORM_V7_EXECUTIVE_ROUTE);
  });

  it('routes analytics surface to executive catch-all dashboard', () => {
    AnalyticsRedirectPage();

    expect(redirectMock).toHaveBeenCalledWith(PLATFORM_V7_EXECUTIVE_ROUTE);
  });
});
