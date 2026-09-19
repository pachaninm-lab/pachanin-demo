import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../../src/common/types/request-user';
import { StaffAccessGuard } from '../../src/modules/staff-access/staff-access.guard';
import {
  StaffAccessMode,
  StaffPermission,
  StaffRole,
} from '../../src/modules/staff-access/staff-access.types';

function executionContext(request: Record<string, unknown>): any {
  return {
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
    switchToHttp: () => ({ getRequest: () => request }),
  };
}

function activeAccess(overrides: Record<string, unknown> = {}) {
  return {
    accessSessionId: 'sas-1',
    grantId: 'sag-1',
    actorUserId: 'owner-1',
    staffRole: StaffRole.PLATFORM_OWNER,
    accessMode: StaffAccessMode.CONTROL_PLANE,
    permissions: [StaffPermission.ORGANIZATION_LIST],
    effectiveTenantId: null,
    effectiveOrganizationId: null,
    effectiveUserId: null,
    effectiveRole: null,
    reason: 'Owner control plane',
    ticketId: 'OWN-1',
    expiresAt: new Date(Date.now() + 60_000),
    ...overrides,
  };
}

function fixture(options: {
  permissions?: StaffPermission[];
  modes?: StaffAccessMode[];
} = {}) {
  const reflector = {
    getAllAndOverride: jest.fn((key: string) => {
      if (key === 'staff_permissions') return options.permissions ?? [StaffPermission.ORGANIZATION_LIST];
      if (key === 'staff_access_modes') return options.modes ?? [StaffAccessMode.CONTROL_PLANE];
      return undefined;
    }),
  } as unknown as Reflector;
  const staffAccess = {
    requirePermission: jest.fn().mockResolvedValue(StaffRole.PLATFORM_OWNER),
  } as any;
  return { guard: new StaffAccessGuard(reflector, staffAccess), staffAccess };
}

const user = {
  id: 'owner-1',
  email: 'owner@example.test',
  orgId: 'platform-org',
  role: Role.ADMIN,
};

describe('StaffAccessGuard', () => {
  it('rejects standing assignment authority without an active delegated session', async () => {
    const { guard, staffAccess } = fixture();
    await expect(guard.canActivate(executionContext({ user }))).rejects.toBeInstanceOf(UnauthorizedException);
    expect(staffAccess.requirePermission).not.toHaveBeenCalled();
  });

  it('rejects an expired staff session', async () => {
    const { guard } = fixture();
    await expect(guard.canActivate(executionContext({
      user,
      staffAccess: activeAccess({ expiresAt: new Date(Date.now() - 1) }),
    }))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects actor substitution', async () => {
    const { guard } = fixture();
    await expect(guard.canActivate(executionContext({
      user: { ...user, id: 'attacker' },
      staffAccess: activeAccess(),
    }))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an access mode not allowed by endpoint metadata', async () => {
    const { guard } = fixture({ modes: [StaffAccessMode.CONTROL_PLANE] });
    await expect(guard.canActivate(executionContext({
      user,
      staffAccess: activeAccess({ accessMode: StaffAccessMode.VIEW_AS }),
    }))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects a permission absent from the time-bound grant', async () => {
    const { guard, staffAccess } = fixture({ permissions: [StaffPermission.AUDIT_READ] });
    await expect(guard.canActivate(executionContext({
      user,
      staffAccess: activeAccess(),
    }))).rejects.toBeInstanceOf(ForbiddenException);
    expect(staffAccess.requirePermission).not.toHaveBeenCalled();
  });

  it('permits only when session permission mode and durable assignment all match', async () => {
    const { guard, staffAccess } = fixture();
    await expect(guard.canActivate(executionContext({
      user,
      staffAccess: activeAccess(),
    }))).resolves.toBe(true);
    expect(staffAccess.requirePermission).toHaveBeenCalledWith(user, StaffPermission.ORGANIZATION_LIST);
  });
});
