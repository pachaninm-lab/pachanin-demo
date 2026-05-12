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

const SCOPED_ROLES = ['driver', 'surveyor', 'elevator', 'lab', 'bank', 'arbitrator', 'compliance'] as const;
const SCOPED_PATHS = [
  '/platform-v7/driver',
  '/platform-v7/surveyor',
  '/platform-v7/elevator',
  '/platform-v7/lab',
  '/platform-v7/bank',
  '/platform-v7/arbitrator',
  '/platform-v7/compliance',
] as const;

describe('WorkRouteNav scoped role isolation', () => {
  it('renders work navigation for normal operational roles', () => {
    activeRole = 'seller';
    usePathname.mockReturnValue('/platform-v7/seller');

    render(<WorkRouteNav />);

    expect(screen.getByLabelText('Рабочие разделы platform-v7')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Центр управления' })).toBeInTheDocument();
  });

  it.each(SCOPED_PATHS)('hides work navigation on %s', (path) => {
    activeRole = 'operator';
    usePathname.mockReturnValue(path);

    const { container } = render(<WorkRouteNav />);

    expect(container).toBeEmptyDOMElement();
  });

  it.each(SCOPED_ROLES)('hides work navigation on any route when active role is %s', (role) => {
    activeRole = role;
    usePathname.mockReturnValue('/platform-v7/deals/DL-9106');

    const { container } = render(<WorkRouteNav />);

    expect(container).toBeEmptyDOMElement();
  });
});
