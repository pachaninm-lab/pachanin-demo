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
  const repository = { prisma: { $queryRaw: jest.fn() } } as any;
  const staffAuthorityPrisma = { $queryRaw: jest.fn().mockResolvedValue(rows) } as any;
  return {
    service: new StaffAccessRequestService(repository, access, staffAuthorityPrisma),
    access,
    repository,
    staffAuthorityPrisma,
  };
}

describe('StaffAccessRequestService deal scope binding', () => {
  it('injects the authoritative tenant returned by the dedicated staff datasource', async () => {
    const { service, access, staffAuthorityPrisma, repository } = fixture([{
      tenant_id: 'tenant-a',
      seller_organization_id: 'seller-org',
      buyer_organization_id: 'buyer-org',
    }]);

    await service.requestAccess(user, baseInput, 'correlation-1');

    expect(staffAuthorityPrisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(repository.prisma.$queryRaw).not.toHaveBeenCalled();
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

  it('does not invoke either projection datasource for requests without a target deal', async () => {
    const { service, access, repository, staffAuthorityPrisma } = fixture([]);
    const input = { ...baseInput, targetDealId: undefined, targetTenantId: 'tenant-a' };
    await service.requestAccess(user, input);
    expect(repository.prisma.$queryRaw).not.toHaveBeenCalled();
    expect(staffAuthorityPrisma.$queryRaw).not.toHaveBeenCalled();
    expect(access.requestAccess).toHaveBeenCalledWith(user, input, undefined);
  });
});


describe('StaffAccessRequestService exact intent replay before mutable deal resolution', () => {
  const intent = { ...baseInput, createIntentId: '772d6bd1-fbba-4801-a7b4-407f570522ec' };
  it('returns the immutable committed receipt before attempting a changed/deleted deal lookup', async () => {
    const f = fixture([]); const receipt = { requestId: 'sar-original', grantId: 'sag-original', status: 'GRANTED', expiresAt: '2026-10-29T01:00:00.000Z' };
    f.access.replayAccessRequest = jest.fn().mockResolvedValue(receipt);
    await expect(f.service.requestAccess(user, intent, 'retry')).resolves.toBe(receipt);
    expect(f.staffAuthorityPrisma.$queryRaw).not.toHaveBeenCalled(); expect(f.access.requestAccess).not.toHaveBeenCalled();
    expect(f.access.replayAccessRequest).toHaveBeenCalledWith(user, intent);
  });
  it('passes original command separately from newly resolved tenant for a genuinely new intent', async () => {
    const f = fixture([{ tenant_id: 'tenant-a', seller_organization_id: 'seller-org', buyer_organization_id: 'buyer-org' }]);
    f.access.replayAccessRequest = jest.fn().mockResolvedValue(null);
    await f.service.requestAccess(user, intent, 'first');
    expect(f.access.requestAccess).toHaveBeenCalledWith(user, { ...intent, targetTenantId: 'tenant-a' }, 'first', undefined, undefined, intent);
  });
  it('propagates actor/payload/evidence rejection without performing mutable deal resolution', async () => {
    const f = fixture([]); const failure = new ForbiddenException('Actor context changed');
    f.access.replayAccessRequest = jest.fn().mockRejectedValue(failure);
    await expect(f.service.requestAccess(user, intent)).rejects.toBe(failure);
    expect(f.staffAuthorityPrisma.$queryRaw).not.toHaveBeenCalled(); expect(f.access.requestAccess).not.toHaveBeenCalled();
  });
});
