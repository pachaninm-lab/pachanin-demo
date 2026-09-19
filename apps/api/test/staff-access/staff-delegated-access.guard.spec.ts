import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { StaffDelegatedAccessGuard } from '../../src/modules/staff-access/staff-delegated-access.guard';
import {
  StaffAccessMode,
  StaffPermission,
  StaffRole,
} from '../../src/modules/staff-access/staff-access.types';

function executionContext(request: Record<string, unknown>): any {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  };
}

function access(overrides: Record<string, unknown> = {}) {
  return {
    accessSessionId: 'sas_1',
    grantId: 'sag_1',
    actorUserId: 'owner_1',
    staffRole: StaffRole.PLATFORM_OWNER,
    accessMode: StaffAccessMode.VIEW_AS,
    permissions: [StaffPermission.CABINET_VIEW_AS, StaffPermission.DEAL_READ],
    effectiveTenantId: 'tenant_a',
    effectiveOrganizationId: 'org_a',
    effectiveUserId: null,
    effectiveRole: 'BUYER',
    reason: 'Owner inspection',
    ticketId: 'OWN-1',
    expiresAt: new Date(Date.now() + 60_000),
    ...overrides,
  };
}

describe('StaffDelegatedAccessGuard', () => {
  const guard = new StaffDelegatedAccessGuard();

  it('allows an exact active VIEW_AS projection', () => {
    const request = {
      user: { id: 'owner_1' },
      staffAccess: access(),
      params: { organizationId: 'org_a', role: 'BUYER' },
    };
    expect(guard.canActivate(executionContext(request))).toBe(true);
  });

  it('requires a delegated session', () => {
    const request = { user: { id: 'owner_1' }, params: { organizationId: 'org_a', role: 'BUYER' } };
    expect(() => guard.canActivate(executionContext(request))).toThrow(UnauthorizedException);
  });

  it('denies actor substitution', () => {
    const request = {
      user: { id: 'attacker' },
      staffAccess: access(),
      params: { organizationId: 'org_a', role: 'BUYER' },
    };
    expect(() => guard.canActivate(executionContext(request))).toThrow(ForbiddenException);
  });

  it('denies cross-organization projection', () => {
    const request = {
      user: { id: 'owner_1' },
      staffAccess: access(),
      params: { organizationId: 'org_b', role: 'BUYER' },
    };
    expect(() => guard.canActivate(executionContext(request))).toThrow(ForbiddenException);
  });

  it('denies a role different from the delegated target role', () => {
    const request = {
      user: { id: 'owner_1' },
      staffAccess: access(),
      params: { organizationId: 'org_a', role: 'BANK' },
    };
    expect(() => guard.canActivate(executionContext(request))).toThrow(ForbiddenException);
  });

  it('denies non-view-as modes', () => {
    const request = {
      user: { id: 'owner_1' },
      staffAccess: access({ accessMode: StaffAccessMode.ASSISTED }),
      params: { organizationId: 'org_a', role: 'BUYER' },
    };
    expect(() => guard.canActivate(executionContext(request))).toThrow(ForbiddenException);
  });

  it('denies expired delegated sessions', () => {
    const request = {
      user: { id: 'owner_1' },
      staffAccess: access({ expiresAt: new Date(Date.now() - 1) }),
      params: { organizationId: 'org_a', role: 'BUYER' },
    };
    expect(() => guard.canActivate(executionContext(request))).toThrow(UnauthorizedException);
  });
});
