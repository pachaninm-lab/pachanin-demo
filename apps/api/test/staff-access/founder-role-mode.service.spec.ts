import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Role, type RequestUser } from '../../src/common/types/request-user';
import {
  FOUNDER_ROLE_MODE_CABINETS,
  FOUNDER_ROLE_MODE_RESTRICTIONS,
} from '../../src/modules/staff-access/founder-role-mode.contract';
import { FounderRoleModeService } from '../../src/modules/staff-access/founder-role-mode.service';
import {
  StaffAccessMode,
  StaffPermission,
  StaffRole,
  type StaffAccessContext,
} from '../../src/modules/staff-access/staff-access.types';

const owner: RequestUser = {
  id: 'founder-user',
  email: 'founder@example.test',
  fullName: 'Founder User',
  orgId: 'platform-org',
  tenantId: 'platform-tenant',
  membershipId: 'founder-membership',
  role: Role.ADMIN,
  mfaVerified: true,
  mfaVerifiedAt: new Date().toISOString(),
};

function fixture(scope: { tenant_id: string | null; organization_id: string | null; user_id: string | null } | null = {
  tenant_id: 'tenant-real',
  organization_id: 'org-real',
  user_id: null,
}) {
  const access = {
    requireActivePlatformOwner: jest.fn().mockResolvedValue({
      id: 'assignment-owner',
      user_id: owner.id,
      role: StaffRole.PLATFORM_OWNER,
      status: 'ACTIVE',
    }),
    requestAccess: jest.fn().mockResolvedValue({
      requestId: 'sar-role-mode',
      status: 'GRANTED',
      grantId: 'sag-role-mode',
      expiresAt: new Date(Date.now() + 900_000).toISOString(),
    }),
  } as any;
  const repository = {
    prisma: {},
    resolveTargetScope: jest.fn().mockResolvedValue(scope),
  } as any;
  return {
    service: new FounderRoleModeService(access, repository),
    access,
    repository,
  };
}

