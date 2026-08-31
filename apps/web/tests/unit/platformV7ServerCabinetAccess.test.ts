import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  asVerifiedRole,
  observeServerCabinetAccess,
  reportServerCabinetAccess,
  resolveServerCabinetAccess,
  serverCabinetRbacMode,
} from '@/lib/platform-v7/server-cabinet-access';

afterEach(() => vi.restoreAllMocks());

describe('mandatory server cabinet enforcement', () => {
  it('has no off or report-only mode', () => {
    expect(serverCabinetRbacMode()).toBe('enforce');
  });

  it('denies a foreign cabinet and returns the verified role home', () => {
    const result = resolveServerCabinetAccess({ pathname: '/platform-v7/bank', verifiedRole: 'seller' });
    expect(result).toMatchObject({
      mode: 'enforce',
      status: 'denied',
      enforced: true,
      redirectTo: '/platform-v7/seller',
    });
  });

  it('allows an own cabinet while keeping policy enforcement active', () => {
    const result = resolveServerCabinetAccess({ pathname: '/platform-v7/bank', verifiedRole: 'bank' });
    expect(result).toMatchObject({ status: 'allowed', enforced: true, redirectTo: null });
  });

  it('fails closed without a verified server role', () => {
    const result = resolveServerCabinetAccess({ pathname: '/platform-v7/bank', verifiedRole: null });
    expect(result).toMatchObject({
      status: 'denied',
      enforced: true,
      redirectTo: '/platform-v7/login',
    });
  });

  it('does not apply cabinet policy to a non-platform path', () => {
    expect(resolveServerCabinetAccess({ pathname: '/health', verifiedRole: null })).toMatchObject({
      status: 'allowed',
      enforced: false,
    });
  });

  it('accepts only canonical roles from a verified boundary', () => {
    expect(asVerifiedRole('bank')).toBe('bank');
    expect(asVerifiedRole('BANK')).toBeNull();
    expect(asVerifiedRole(null)).toBeNull();
  });

  it('records enforced denials without changing the decision', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const denied = resolveServerCabinetAccess({ pathname: '/platform-v7/bank', verifiedRole: 'seller' });
    reportServerCabinetAccess(denied);
    expect(warn).toHaveBeenCalledOnce();
    expect(String(warn.mock.calls[0][0])).toContain('[pc:v7:cabinet-rbac:deny]');

    const observed = observeServerCabinetAccess({ pathname: '/platform-v7/bank', verifiedRole: null });
    expect(observed.status).toBe('denied');
    expect(observed.enforced).toBe(true);
  });
});
