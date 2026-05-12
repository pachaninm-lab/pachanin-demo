import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WorkRouteNav } from '@/components/platform-v7/WorkRouteNav';

const usePathname = vi.fn();
let activeRole = 'operator';

vi.mock('next/navigation', () => ({
  usePathname: () => usePathname(),
}));

vi.mock('@/stores/usePlatformV7RStore', () => ({
  usePlatformV7RStore: (selector: (state: { role: string }) => unknown) => selector({ role: activeRole }),
}));

const ROLE_SCOPED_PATHS = [
  '/platform-v7/buyer',
  '/platform-v7/seller',
  '/platform-v7/procurement',
  '/platform-v7/logistics',
  '/platform-v7/driver',
  '/platform-v7/surveyor',
  '/platform-v7/elevator',
  '/platform-v7/lab',
  '/platform-v7/bank',
  '/platform-v7/arbitrator',
  '/platform-v7/compliance',
] as const;

const NON_BROAD_NAV_ROLES = ['buyer', 'seller', 'logistics', 'driver', 'surveyor', 'elevator', 'lab', 'bank', 'arbitrator', 'compliance'] as const;

describe('WorkRouteNav role scope', () => {
  it.each(['operator', 'executive'] as const)('renders broad work navigation for %s on operator surfaces', (role) => {
    activeRole = role;
    usePathname.mockReturnValue('/platform-v7/control-tower');

    render(<WorkRouteNav />);

    expect(screen.getByLabelText('Рабочие разделы platform-v7')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Центр управления' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Сделки' })).toBeInTheDocument();
  });

  it.each(ROLE_SCOPED_PATHS)('hides broad work navigation on role-scoped path %s', (path) => {
    activeRole = 'operator';
    usePathname.mockReturnValue(path);

    const { container } = render(<WorkRouteNav />);

    expect(container).toBeEmptyDOMElement();
  });

  it.each(NON_BROAD_NAV_ROLES)('hides broad work navigation on shared routes when active role is %s', (role) => {
    activeRole = role;
    usePathname.mockReturnValue('/platform-v7/deals/DL-9106');

    const { container } = render(<WorkRouteNav />);

    expect(container).toBeEmptyDOMElement();
  });
});
