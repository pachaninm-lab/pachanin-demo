import { Role, RequestUser } from '../../src/common/types/request-user';
import { StaffAccessRequestService } from '../../src/modules/staff-access/staff-access-request.service';
import {
  StaffAccessMode,
  StaffPermission,
  StaffRole,
} from '../../src/modules/staff-access/staff-access.types';

const user: RequestUser = {
  id: 'staff-owner',
  email: 'owner@example.test',
  orgId: 'platform-org',
  tenantId: 'platform-tenant',
  membershipId: 'membership-owner',
  role: Role.ADMIN,
  mfaVerified: true,
  mfaVerifiedAt: new Date().toISOString(),
};

const projected = [{
  id: 'request-1',
  requester_user_id: user.id,
  assignment_id: 'assignment-1',
  access_mode: StaffAccessMode.CONTROL_PLANE,
  permissions: [StaffPermission.ORGANIZATION_LIST],
  status: 'GRANTED',
  grant_id: 'grant-1',
  grant_status: 'ACTIVE',
  grant_expires_at: new Date(Date.now() + 60_000),
}];

function fixture() {
  const prisma = { $queryRaw: jest.fn().mockResolvedValue(projected) };
  const repository = {
    prisma,
    listAccessRequests: jest.fn().mockResolvedValue([{ id: 'review-request' }]),
  } as any;
  const access = {
    requirePermission: jest.fn().mockResolvedValue(StaffRole.PLATFORM_OWNER),
  } as any;
  return {
    service: new StaffAccessRequestService(repository, access),
    repository,
    access,
    prisma,
  };
}

describe('StaffAccessRequestService refreshed activation projection', () => {
  it('returns only the actor own requests with the latest nullable grant projection', async () => {
    const { service, repository, prisma } = fixture();

    await expect(service.listRequests(user)).resolves.toEqual(projected);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(repository.listAccessRequests).not.toHaveBeenCalled();
  });

  it('keeps global review behind an active CONTROL_PLANE permission context', async () => {
    const { service, repository, access } = fixture();
    const context = {
      accessSessionId: 'session-1',
      grantId: 'grant-review',
      actorUserId: user.id,
      staffRole: StaffRole.PLATFORM_OWNER,
      accessMode: StaffAccessMode.CONTROL_PLANE,
      permissions: [StaffPermission.STAFF_REQUEST_READ],
      effectiveTenantId: null,
      effectiveOrganizationId: null,
      effectiveUserId: null,
      effectiveRole: null,
      targetDealId: null,
      reason: 'Review access queue',
      ticketId: 'SEC-100',
      expiresAt: new Date(Date.now() + 60_000),
    };

    await expect(service.listRequests(user, context)).resolves.toEqual([{ id: 'review-request' }]);
    expect(access.requirePermission).toHaveBeenCalledWith(user, StaffPermission.STAFF_REQUEST_READ);
    expect(repository.listAccessRequests).toHaveBeenCalledWith(repository.prisma, user.id, true);
  });
});
