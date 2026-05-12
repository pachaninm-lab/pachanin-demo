import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ScopedShellGuard } from '@/components/platform-v7/ScopedShellGuard';

const usePathname = vi.fn();
let activeRole = 'operator';

vi.mock('next/navigation', () => ({
  usePathname: () => usePathname(),
}));

vi.mock('@/stores/usePlatformV7RStore', () => ({
  usePlatformV7RStore: (selector: (state: { role: string }) => unknown) => selector({ role: activeRole }),
}));

const FIELD_ROLES = ['driver', 'surveyor', 'elevator', 'lab'] as const;
const FIELD_PATHS = ['/platform-v7/driver', '/platform-v7/surveyor', '/platform-v7/elevator', '/platform-v7/lab'] as const;
const ROLE_SCOPED_ROLES = ['buyer', 'seller', 'logistics', 'bank', 'arbitrator', 'compliance'] as const;
const ROLE_SCOPED_PATHS = ['/platform-v7/buyer', '/platform-v7/seller', '/platform-v7/procurement', '/platform-v7/logistics', '/platform-v7/bank', '/platform-v7/arbitrator', '/platform-v7/compliance'] as const;

describe('ScopedShellGuard', () => {
  it('does not render for operator control surfaces', () => {
    activeRole = 'operator';
    usePathname.mockReturnValue('/platform-v7/control-tower');

    const { container } = render(<ScopedShellGuard />);

    expect(container.querySelector('style')).toBeNull();
  });

  it.each(FIELD_PATHS)('renders field shell isolation styles on %s', (path) => {
    activeRole = 'operator';
    usePathname.mockReturnValue(path);

    const { container } = render(<ScopedShellGuard />);
    const style = container.querySelector('style');

    expect(style?.textContent).toContain('.pc-v4-search');
    expect(style?.textContent).toContain('.pc-v4-select');
    expect(style?.textContent).toContain('.pc-v4-mobile-role');
    expect(style?.textContent).toContain('.pc-v4-meta');
    expect(style?.textContent).toContain('.pc-v4-drawer');
  });

  it.each(FIELD_ROLES)('protects any platform route when the active role is %s', (role) => {
    activeRole = role;
    usePathname.mockReturnValue('/platform-v7/deals/DL-9106');

    render(<ScopedShellGuard />);

    expect(screen.getByText(/pc-v4-mobile-role/i)).toBeInTheDocument();
    expect(screen.getByText(/pc-v4-drawer/i)).toBeInTheDocument();
  });

  it.each(ROLE_SCOPED_PATHS)('applies compact role-scoped shell policy on %s', (path) => {
    activeRole = 'operator';
    usePathname.mockReturnValue(path);

    render(<ScopedShellGuard />);

    expect(screen.getByText(/pc-v4-role-grid/i)).toBeInTheDocument();
    expect(screen.getByText(/pc-v4-statuses/i)).toBeInTheDocument();
    expect(screen.getByText(/pc-v4-drawer/i)).toBeInTheDocument();
  });

  it.each(ROLE_SCOPED_ROLES)('applies compact role-scoped shell policy when active role is %s', (role) => {
    activeRole = role;
    usePathname.mockReturnValue('/platform-v7/deals/DL-9106');

    render(<ScopedShellGuard />);

    expect(screen.getByText(/pc-v4-role-grid/i)).toBeInTheDocument();
    expect(screen.getByText(/pc-v4-search/i)).toBeInTheDocument();
    expect(screen.getByText(/pc-v4-drawer/i)).toBeInTheDocument();
  });
});
