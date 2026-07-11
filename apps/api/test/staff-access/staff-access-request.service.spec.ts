import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Role, RequestUser } from '../../src/common/types/request-user';
import { StaffAccessRequestService } from '../../src/modules/staff-access/staff-access-request.service';
import { StaffAccessMode, StaffPermission } from '../../src/modules/staff-access/staff-access.types';

const user: RequestUser = {
  id: 'staff-user',
  email: 'staff@example.test',
  orgId: 'platform-org',
  tenantId: 'platform-tenant',
  membershipId: 'staff-membership',
  role: Role.ADMIN,
  mfaVerified: true,
  mfaVerifiedAt: new Date().toISOString(),
};

const baseInput = {
  assignmentId: 'assignment-1',
  accessMode: StaffAccessMode.VIEW_AS,
  permissions: [StaffPermission.CABINET_VIEW_AS, StaffPermission.DEAL_READ],
  targetDealId: 'deal-1',
  targetOrganizationId: 'buyer-org',
  targetRole: 'BUYER',
  reason: 'Investigate the exact customer deal safely',
  ticketId: 'SUP-100',
  durationSeconds: 600,
};

function fixture(rows: unknown[]) {
  const access = { requestAccess: jest.fn().mockResolvedValue({ requestId: 'request-1' }) } as any;
  const repository = { prisma: { $queryRaw: jest.fn().mockResolvedValue(rows) } } as any;
  return { service: new StaffAccessRequestService(repository, access), access, repository };
}

describe('StaffAccessRequestService deal scope binding', () => {
  it('injects the authoritative tenant returned by PostgreSQL', async () => {
    const { service, access } = fixture([{
      tenant_id: 'tenant-a',
      seller_organization_id: 'seller-org',
      buyer_organization_id: 'buyer-org',
    }]);

    await service.requestAccess(user, baseInput, 'correlation-1');

    expect(access.requestAccess).toHaveBeenCalledWith(user, {
      ...baseInput,
      targetTenantId: 'tenant-a',
    }, 'correlation-1');
  });

  it('rejects a caller-supplied tenant that differs from the deal tenant', async () => {
    const { service, access } = fixture([{
      tenant_id: 'tenant-a',
      seller_organization_id: 'seller-org',
      buyer_organization_id: 'buyer-org',
    }]);

    await expect(service.requestAccess(user, {
      ...baseInput,
      targetTenantId: 'tenant-b',
    })).rejects.toBeInstanceOf(ForbiddenException);
    expect(access.requestAccess).not.toHaveBeenCalled();
  });

  it('rejects an organization that is not a deal participant', async () => {
    const { service, access } = fixture([{
      tenant_id: 'tenant-a',
      seller_organization_id: 'seller-org',
      buyer_organization_id: 'buyer-org',
    }]);

    await expect(service.requestAccess(user, {
      ...baseInput,
      targetOrganizationId: 'unrelated-org',
    })).rejects.toBeInstanceOf(ForbiddenException);
    expect(access.requestAccess).not.toHaveBeenCalled();
  });

  it('fails closed when the deal does not exist', async () => {
    const { service, access } = fixture([]);
    await expect(service.requestAccess(user, baseInput)).rejects.toBeInstanceOf(NotFoundException);
    expect(access.requestAccess).not.toHaveBeenCalled();
  });

  it('does not invoke the projection for requests without a target deal', async () => {
    const { service, access, repository } = fixture([]);
    const input = { ...baseInput, targetDealId: undefined, targetTenantId: 'tenant-a' };
    await service.requestAccess(user, input);
    expect(repository.prisma.$queryRaw).not.toHaveBeenCalled();
    expect(access.requestAccess).toHaveBeenCalledWith(user, input, undefined);
  });
});
