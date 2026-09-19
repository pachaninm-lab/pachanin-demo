import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { PolicyEngineService } from '../../src/common/security/policy-engine.service';
import { STAFF_ACCESS_MODES_KEY } from '../../src/modules/staff-access/staff-access-modes.decorator';
import { StaffAccessGuard } from '../../src/modules/staff-access/staff-access.guard';
import { STAFF_PERMISSIONS_KEY } from '../../src/modules/staff-access/staff-permissions.decorator';
import {
  StaffAccessMode,
  StaffPermission,
  StaffRole,
} from '../../src/modules/staff-access/staff-access.types';

function executionContext(request: Record<string, unknown>): any {
  const handler = Symbol('handler');
  const controller = Symbol('controller');
  return {
    getHandler: () => handler,
    getClass: () => controller,
    switchToHttp: () => ({ getRequest: () => request }),
  };
}

function access(overrides: Record<string, unknown> = {}) {
  return {
    accessSessionId: 'sas_1',
    grantId: 'sag_1',
    actorUserId: 'staff_1',
    staffRole: StaffRole.SUPPORT_L2,
    accessMode: StaffAccessMode.VIEW_AS,
    permissions: [StaffPermission.CABINET_VIEW_AS, StaffPermission.DEAL_READ],
    effectiveTenantId: 'tenant_a',
    effectiveOrganizationId: 'org_a',
    effectiveUserId: null,
    effectiveRole: 'BUYER',
    targetDealId: 'deal_a',
    reason: 'Investigate support incident',
    ticketId: 'SUP-100',
    expiresAt: new Date(Date.now() + 60_000),
    ...overrides,
  };
}

function reflector(required: StaffPermission[], modes: StaffAccessMode[]) {
  return {
    getAllAndOverride: jest.fn((key: string) => {
      if (key === STAFF_PERMISSIONS_KEY) return required;
      if (key === STAFF_ACCESS_MODES_KEY) return modes;
      return undefined;
    }),
  } as any;
}

describe('StaffAccessGuard time-bound session authority', () => {
  it('denies a durable assignment without an active staff session', async () => {
    const staffAccess = {
      resolveAccessSession: jest.fn(),
      requirePermission: jest.fn(),
    } as any;
    const guard = new StaffAccessGuard(
      reflector([StaffPermission.ORGANIZATION_LIST], [StaffAccessMode.CONTROL_PLANE]),
      staffAccess,
    );

    await expect(guard.canActivate(executionContext({
      user: { id: 'staff_1' },
      headers: {},
    }))).rejects.toBeInstanceOf(UnauthorizedException);
    expect(staffAccess.requirePermission).not.toHaveBeenCalled();
  });

  it('denies a session that does not contain the exact endpoint permission', async () => {
    const staffAccess = {
      resolveAccessSession: jest.fn(),
      requirePermission: jest.fn(),
    } as any;
    const guard = new StaffAccessGuard(
      reflector([StaffPermission.ORGANIZATION_LIST], [StaffAccessMode.CONTROL_PLANE]),
      staffAccess,
    );

    await expect(guard.canActivate(executionContext({
      user: { id: 'staff_1' },
      staffAccess: access({
        accessMode: StaffAccessMode.CONTROL_PLANE,
        permissions: [StaffPermission.DEAL_READ],
        targetDealId: null,
      }),
      headers: {},
    }))).rejects.toBeInstanceOf(ForbiddenException);
    expect(staffAccess.requirePermission).not.toHaveBeenCalled();
  });

  it('denies a valid grant used through the wrong access mode', async () => {
    const staffAccess = {
      resolveAccessSession: jest.fn(),
      requirePermission: jest.fn(),
    } as any;
    const guard = new StaffAccessGuard(
      reflector([StaffPermission.CABINET_VIEW_AS], [StaffAccessMode.VIEW_AS]),
      staffAccess,
    );

    await expect(guard.canActivate(executionContext({
      user: { id: 'staff_1' },
      staffAccess: access({ accessMode: StaffAccessMode.CONTROL_PLANE }),
      headers: {},
    }))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows only an exact session permission and rechecks the durable assignment', async () => {
    const staffAccess = {
      resolveAccessSession: jest.fn(),
      requirePermission: jest.fn().mockResolvedValue(StaffRole.SUPPORT_L2),
    } as any;
    const guard = new StaffAccessGuard(
      reflector([StaffPermission.CABINET_VIEW_AS], [StaffAccessMode.VIEW_AS]),
      staffAccess,
    );
    const request: Record<string, unknown> = {
      user: { id: 'staff_1' },
      staffAccess: access(),
      headers: {},
    };

    await expect(guard.canActivate(executionContext(request))).resolves.toBe(true);
    expect(staffAccess.requirePermission).toHaveBeenCalledWith(
      request.user,
      StaffPermission.CABINET_VIEW_AS,
    );
  });
});

describe('PolicyEngineService deal-scoped staff grants', () => {
  const policy = new PolicyEngineService();

  const baseInput = {
    action: 'deal:read',
    user: { id: 'staff_1', role: 'ADMIN' },
    staffAccess: {
      actorUserId: 'staff_1',
      accessMode: StaffAccessMode.VIEW_AS,
      permissions: ['deal:read'],
      effectiveTenantId: 'tenant_a',
      effectiveOrganizationId: null,
      effectiveUserId: null,
      targetDealId: 'deal_a',
      expiresAt: new Date(Date.now() + 60_000),
    },
  };

  it('allows the exact authoritative deal and tenant scope', () => {
    const result = policy.evaluate({
      ...baseInput,
      resource: { type: 'deal', id: 'deal_a', tenantId: 'tenant_a' },
    });
    expect(result.allowed).toBe(true);
    expect(result.matchedPolicy).toBe('allow.staff.scoped-grant');
  });

  it('denies a different deal inside the same tenant', () => {
    const result = policy.evaluate({
      ...baseInput,
      resource: { type: 'deal', id: 'deal_b', tenantId: 'tenant_a' },
    });
    expect(result.allowed).toBe(false);
    expect(result.matchedPolicy).toBe('deny.staff.invalid-or-cross-scope');
  });

  it('denies a resource that omits the deal binding', () => {
    const result = policy.evaluate({
      ...baseInput,
      resource: { type: 'document', id: 'document_a', tenantId: 'tenant_a' },
    });
    expect(result.allowed).toBe(false);
    expect(result.matchedPolicy).toBe('deny.staff.invalid-or-cross-scope');
  });

  it('denies a scoped grant when the resource omits its tenant', () => {
    const result = policy.evaluate({
      ...baseInput,
      resource: { type: 'deal', id: 'deal_a' },
    });
    expect(result.allowed).toBe(false);
    expect(result.matchedPolicy).toBe('deny.staff.invalid-or-cross-scope');
  });
});
