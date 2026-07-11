import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { PolicyEngineService } from '../../src/common/security/policy-engine.service';
import { Role, RequestUser } from '../../src/common/types/request-user';
import { StaffAccessService } from '../../src/modules/staff-access/staff-access.service';
import {
  StaffAccessMode,
  StaffPermission,
  StaffRole,
} from '../../src/modules/staff-access/staff-access.types';

const actor = (overrides: Partial<RequestUser> = {}): RequestUser => ({
  id: 'user_staff',
  email: 'staff@example.test',
  fullName: 'Staff User',
  orgId: 'platform_org',
  tenantId: 'platform_tenant',
  membershipId: 'membership_staff',
  role: Role.ADMIN,
  sessionId: 'session_staff',
  mfaVerified: true,
  mfaVerifiedAt: new Date().toISOString(),
  ...overrides,
});

function repositoryMock() {
  const prisma = {
    organization: { findUnique: jest.fn() },
    userOrg: { findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    user: { findUnique: jest.fn() },
    deal: { findMany: jest.fn() },
  };
  const repository: any = {
    prisma,
    listActiveAssignments: jest.fn(),
    getAssignment: jest.fn(),
    createAccessRequest: jest.fn(),
    getAccessRequest: jest.fn(),
    markRequest: jest.fn(),
    createGrant: jest.fn(),
    countApprovals: jest.fn(),
    insertApproval: jest.fn(),
    getAccessSessionByHash: jest.fn(),
    touchAccessSession: jest.fn(),
    latestEventHash: jest.fn().mockResolvedValue(null),
    insertEvent: jest.fn(),
    transaction: jest.fn(async (work: any) => work(repository)),
  };
  return repository;
}

describe('industrial staff authorization policy', () => {
  it('does not treat legacy ADMIN as an all-access bypass', () => {
    const policy = new PolicyEngineService();
    const result = policy.evaluate({
      action: 'payment:release',
      user: { id: 'admin', role: 'ADMIN', organizationId: 'org_a', mfaVerified: true },
      resource: { type: 'payment', organizationId: 'org_b', amountKopecks: 1_000 },
    });
    expect(result.allowed).toBe(false);
    expect(result.matchedPolicy).toBe('default-deny');
  });

  it('denies a legacy support role cross-tenant deal reads', () => {
    const policy = new PolicyEngineService();
    const result = policy.evaluate({
      action: 'deal:read',
      user: { id: 'support', role: 'SUPPORT_MANAGER', organizationId: 'org_support' },
      resource: { type: 'deal', sellerOrgId: 'org_a', buyerOrgId: 'org_b' },
    });
    expect(result.allowed).toBe(false);
    expect(result.matchedPolicy).toBe('deny.deal.cross-org-read');
  });

  it('allows only an exact active staff permission inside the target scope', () => {
    const policy = new PolicyEngineService();
    const result = policy.evaluate({
      action: 'deal:read',
      user: { id: 'owner', role: 'ADMIN', organizationId: 'platform_org' },
      resource: { type: 'deal', tenantId: 'tenant_a', organizationId: 'org_a' },
      staffAccess: {
        actorUserId: 'owner',
        accessMode: 'VIEW_AS',
        permissions: ['deal:read'],
        effectiveTenantId: 'tenant_a',
        effectiveOrganizationId: 'org_a',
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    expect(result.allowed).toBe(true);
    expect(result.matchedPolicy).toBe('allow.staff.scoped-grant');
  });

  it('denies staff access outside the granted tenant', () => {
    const policy = new PolicyEngineService();
    const result = policy.evaluate({
      action: 'deal:read',
      user: { id: 'owner', role: 'ADMIN', organizationId: 'platform_org' },
      resource: { type: 'deal', tenantId: 'tenant_b', organizationId: 'org_b' },
      staffAccess: {
        actorUserId: 'owner',
        accessMode: 'VIEW_AS',
        permissions: ['deal:read'],
        effectiveTenantId: 'tenant_a',
        effectiveOrganizationId: 'org_a',
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    expect(result.allowed).toBe(false);
    expect(result.matchedPolicy).toBe('deny.staff.invalid-or-cross-scope');
  });

  it('denies writes in VIEW_AS even when a malformed grant lists the action', () => {
    const policy = new PolicyEngineService();
    const result = policy.evaluate({
      action: 'support-case:update',
      user: { id: 'support', role: 'SUPPORT_MANAGER', organizationId: 'platform_org' },
      resource: { type: 'support_case', tenantId: 'tenant_a', organizationId: 'org_a' },
      staffAccess: {
        actorUserId: 'support',
        accessMode: 'VIEW_AS',
        permissions: ['support-case:update'],
        effectiveTenantId: 'tenant_a',
        effectiveOrganizationId: 'org_a',
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    expect(result.allowed).toBe(false);
    expect(result.matchedPolicy).toBe('deny.staff.view-as-write');
  });

  it('never lets staff replace bank, signature, lab or arbitration authority', () => {
    const policy = new PolicyEngineService();
    for (const action of ['payment:release', 'bank-callback:confirm', 'document:sign', 'lab:finalize', 'arbitration:decide']) {
      const result = policy.evaluate({
        action,
        user: { id: 'owner', role: 'ADMIN', organizationId: 'platform_org', mfaVerified: true },
        resource: { type: 'critical', tenantId: 'tenant_a', organizationId: 'org_a' },
        staffAccess: {
          actorUserId: 'owner',
          accessMode: 'JIT_PRIVILEGED',
          permissions: [action],
          effectiveTenantId: 'tenant_a',
          effectiveOrganizationId: 'org_a',
          expiresAt: new Date(Date.now() + 60_000),
        },
      });
      expect(result.allowed).toBe(false);
      expect(result.matchedPolicy).toBe('deny.staff.authoritative-action');
    }
  });
});

describe('staff access service permission ceilings', () => {
  it('prevents SUPPORT_L1 from reading document content', async () => {
    const repository = repositoryMock();
    repository.getAssignment.mockResolvedValue({
      id: 'assignment', user_id: 'user_staff', role: StaffRole.SUPPORT_L1,
      status: 'ACTIVE', valid_from: new Date(0), valid_until: null,
    });
    const service = new StaffAccessService(repository);
    await expect(service.requestAccess(actor(), {
      assignmentId: 'assignment',
      accessMode: StaffAccessMode.CONTROL_PLANE,
      permissions: [StaffPermission.DOCUMENT_CONTENT_READ],
      reason: 'Investigate support ticket safely',
      ticketId: 'SUP-100',
      durationSeconds: 600,
    })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('prevents DEVELOPER from opening customer cabinets', async () => {
    const repository = repositoryMock();
    repository.getAssignment.mockResolvedValue({
      id: 'assignment', user_id: 'user_staff', role: StaffRole.DEVELOPER,
      status: 'ACTIVE', valid_from: new Date(0), valid_until: null,
    });
    const service = new StaffAccessService(repository);
    await expect(service.requestAccess(actor(), {
      assignmentId: 'assignment',
      accessMode: StaffAccessMode.VIEW_AS,
      permissions: [StaffPermission.CABINET_VIEW_AS],
      targetOrganizationId: 'org_a',
      reason: 'Investigate production incident safely',
      ticketId: 'INC-100',
      durationSeconds: 600,
    })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('prevents VIEW_AS from carrying write permissions', async () => {
    const repository = repositoryMock();
    repository.getAssignment.mockResolvedValue({
      id: 'assignment', user_id: 'user_staff', role: StaffRole.PLATFORM_OWNER,
      status: 'ACTIVE', valid_from: new Date(0), valid_until: null,
    });
    const service = new StaffAccessService(repository);
    await expect(service.requestAccess(actor(), {
      assignmentId: 'assignment',
      accessMode: StaffAccessMode.VIEW_AS,
      permissions: [StaffPermission.CABINET_VIEW_AS, StaffPermission.USER_SESSION_REVOKE],
      targetOrganizationId: 'org_a',
      reason: 'Owner read-only cabinet inspection',
      ticketId: 'OWN-100',
      durationSeconds: 600,
    })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('prevents a requester from approving their own JIT request', async () => {
    const repository = repositoryMock();
    repository.listActiveAssignments.mockResolvedValue([{
      id: 'assignment', user_id: 'user_staff', role: StaffRole.PLATFORM_OWNER,
      status: 'ACTIVE', valid_from: new Date(0), valid_until: null,
    }]);
    repository.getAccessRequest.mockResolvedValue({
      id: 'request', requester_user_id: 'user_staff', assignment_id: 'assignment',
      access_mode: StaffAccessMode.JIT_PRIVILEGED, requested_permissions: [], reason: 'reason',
      ticket_id: 'INC-100', status: 'PENDING', max_duration_seconds: 600,
      requested_at: new Date(), expires_at: new Date(Date.now() + 60_000), version: 1,
    });
    const service = new StaffAccessService(repository);
    await expect(service.decideRequest(actor(), 'request', {
      decision: 'APPROVE',
      reason: 'Self approval must fail',
    })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects expired delegated sessions', async () => {
    const repository = repositoryMock();
    repository.getAccessSessionByHash.mockResolvedValue({
      id: 'session', grant_id: 'grant', actor_user_id: 'user_staff', staff_role: StaffRole.PLATFORM_OWNER,
      status: 'ACTIVE', access_mode: StaffAccessMode.VIEW_AS, permissions: [StaffPermission.DEAL_READ],
      effective_tenant_id: 'tenant_a', effective_organization_id: 'org_a', effective_user_id: null,
      effective_role: 'BUYER', target_deal_id: null, reason: 'reason', ticket_id: 'OWN-100',
      expires_at: new Date(Date.now() - 1),
    });
    const service = new StaffAccessService(repository);
    await expect(service.resolveAccessSession(actor(), 'sat_token.secret')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects critical actions reserved for authoritative actors', async () => {
    const repository = repositoryMock();
    const service = new StaffAccessService(repository);
    await expect(service.requestCriticalAction(actor(), {
      accessSessionId: 'session',
      grantId: 'grant',
      actorUserId: 'user_staff',
      staffRole: StaffRole.PLATFORM_OWNER,
      accessMode: StaffAccessMode.JIT_PRIVILEGED,
      permissions: [StaffPermission.CRITICAL_ACTION_REQUEST],
      effectiveTenantId: 'tenant_a',
      effectiveOrganizationId: 'org_a',
      effectiveUserId: null,
      effectiveRole: null,
      reason: 'incident',
      ticketId: 'INC-100',
      expiresAt: new Date(Date.now() + 60_000),
    }, {
      action: 'payment:release',
      resourceType: 'payment',
      resourceId: 'payment_1',
      payload: { amountKopecks: 100 },
    })).rejects.toBeInstanceOf(ForbiddenException);
  });
});
