import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  PLATFORM_V7_SERVER_CABINET_RBAC_FLAG,
  serverCabinetRbacMode,
  asVerifiedRole,
  resolveServerCabinetAccess,
  reportServerCabinetAccess,
  observeServerCabinetAccess,
} from '@/lib/platform-v7/server-cabinet-access';

// Phase 4B — report-only cabinet RBAC scaffold. These tests pin the report-only
// contract: the server can compute a would-be-deny, but never blocks/redirects, the
// flag is off by default, and an unverified session is never blocked.

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env[PLATFORM_V7_SERVER_CABINET_RBAC_FLAG];
});

describe('flag mode', () => {
  it('is off by default and only `report` activates it (no block-mode exists)', () => {
    delete process.env[PLATFORM_V7_SERVER_CABINET_RBAC_FLAG];
    expect(serverCabinetRbacMode()).toBe('off');
    expect(serverCabinetRbacMode({ [PLATFORM_V7_SERVER_CABINET_RBAC_FLAG]: 'report' })).toBe('report');
    // Any non-`report` value (incl. a hypothetical `block`) stays off — nothing enforces.
    expect(serverCabinetRbacMode({ [PLATFORM_V7_SERVER_CABINET_RBAC_FLAG]: 'block' })).toBe('off');
    expect(serverCabinetRbacMode({ [PLATFORM_V7_SERVER_CABINET_RBAC_FLAG]: 'on' })).toBe('off');
  });
});

describe('resolveServerCabinetAccess — report-only decision', () => {
  it('flag off → no evaluation, never enforces', () => {
    const r = resolveServerCabinetAccess({ pathname: '/platform-v7/bank', verifiedRole: 'seller', mode: 'off' });
    expect(r.mode).toBe('off');
    expect(r.enforced).toBe(false);
    expect(r.status).toBe('unknown');
  });

  it('report + foreign cabinet → would-deny, but enforced stays false (no block)', () => {
    const r = resolveServerCabinetAccess({ pathname: '/platform-v7/bank', verifiedRole: 'seller', mode: 'report' });
    expect(r.status).toBe('would-deny');
    expect(r.enforced).toBe(false);
    expect(r).not.toHaveProperty('redirectTo');
  });

  it('report + own cabinet → allowed', () => {
    expect(resolveServerCabinetAccess({ pathname: '/platform-v7/bank', verifiedRole: 'bank', mode: 'report' }).status).toBe('allowed');
    expect(resolveServerCabinetAccess({ pathname: '/platform-v7/seller', verifiedRole: 'seller', mode: 'report' }).status).toBe('allowed');
  });

  it('report + oversight role → allowed for any cabinet', () => {
    expect(resolveServerCabinetAccess({ pathname: '/platform-v7/bank', verifiedRole: 'operator', mode: 'report' }).status).toBe('allowed');
    expect(resolveServerCabinetAccess({ pathname: '/platform-v7/lab', verifiedRole: 'executive', mode: 'report' }).status).toBe('allowed');
  });

  it('report + unknown (unverified) session → unknown, never blocked', () => {
    const r = resolveServerCabinetAccess({ pathname: '/platform-v7/bank', verifiedRole: null, mode: 'report' });
    expect(r.status).toBe('unknown');
    expect(r.enforced).toBe(false);
  });

  it('report + shared/non-platform path → allowed (nothing to gate)', () => {
    expect(resolveServerCabinetAccess({ pathname: '/some/other/path', verifiedRole: null, mode: 'report' }).status).toBe('allowed');
    expect(resolveServerCabinetAccess({ pathname: '/platform-v7/login', verifiedRole: 'seller', mode: 'report' }).status).toBe('allowed');
  });
});

describe('asVerifiedRole — only known roles from the session boundary', () => {
  it('accepts valid roles, rejects everything else', () => {
    expect(asVerifiedRole('bank')).toBe('bank');
    expect(asVerifiedRole('not-a-role')).toBeNull();
    expect(asVerifiedRole(null)).toBeNull();
    expect(asVerifiedRole(undefined)).toBeNull();
  });
});

describe('reportServerCabinetAccess — emits only on would-deny, never throws', () => {
  it('emits a structured diagnostic for a would-deny in report mode', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    reportServerCabinetAccess(resolveServerCabinetAccess({ pathname: '/platform-v7/bank', verifiedRole: 'seller', mode: 'report' }));
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain('[pc:v7:cabinet-rbac:report] would-deny');
  });

  it('stays silent for allowed / unknown / off', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    reportServerCabinetAccess(resolveServerCabinetAccess({ pathname: '/platform-v7/bank', verifiedRole: 'bank', mode: 'report' }));
    reportServerCabinetAccess(resolveServerCabinetAccess({ pathname: '/platform-v7/bank', verifiedRole: null, mode: 'report' }));
    reportServerCabinetAccess(resolveServerCabinetAccess({ pathname: '/platform-v7/bank', verifiedRole: 'seller', mode: 'off' }));
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('observeServerCabinetAccess — request-layer convenience is non-throwing', () => {
  it('off by default → unknown, no emit', () => {
    delete process.env[PLATFORM_V7_SERVER_CABINET_RBAC_FLAG];
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const r = observeServerCabinetAccess({ pathname: '/platform-v7/bank', sessionRole: 'seller' });
    expect(r.mode).toBe('off');
    expect(r.enforced).toBe(false);
    expect(warn).not.toHaveBeenCalled();
  });

  it('report + foreign cabinet with a verified session role → observes would-deny', () => {
    process.env[PLATFORM_V7_SERVER_CABINET_RBAC_FLAG] = 'report';
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const r = observeServerCabinetAccess({ pathname: '/platform-v7/bank', sessionRole: 'seller' });
    expect(r.status).toBe('would-deny');
    expect(r.enforced).toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
