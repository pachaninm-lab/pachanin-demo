import { RequestUser, Role } from '../../src/common/types/request-user';
import {
  StaffAccessContext,
  StaffAccessMode,
  StaffPermission,
  StaffRole,
} from '../../src/modules/staff-access/staff-access.types';
import { StaffSupportService } from '../../src/modules/staff-access/staff-support.service';

const actor: RequestUser = {
  id: 'staff-owner',
  email: 'owner@example.test',
  fullName: 'Platform Owner',
  orgId: 'platform-org',
  tenantId: 'platform-tenant',
  membershipId: 'platform-membership',
  role: Role.ADMIN,
  sessionId: 'auth-session',
  mfaVerified: true,
  mfaVerifiedAt: new Date().toISOString(),
};

const access: StaffAccessContext = {
  accessSessionId: 'staff-session',
  grantId: 'staff-grant',
  actorUserId: actor.id,
  staffRole: StaffRole.PLATFORM_OWNER,
  accessMode: StaffAccessMode.CONTROL_PLANE,
  permissions: Object.values(StaffPermission),
  effectiveTenantId: null,
  effectiveOrganizationId: null,
  effectiveUserId: null,
  effectiveRole: null,
  targetDealId: null,
  reason: 'Owner support operations',
  ticketId: 'OWN-1',
  expiresAt: new Date(Date.now() + 60_000),
};

function setup() {
  const tx = {
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn().mockResolvedValue(1),
  };
  const prisma = {
    organization: { findUnique: jest.fn().mockResolvedValue({ id: 'org-1', tenantId: 'tenant-1', name: 'Org 1' }) },
    userOrg: { findFirst: jest.fn().mockResolvedValue({ id: 'membership-1' }) },
    deal: { findFirst: jest.fn().mockResolvedValue({ id: 'deal-1', tenantId: 'tenant-1' }) },
    $queryRaw: jest.fn().mockResolvedValue([]),
  };
  const repository = {
    prisma,
    transaction: jest.fn(async (work: (client: typeof tx) => Promise<unknown>) => work(tx)),
  } as any;
  const accessService = { requirePermission: jest.fn().mockResolvedValue(StaffRole.PLATFORM_OWNER) } as any;
  const audit = { recordInTransaction: jest.fn().mockResolvedValue('correlation-1') } as any;
  return { tx, prisma, repository, accessService, audit, service: new StaffSupportService(repository, accessService, audit) };
}

const insertedCase = {
  id: 'sup-1', tenant_id: 'tenant-1', organization_id: 'org-1', organization_name: '', organization_inn: '',
  user_id: null, user_email: null, user_full_name: null, deal_id: null, deal_number: null,
  subject: 'Missing EPD', description: 'Electronic transport document is missing', priority: 'HIGH', status: 'OPEN', source: 'STAFF',
  created_by_user_id: actor.id, assigned_staff_user_id: null, idempotency_key: 'SUP-1', version: 1,
  created_at: new Date(), updated_at: new Date(), resolved_at: null, closed_at: null,
};

