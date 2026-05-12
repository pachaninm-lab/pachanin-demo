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

describe('ScopedShellGuard', () => {
  it('does not render outside field shell for non-field roles', () => {
    activeRole = 'seller';
    usePathname.mockReturnValue('/platform-v7/seller');

    const { container } = render(<ScopedShellGuard />);

    expect(container.querySelector('style')).toBeNull();
  });

  it.each(FIELD_PATHS)('renders shell isolation styles on %s', (path) => {
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
    expect(screen.getByText(/pc-v4-search/i)).toBeInTheDocument();
  });
});
