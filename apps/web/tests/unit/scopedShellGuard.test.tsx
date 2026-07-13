import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
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

function shell() {
  return document.querySelector<HTMLElement>('.pc-shell-root-v4');
}

async function renderPolicy() {
  const result = render(<ScopedShellGuard />);
  await waitFor(() => expect(shell()?.dataset.shellPolicy).toBeTruthy());
  return result;
}

beforeEach(() => {
  activeRole = 'operator';
  usePathname.mockReset();
  document.body.innerHTML = '<div class="pc-shell-root-v4"></div>';
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

describe('ScopedShellGuard', () => {
  it('keeps operator control surfaces on the operator shell policy without injecting CSS', async () => {
    usePathname.mockReturnValue('/platform-v7/control-tower');

    const { container } = await renderPolicy();

    expect(shell()?.dataset.shellPolicy).toBe('operator');
    expect(shell()?.dataset.shellRole).toBe('operator');
    expect(container.querySelector('style')).toBeNull();
  });

  it.each(FIELD_PATHS)('applies field shell metadata on %s', async (path) => {
    usePathname.mockReturnValue(path);

    await renderPolicy();

    expect(shell()?.dataset.shellPolicy).toBe('field');
  });

  it.each(FIELD_ROLES)('protects any platform route when the active role is %s', async (role) => {
    activeRole = role;
    usePathname.mockReturnValue('/platform-v7/deals/deal-1/execution');

    await renderPolicy();

    expect(shell()?.dataset.shellPolicy).toBe('field');
    expect(shell()?.dataset.shellRole).toBe(role);
  });

  it.each(ROLE_SCOPED_PATHS)('applies role-scoped metadata on %s', async (path) => {
    usePathname.mockReturnValue(path);

    await renderPolicy();

    expect(shell()?.dataset.shellPolicy).toBe('role-scoped');
  });

  it.each(ROLE_SCOPED_ROLES)('applies role-scoped policy when active role is %s', async (role) => {
    activeRole = role;
    usePathname.mockReturnValue('/platform-v7/deals/deal-1/execution');

    await renderPolicy();

    expect(shell()?.dataset.shellPolicy).toBe('role-scoped');
    expect(shell()?.dataset.shellRole).toBe(role);
  });
});
