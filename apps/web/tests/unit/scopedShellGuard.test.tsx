import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
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

// Policy markers: each shell policy carries a unique main-offset rule.
const FIELD_MARKER = 'env(safe-area-inset-top) + 66px';
const ROLE_SCOPED_MARKER = 'var(--pc-header-offset) + 8px';

function renderedStyle() {
  const { container } = render(<ScopedShellGuard />);
  return container.querySelector('style')?.textContent ?? '';
}

describe('ScopedShellGuard', () => {
  it('keeps operator control surfaces on the operator shell policy', () => {
    activeRole = 'operator';
    usePathname.mockReturnValue('/platform-v7/control-tower');

    const style = renderedStyle();

    expect(style).not.toBe('');
    expect(style).not.toContain(FIELD_MARKER);
    expect(style).not.toContain(ROLE_SCOPED_MARKER);
  });

  it.each(FIELD_PATHS)('renders field shell isolation styles on %s', (path) => {
    activeRole = 'operator';
    usePathname.mockReturnValue(path);

    const style = renderedStyle();

    expect(style).toContain(FIELD_MARKER);
    expect(style).toContain('.pc-v4-search');
    expect(style).toContain('.pc-v4-select');
    expect(style).toContain('.pc-v4-mobile-role');
    expect(style).toContain('.pc-v4-meta');
  });

  it.each(FIELD_ROLES)('protects any platform route when the active role is %s', (role) => {
    activeRole = role;
    usePathname.mockReturnValue('/platform-v7/deals/DL-9106');

    const style = renderedStyle();

    expect(style).toContain(FIELD_MARKER);
    expect(style).toContain('.pc-v4-mobile-role');
  });

  it.each(ROLE_SCOPED_PATHS)('applies compact role-scoped shell policy on %s', (path) => {
    activeRole = 'operator';
    usePathname.mockReturnValue(path);

    const style = renderedStyle();

    expect(style).toContain(ROLE_SCOPED_MARKER);
    expect(style).toContain('.pc-v4-statuses');
    expect(style).toContain('.pc-v4-pilot-note');
    expect(style).toContain("nav[data-testid='platform-v7-work-route-nav']");
  });

  it.each(ROLE_SCOPED_ROLES)('applies compact role-scoped shell policy when active role is %s', (role) => {
    activeRole = role;
    usePathname.mockReturnValue('/platform-v7/deals/DL-9106');

    const style = renderedStyle();

    expect(style).toContain(ROLE_SCOPED_MARKER);
    expect(style).toContain('.pc-v4-search');
    expect(style).toContain('.pc-v4-pilot-note');
  });
});
