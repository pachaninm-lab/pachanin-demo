import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DriverFieldShellGuard } from '@/components/platform-v7/DriverFieldShellGuard';

const usePathname = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => usePathname(),
}));

describe('DriverFieldShellGuard', () => {
  it('does not render outside the driver contour', () => {
    usePathname.mockReturnValue('/platform-v7/seller');

    const { container } = render(<DriverFieldShellGuard />);

    expect(container.querySelector('style')).toBeNull();
  });

  it('renders driver-only shell isolation styles on driver routes', () => {
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
    usePathname.mockReturnValue('/platform-v7/driver/field');

    render(<DriverFieldShellGuard />);

    expect(screen.getByText(/pc-v4-mobile-role/i)).toBeInTheDocument();
  });
});
