import { ForbiddenException } from '@nestjs/common';
import { RequestUser, Role } from '../../src/common/types/request-user';
import { StaffCapabilitiesService, StaffWorkspace } from '../../src/modules/staff-access/staff-capabilities.service';
import {
  ROLE_PERMISSION_CEILING,
  StaffAccessMode,
  StaffPermission,
  StaffRole,
} from '../../src/modules/staff-access/staff-access.types';

const now = new Date();

function actor(overrides: Partial<RequestUser> = {}): RequestUser {
  return {
    id: 'staff-1',
    orgId: 'external-org-is-not-staff-scope',
    role: Role.ADMIN,
    email: 'staff@example.test',
    fullName: 'Staff User',
    mfaVerified: true,
    mfaVerifiedAt: now.toISOString(),
    ...overrides,
  };
}

function assignment(id: string, role: StaffRole) {
  return {
    id,
    user_id: 'staff-1',
    role,
    status: 'ACTIVE',
    valid_from: new Date(now.getTime() - 60_000),
    valid_until: null,
  };
}

function accessSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 'session-1',
    grant_id: 'grant-1',
    actor_user_id: 'staff-1',
    staff_role: StaffRole.OPERATIONS_AGENT,
    token_hash: 'must-never-leave-api',
    status: 'ACTIVE',
    effective_tenant_id: 'tenant-1',
    effective_organization_id: 'org-1',
    effective_user_id: null,
    effective_role: null,
    target_deal_id: 'deal-1',
    access_mode: StaffAccessMode.OPERATIONS,
    permissions: [StaffPermission.DEAL_READ],
    reason: 'bounded operations',
    ticket_id: 'case-1',
    mfa_level: 'TOTP',
    expires_at: new Date(now.getTime() + 15 * 60_000),
    ended_at: null,
    ...overrides,
  };
}

function fixture(assignments: unknown[], sessions: unknown[] = []) {
  const prisma = {};
  const repository = {
    prisma,
    listActiveAssignments: jest.fn().mockResolvedValue(assignments),
    listActiveSessions: jest.fn().mockResolvedValue(sessions),
  } as any;
  return {
    service: new StaffCapabilitiesService(repository),
    repository,
    prisma,
  };
}

describe('Company OS staff capabilities contract', () => {
  it('derives PLATFORM_OWNER capabilities from the server role ceiling only', async () => {
    const { service, repository, prisma } = fixture([
      assignment('assignment-owner', StaffRole.PLATFORM_OWNER),
    ]);

    const result = await service.getMine(actor());

    expect(result.roles).toEqual([StaffRole.PLATFORM_OWNER]);
    expect(result.capabilities).toEqual([...ROLE_PERMISSION_CEILING.PLATFORM_OWNER].sort());
    expect(result.workspaces).toEqual(expect.arrayContaining([
      StaffWorkspace.OWNER,
      StaffWorkspace.COMMAND,
      StaffWorkspace.PEOPLE,
      StaffWorkspace.PARTNERS,
      StaffWorkspace.FINANCE,
      StaffWorkspace.RISK,
      StaffWorkspace.PLATFORM,
      StaffWorkspace.GOVERNANCE,
    ]));
    expect(repository.listActiveAssignments).toHaveBeenCalledWith(prisma, 'staff-1');
    expect(repository.listActiveSessions).toHaveBeenCalledWith(prisma, 'staff-1');
  });

  it('returns only sanitized active privileged-session metadata', async () => {
    const { service } = fixture(
      [assignment('assignment-ops', StaffRole.OPERATIONS_AGENT)],
      [accessSession()],
    );

    const result = await service.getMine(actor());
    const serialized = JSON.stringify(result);

    expect(result.activeAccessSessions).toEqual([expect.objectContaining({
      accessSessionId: 'session-1',
      staffRole: StaffRole.OPERATIONS_AGENT,
      accessMode: StaffAccessMode.OPERATIONS,
      permissions: [StaffPermission.DEAL_READ],
      effectiveTenantId: 'tenant-1',
      effectiveOrganizationId: 'org-1',
      targetDealId: 'deal-1',
      mfaLevel: 'TOTP',
    })]);
    expect(result.scopes).toEqual([expect.objectContaining({
      accessSessionId: 'session-1',
      effectiveTenantId: 'tenant-1',
      effectiveOrganizationId: 'org-1',
      targetDealId: 'deal-1',
    })]);
    expect(serialized).not.toContain('must-never-leave-api');
    expect(serialized).not.toContain('token_hash');
    expect(serialized).not.toContain('bounded operations');
  });

  it('unions and deduplicates capabilities for multiple durable assignments', async () => {
    const { service } = fixture([
      assignment('assignment-ops', StaffRole.OPERATIONS_AGENT),
      assignment('assignment-finance', StaffRole.FINANCE_OPS),
    ]);

    const result = await service.getMine(actor());
    const expected = [...new Set([
      ...ROLE_PERMISSION_CEILING.OPERATIONS_AGENT,
      ...ROLE_PERMISSION_CEILING.FINANCE_OPS,
    ])].sort();

    expect(result.roles).toEqual([StaffRole.OPERATIONS_AGENT, StaffRole.FINANCE_OPS]);
    expect(result.capabilities).toEqual(expected);
    expect(result.workspaces).toEqual(expect.arrayContaining([
      StaffWorkspace.OPERATIONS,
      StaffWorkspace.FINANCE,
    ]));
  });

  it('ignores client-shaped presentation and staff role claims', async () => {
    const { service } = fixture([
      assignment('assignment-support', StaffRole.SUPPORT_L1),
    ]);

    const result = await service.getMine(actor({
      surfaceRole: 'PLATFORM_OWNER',
      staffRoles: [StaffRole.PLATFORM_OWNER],
      staffAssignmentIds: ['forged-owner-assignment'],
    }));

    expect(result.roles).toEqual([StaffRole.SUPPORT_L1]);
    expect(result.capabilities).toEqual([...ROLE_PERMISSION_CEILING.SUPPORT_L1].sort());
    expect(result.capabilities).not.toContain(StaffPermission.STAFF_ASSIGNMENT_WRITE);
    expect(result.workspaces).not.toContain(StaffWorkspace.OWNER);
  });

  it('fails closed when there is no active server-side staff assignment', async () => {
    const { service, repository } = fixture([]);

    await expect(service.getMine(actor())).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.listActiveSessions).not.toHaveBeenCalled();
  });

  it('fails closed before authority lookup when MFA is not verified', async () => {
    const { service, repository } = fixture([
      assignment('assignment-owner', StaffRole.PLATFORM_OWNER),
    ]);

    await expect(service.getMine(actor({ mfaVerified: false }))).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.listActiveAssignments).not.toHaveBeenCalled();
    expect(repository.listActiveSessions).not.toHaveBeenCalled();
  });
});
