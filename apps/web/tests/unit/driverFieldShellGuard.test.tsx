import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DriverFieldShellGuard } from '@/components/platform-v7/DriverFieldShellGuard';

const usePathname = vi.fn();
let activeRole = 'operator';

vi.mock('next/navigation', () => ({
  usePathname: () => usePathname(),
}));

vi.mock('@/stores/usePlatformV7RStore', () => ({
  usePlatformV7RStore: (selector: (state: { role: string }) => unknown) => selector({ role: activeRole }),
}));

describe('DriverFieldShellGuard', () => {
  it('does not render outside the driver contour for non-driver roles', () => {
    activeRole = 'seller';
    usePathname.mockReturnValue('/platform-v7/seller');

    const { container } = render(<DriverFieldShellGuard />);

    expect(container.querySelector('style')).toBeNull();
  });

  it('renders driver-only shell isolation styles on driver routes', () => {
    activeRole = 'operator';
    usePathname.mockReturnValue('/platform-v7/driver');

    const { container } = render(<DriverFieldShellGuard />);
    const style = container.querySelector('style');

    expect(style?.textContent).toContain('.pc-v4-search');
    expect(style?.textContent).toContain('.pc-v4-select');
    expect(style?.textContent).toContain('.pc-v4-mobile-role');
    expect(style?.textContent).toContain('.pc-v4-meta');
    expect(style?.textContent).toContain('.pc-v4-drawer');
  });

  it('also protects the field subroute', () => {
    activeRole = 'operator';
    usePathname.mockReturnValue('/platform-v7/driver/field');

    render(<DriverFieldShellGuard />);

    expect(screen.getByText(/pc-v4-mobile-role/i)).toBeInTheDocument();
  });

  it('protects any platform route when the active role is driver', () => {
    activeRole = 'driver';
    usePathname.mockReturnValue('/platform-v7/deals/DL-9106');

    render(<DriverFieldShellGuard />);

    expect(screen.getByText(/pc-v4-mobile-role/i)).toBeInTheDocument();
    expect(screen.getByText(/pc-v4-search/i)).toBeInTheDocument();
  });
});