describe('FounderRoleModeService', () => {
  it('exposes one server-owned exact 13-cabinet registry', async () => {
    const { service } = fixture();
    const result = await service.registry(owner);

    expect(result.cabinets).toHaveLength(13);
    expect(new Set(result.cabinets.map((item) => item.key)).size).toBe(13);
    expect(result.cabinets).toEqual(FOUNDER_ROLE_MODE_CABINETS.map((item) => ({ ...item })));
    expect(result.cabinets.find((item) => item.key === 'organization')).toEqual(expect.objectContaining({
      canonicalPath: '/platform-v7/profile',
      effectiveRole: Role.GUEST,
    }));
    expect(result.cabinets.map((item) => String(item.effectiveRole))).not.toContain(Role.BANK_CALLBACK);
    expect(result.mode).toBe(StaffAccessMode.VIEW_AS);
    expect(result.readOnly).toBe(true);
  });

  it('derives tenant and effective role server-side and reuses the durable VIEW_AS flow', async () => {
    const { service, access, repository } = fixture();

    const result = await service.request(owner, {
      cabinetKey: 'buyer',
      organizationId: 'org-real',
      reason: 'Founder inspecting the real buyer cabinet',
      ticketId: 'R1-ROLE-001',
      durationSeconds: 600,
      // Extra properties are deliberately ignored by the service implementation.
      targetTenantId: 'tenant-forged',
      targetRole: Role.ADMIN,
    } as any, 'corr-r1');

    expect(repository.resolveTargetScope).toHaveBeenCalledWith(repository.prisma, {
      actorUserId: owner.id,
      assignmentId: 'assignment-owner',
      targetOrganizationId: 'org-real',
    });
    expect(access.requestAccess).toHaveBeenCalledWith(owner, {
      assignmentId: 'assignment-owner',
      accessMode: StaffAccessMode.VIEW_AS,
      permissions: [
        StaffPermission.CABINET_VIEW_AS,
        StaffPermission.DEAL_READ,
        StaffPermission.DOCUMENT_METADATA_READ,
      ],
      targetTenantId: 'tenant-real',
      targetOrganizationId: 'org-real',
      targetRole: Role.BUYER,
      reason: 'Founder inspecting the real buyer cabinet',
      ticketId: 'R1-ROLE-001',
      durationSeconds: 600,
    }, 'corr-r1');
    expect(result.roleMode).toEqual(expect.objectContaining({
      cabinetKey: 'buyer',
      effectiveRole: Role.BUYER,
      effectiveTenantId: 'tenant-real',
      effectiveOrganizationId: 'org-real',
      readOnly: true,
    }));
  });

  it('rejects a cabinet key outside the server registry before creating authority', async () => {
    const { service, access, repository } = fixture();

    await expect(service.request(owner, {
      cabinetKey: 'invented-admin-role',
      organizationId: 'org-real',
      reason: 'Attempt to forge a cabinet role safely',
      ticketId: 'R1-NEG-001',
    })).rejects.toBeInstanceOf(BadRequestException);

    expect(repository.resolveTargetScope).not.toHaveBeenCalled();
    expect(access.requestAccess).not.toHaveBeenCalled();
  });

  it('fails closed when the organization scope cannot be resolved', async () => {
    const { service, access } = fixture(null);

    await expect(service.request(owner, {
      cabinetKey: 'seller',
      organizationId: 'org-unknown',
      reason: 'Founder inspecting a real seller cabinet',
      ticketId: 'R1-NEG-002',
    })).rejects.toBeInstanceOf(ForbiddenException);

    expect(access.requestAccess).not.toHaveBeenCalled();
  });

  it.each([
    { tenant_id: 'tenant-canonical-test', organization_id: 'org-real', user_id: null },
    { tenant_id: 'tenant-real', organization_id: 'org-canonical-buyer', user_id: null },
  ])('never counts controlled test targets as R1 production role-mode authority', async (scope) => {
    const { service, access } = fixture(scope);

    await expect(service.request(owner, {
      cabinetKey: 'buyer',
      organizationId: scope.organization_id!,
      reason: 'Founder role mode must use real production organization data',
      ticketId: 'R1-NEG-003',
    })).rejects.toBeInstanceOf(ForbiddenException);

    expect(access.requestAccess).not.toHaveBeenCalled();
  });

  it('returns a versioned read-only consumer session contract from durable VIEW_AS context', async () => {
    const { service } = fixture();
    const context: StaffAccessContext = {
      accessSessionId: 'sas-role-mode',
      grantId: 'sag-role-mode',
      actorUserId: owner.id,
      staffRole: StaffRole.PLATFORM_OWNER,
      accessMode: StaffAccessMode.VIEW_AS,
      permissions: [
        StaffPermission.CABINET_VIEW_AS,
        StaffPermission.DEAL_READ,
        StaffPermission.DOCUMENT_METADATA_READ,
      ],
      effectiveTenantId: 'tenant-real',
      effectiveOrganizationId: 'org-real',
      effectiveUserId: null,
      effectiveRole: Role.EXECUTIVE,
      targetDealId: null,
      reason: 'Founder inspecting executive cabinet state',
      ticketId: 'R1-ROLE-002',
      expiresAt: new Date('2026-09-21T00:00:00.000Z'),
    };

    const result = await service.session(owner, context);

    expect(result).toEqual(expect.objectContaining({
      active: true,
      accessSessionId: 'sas-role-mode',
      cabinetKey: 'executive',
      canonicalPath: '/platform-v7/executive',
      effectiveRole: Role.EXECUTIVE,
      effectiveOrganizationId: 'org-real',
      effectiveTenantId: 'tenant-real',
      mode: StaffAccessMode.VIEW_AS,
      readOnly: true,
      restrictions: [...FOUNDER_ROLE_MODE_RESTRICTIONS],
      returnPath: '/platform-v7/staff',
      mfaRequired: true,
    }));
    expect(result.actor).toEqual({ displayName: 'Founder User' });
  });

  it.each([
    { actorUserId: 'different-actor', staffRole: StaffRole.PLATFORM_OWNER },
    { actorUserId: owner.id, staffRole: StaffRole.PLATFORM_ADMIN },
  ])('rejects a VIEW_AS session that is not the founder owner session', async ({ actorUserId, staffRole }) => {
    const { service } = fixture();
    const context = {
      accessSessionId: 'sas-wrong-owner',
      grantId: 'sag-wrong-owner',
      actorUserId,
      staffRole,
      accessMode: StaffAccessMode.VIEW_AS,
      permissions: [
        StaffPermission.CABINET_VIEW_AS,
        StaffPermission.DEAL_READ,
        StaffPermission.DOCUMENT_METADATA_READ,
      ],
      effectiveTenantId: 'tenant-real',
      effectiveOrganizationId: 'org-real',
      effectiveUserId: null,
      effectiveRole: Role.BUYER,
      reason: 'Wrong delegated owner context',
      ticketId: 'R1-NEG-OWNER',
      expiresAt: new Date(Date.now() + 60_000),
    } as StaffAccessContext;

    await expect(service.session(owner, context)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects a role-mode session carrying non-canonical or write-capable permissions', async () => {
    const { service } = fixture();
    const context = {
      accessSessionId: 'sas-bad',
      grantId: 'sag-bad',
      actorUserId: owner.id,
      staffRole: StaffRole.PLATFORM_OWNER,
      accessMode: StaffAccessMode.VIEW_AS,
      permissions: [StaffPermission.CABINET_VIEW_AS, StaffPermission.USER_SESSION_REVOKE],
      effectiveTenantId: 'tenant-real',
      effectiveOrganizationId: 'org-real',
      effectiveUserId: null,
      effectiveRole: Role.BUYER,
      reason: 'Malformed delegated session',
      ticketId: 'R1-NEG-004',
      expiresAt: new Date(Date.now() + 60_000),
    } as StaffAccessContext;

    await expect(service.session(owner, context)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