describe('StaffSupportService', () => {
  it('creates a durable support case, event and staff audit atomically', async () => {
    const { service, tx, accessService, audit } = setup();
    tx.$queryRaw.mockResolvedValueOnce([insertedCase]);
    const result = await service.createCase(actor, access, {
      organizationId: 'org-1', subject: 'Missing EPD', description: 'Electronic transport document is missing',
      priority: 'HIGH', idempotencyKey: 'SUP-1',
    }, 'correlation-1');
    expect(accessService.requirePermission).toHaveBeenCalledWith(actor, StaffPermission.SUPPORT_CASE_UPDATE);
    expect(result).toMatchObject({ replayed: false, case: { id: 'sup-1', status: 'OPEN' } });
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(audit.recordInTransaction).toHaveBeenCalledWith(tx, actor, access, expect.objectContaining({
      action: 'staff.support.case.create', resourceType: 'support-case', correlationId: 'correlation-1',
    }));
  });

  it('returns the existing case on an idempotent replay without duplicating the event', async () => {
    const { service, tx, audit } = setup();
    tx.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([insertedCase]);
    const result = await service.createCase(actor, access, {
      organizationId: 'org-1', subject: 'Missing EPD', description: 'Electronic transport document is missing',
      priority: 'HIGH', idempotencyKey: 'SUP-1',
    });
    expect(result).toMatchObject({ replayed: true, case: { id: 'sup-1' } });
    expect(tx.$executeRaw).not.toHaveBeenCalled();
    expect(audit.recordInTransaction).not.toHaveBeenCalled();
  });

  it('transitions a case with optimistic concurrency and records before/after state', async () => {
    const { service, tx, audit } = setup();
    tx.$queryRaw
      .mockResolvedValueOnce([{ id: 'sup-1', tenant_id: 'tenant-1', organization_id: 'org-1', user_id: null, deal_id: 'deal-1', status: 'OPEN', version: 1 }])
      .mockResolvedValueOnce([{ id: 'sup-1', tenant_id: 'tenant-1', organization_id: 'org-1', user_id: null, deal_id: 'deal-1', status: 'IN_PROGRESS', version: 2 }]);
    const result = await service.transitionCase(actor, access, 'sup-1', {
      status: 'IN_PROGRESS', expectedVersion: 1, note: 'Assigned to support engineer',
    }, 'correlation-2');
    expect(result).toMatchObject({ status: 'IN_PROGRESS', version: 2 });
    expect(audit.recordInTransaction).toHaveBeenCalledWith(tx, actor, access, expect.objectContaining({
      action: 'staff.support.case.transition', metadata: expect.objectContaining({ beforeStatus: 'OPEN', afterStatus: 'IN_PROGRESS', beforeVersion: 1, afterVersion: 2 }),
    }));
  });

  it('revokes only target-organization sessions and refresh tokens', async () => {
    const { service, tx, accessService, audit } = setup();
    tx.$queryRaw.mockResolvedValueOnce([{ id: 'session-1' }, { id: 'session-2' }]);
    tx.$executeRaw.mockResolvedValueOnce(2);
    const result = await service.revokeUserSessions(actor, access, 'user-1', {
      organizationId: 'org-1', reason: 'Confirmed account takeover investigation',
    }, 'correlation-3');
    expect(accessService.requirePermission).toHaveBeenCalledWith(actor, StaffPermission.USER_SESSION_REVOKE);
    expect(result).toEqual({ success: true, revokedSessions: 2, revokedRefreshTokens: 2 });
    expect(audit.recordInTransaction).toHaveBeenCalledWith(tx, actor, access, expect.objectContaining({ action: 'staff.user.sessions.revoke' }));
  });

  it('registers recovery as pending delivery instead of claiming the reset was delivered', async () => {
    const { service, tx, accessService, audit } = setup();
    const result = await service.initiateRecovery(actor, access, 'user-1', {
      organizationId: 'org-1', reason: 'Identity verified through the support procedure', ticketId: 'SUP-1024',
    }, 'correlation-4');
    expect(accessService.requirePermission).toHaveBeenCalledWith(actor, StaffPermission.USER_ACCESS_RECOVERY_INITIATE);
    expect(result).toMatchObject({ status: 'PENDING_DELIVERY' });
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(audit.recordInTransaction).toHaveBeenCalledWith(tx, actor, access, expect.objectContaining({
      action: 'staff.user.recovery.initiate', metadata: expect.objectContaining({ deliveryStatus: 'PENDING_DELIVERY' }),
    }));
  });

  it('enforces effective organization scope before support mutations', async () => {
    const { service } = setup();
    await expect(service.createCase(actor, { ...access, effectiveOrganizationId: 'org-other' }, {
      organizationId: 'org-1', subject: 'Missing EPD', description: 'Electronic transport document is missing',
      priority: 'HIGH', idempotencyKey: 'SUP-2',
    })).rejects.toThrow('Staff session organization scope mismatch');
  });
});
