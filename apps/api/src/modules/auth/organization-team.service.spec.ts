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
  sessionId: 'session-current',
  mfaVerified: true,
  mfaVerifiedAt: new Date().toISOString(),
};

function teamRow(overrides: Record<string, unknown> = {}) {
  return {
    actor_role: Role.BUYER,
    actor_is_org_admin: false,
    actor_has_fresh_mfa: false,
    organization_name: 'Buyer One',
    membership_id: 'membership-current',
    member_user_id: 'user-current',
    full_name: 'Current User',
    email: 'current@example.test',
    member_role: Role.BUYER,
    user_status: 'ACTIVE',
    membership_status: 'ACTIVE',
    member_is_org_admin: false,
    membership_version: 1n,
    is_default: true,
    joined_at: new Date('2026-07-01T10:00:00.000Z'),
    active_session_count: null,
    last_session_seen_at: null,
    ...overrides,
  };
}

function makePrisma(rows: unknown[] = []) {
  return { $queryRaw: jest.fn().mockResolvedValue(rows) };
}

describe('OrganizationTeamService', () => {
  it('uses one session-bound PostgreSQL projection and marks the current membership', async () => {
    const prisma = makePrisma([
      teamRow(),
      teamRow({
        membership_id: 'membership-colleague',
        member_user_id: 'user-colleague',
        full_name: 'Colleague',
        email: 'colleague@example.test',
        member_role: Role.ACCOUNTING,
        membership_version: 2n,
        is_default: false,
        joined_at: new Date('2026-07-02T10:00:00.000Z'),
      }),
    ]);

    const result = await new OrganizationTeamService(prisma as never).readFor(ACTOR);

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    const query = prisma.$queryRaw.mock.calls[0][0] as { strings: readonly string[]; values: readonly unknown[] };
    expect(query.strings.join(' ')).toContain('auth.organization_team_snapshot');
    expect(query.values).toEqual([
      'session-current', 'user-current', 'membership-current', 'org-1', 'tenant-1',
    ]);
    expect(result).toMatchObject({
      organizationId: 'org-1',
      tenantId: 'tenant-1',
      currentMembershipId: 'membership-current',
      isOrganizationAdmin: false,
      hasFreshMfa: false,
    });
    expect(result.members).toHaveLength(2);
    expect(result.members[0]).toMatchObject({ membershipId: 'membership-current', current: true });
    expect(result.members[1]).toMatchObject({ membershipId: 'membership-colleague', current: false });
    expect(result.members.every((member) => member.activeSessionCount === null)).toBe(true);
  });

  it('returns only PostgreSQL-authorized aggregate activity for an MFA-fresh administrator', async () => {
    const prisma = makePrisma([teamRow({
      actor_is_org_admin: true,
      actor_has_fresh_mfa: true,
      member_is_org_admin: true,
      active_session_count: 2n,
      last_session_seen_at: new Date('2026-08-01T11:30:00.000Z'),
    })]);

    const result = await new OrganizationTeamService(prisma as never).readFor(ACTOR);

    expect(result.isOrganizationAdmin).toBe(true);
    expect(result.hasFreshMfa).toBe(true);
    expect(result.members[0]).toMatchObject({
      activeSessionCount: 2,
      lastSessionSeenAt: '2026-08-01T11:30:00.000Z',
    });
  });

  it('fails closed when PostgreSQL cannot prove the active session tuple', async () => {
    const prisma = makePrisma([]);

    await expect(new OrganizationTeamService(prisma as never).readFor(ACTOR))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['tenantId', ''],
    ['orgId', ''],
    ['membershipId', ''],
    ['sessionId', ''],
  ] as const)('rejects a missing %s before querying PostgreSQL', async (field, value) => {
    const prisma = makePrisma();

    await expect(new OrganizationTeamService(prisma as never).readFor({ ...ACTOR, [field]: value }))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });
});
