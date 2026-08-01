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
  mfaVerified: true,
  mfaVerifiedAt: new Date().toISOString(),
};

function makePrisma() {
  return {
    $queryRaw: jest.fn().mockResolvedValue([]),
    userOrg: {
      findFirst: jest.fn<Promise<{
        id: string;
        role: string;
        isOrgAdmin: boolean;
        organization: { name: string };
      } | null>, [unknown]>(),
      findMany: jest.fn<Promise<Array<{
        id: string;
        role: string;
        status: string;
        isOrgAdmin: boolean;
        version: bigint;
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
    prisma.userOrg.findFirst.mockResolvedValue({
      id: ACTOR.membershipId!,
      role: Role.BUYER,
      isOrgAdmin: false,
      organization: { name: 'Buyer One' },
    });
    prisma.userOrg.findMany.mockResolvedValue([
      {
        id: 'membership-current',
        role: Role.BUYER,
        status: 'ACTIVE',
        isOrgAdmin: false,
        version: 1n,
        isDefault: true,
        joinedAt: new Date('2026-07-01T10:00:00.000Z'),
        user: { id: 'user-current', fullName: 'Current User', email: 'current@example.test', status: 'ACTIVE' },
      },
      {
        id: 'membership-colleague',
        role: Role.ACCOUNTING,
        status: 'ACTIVE',
        isOrgAdmin: false,
        version: 2n,
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
        status: 'ACTIVE',
        organization: { tenantId: 'tenant-1', status: 'VERIFIED' },
        user: { deletedAt: null, status: 'ACTIVE' },
      }),
    }));
    expect(prisma.userOrg.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        organizationId: 'org-1',
        organization: { tenantId: 'tenant-1' },
        user: { deletedAt: null },
        status: 'ACTIVE',
      },
      take: 100,
    }));
    expect(result.organizationId).toBe('org-1');
    expect(result.tenantId).toBe('tenant-1');
    expect(result.members).toHaveLength(2);
    expect(result.members[0]).toMatchObject({ membershipId: 'membership-current', current: true });
    expect(result.members[1]).toMatchObject({ membershipId: 'membership-colleague', current: false });
    expect(result.members.every((member) => member.activeSessionCount === null)).toBe(true);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('shows only aggregate tenant-bound session activity to an MFA-fresh organization administrator', async () => {
    const prisma = makePrisma();
    prisma.userOrg.findFirst.mockResolvedValue({
      id: ACTOR.membershipId!, role: Role.BUYER, isOrgAdmin: true, organization: { name: 'Buyer One' },
    });
    prisma.userOrg.findMany.mockResolvedValue([{
      id: 'membership-current', role: Role.BUYER, status: 'ACTIVE', isOrgAdmin: true, version: 1n,
      isDefault: true, joinedAt: new Date('2026-07-01T10:00:00.000Z'),
      user: { id: 'user-current', fullName: 'Current User', email: 'current@example.test', status: 'ACTIVE' },
    }]);
    prisma.$queryRaw.mockResolvedValue([{
      membership_id: 'membership-current', active_session_count: 2n,
      last_seen_at: new Date('2026-08-01T11:30:00.000Z'),
    }]);

    const result = await new OrganizationTeamService(prisma as never).readFor(ACTOR);

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(result.members[0]).toMatchObject({
      activeSessionCount: 2, lastSessionSeenAt: '2026-08-01T11:30:00.000Z',
    });
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
