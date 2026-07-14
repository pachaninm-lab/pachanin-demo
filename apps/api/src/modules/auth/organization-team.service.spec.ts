import { ForbiddenException } from '@nestjs/common';
import { Role, type RequestUser } from '../../common/types/request-user';
import { OrganizationTeamService } from './organization-team.service';

const ACTOR: RequestUser = {
  id: 'user-current',
  email: 'current@example.test',
  fullName: 'Current User',
  role: Role.BUYER,
  orgId: 'org-1',
  tenantId: 'tenant-1',
  membershipId: 'membership-current',
};

function makePrisma() {
  return {
    userOrg: {
      findFirst: jest.fn<Promise<{ id: string } | null>, [unknown]>(),
      findMany: jest.fn<Promise<Array<{
        id: string;
        role: string;
        isDefault: boolean;
        joinedAt: Date;
        user: { id: string; fullName: string; email: string; status: string };
      }>>, [unknown]>(),
    },
  };
}

describe('OrganizationTeamService', () => {
  it('returns only the active tenant organization and marks the current membership', async () => {
    const prisma = makePrisma();
    prisma.userOrg.findFirst.mockResolvedValue({ id: ACTOR.membershipId! });
    prisma.userOrg.findMany.mockResolvedValue([
      {
        id: 'membership-current',
        role: Role.BUYER,
        isDefault: true,
        joinedAt: new Date('2026-07-01T10:00:00.000Z'),
        user: { id: 'user-current', fullName: 'Current User', email: 'current@example.test', status: 'ACTIVE' },
      },
      {
        id: 'membership-colleague',
        role: Role.ACCOUNTING,
        isDefault: false,
        joinedAt: new Date('2026-07-02T10:00:00.000Z'),
        user: { id: 'user-colleague', fullName: 'Colleague', email: 'colleague@example.test', status: 'ACTIVE' },
      },
    ]);

    const service = new OrganizationTeamService(prisma as never);
    const result = await service.readFor(ACTOR);

    expect(prisma.userOrg.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: 'membership-current',
        userId: 'user-current',
        organizationId: 'org-1',
        organization: { tenantId: 'tenant-1' },
        user: { deletedAt: null },
      }),
    }));
    expect(prisma.userOrg.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        organizationId: 'org-1',
        organization: { tenantId: 'tenant-1' },
        user: { deletedAt: null },
      },
      take: 100,
    }));
    expect(result.organizationId).toBe('org-1');
    expect(result.tenantId).toBe('tenant-1');
    expect(result.members).toHaveLength(2);
    expect(result.members[0]).toMatchObject({ membershipId: 'membership-current', current: true });
    expect(result.members[1]).toMatchObject({ membershipId: 'membership-colleague', current: false });
  });

  it('fails closed when the active membership cannot be proven', async () => {
    const prisma = makePrisma();
    prisma.userOrg.findFirst.mockResolvedValue(null);
    const service = new OrganizationTeamService(prisma as never);

    await expect(service.readFor(ACTOR)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.userOrg.findMany).not.toHaveBeenCalled();
  });

  it('rejects incomplete session authority before querying PostgreSQL', async () => {
    const prisma = makePrisma();
    const service = new OrganizationTeamService(prisma as never);

    await expect(service.readFor({ ...ACTOR, tenantId: '' })).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.userOrg.findFirst).not.toHaveBeenCalled();
    expect(prisma.userOrg.findMany).not.toHaveBeenCalled();
  });
});
