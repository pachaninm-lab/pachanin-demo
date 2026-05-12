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

describe('WorkRouteNav driver isolation', () => {
  it('renders work navigation for normal operational roles', () => {
    activeRole = 'seller';
    usePathname.mockReturnValue('/platform-v7/seller');

    render(<WorkRouteNav />);

    expect(screen.getByLabelText('Рабочие разделы platform-v7')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Центр управления' })).toBeInTheDocument();
  });

  it('hides work navigation on driver routes', () => {
    activeRole = 'operator';
    usePathname.mockReturnValue('/platform-v7/driver');

    const { container } = render(<WorkRouteNav />);

    expect(container).toBeEmptyDOMElement();
  });

  it('hides work navigation on any route when active role is driver', () => {
    activeRole = 'driver';
    usePathname.mockReturnValue('/platform-v7/deals/DL-9106');

    const { container } = render(<WorkRouteNav />);

    expect(container).toBeEmptyDOMElement();
  });
});
