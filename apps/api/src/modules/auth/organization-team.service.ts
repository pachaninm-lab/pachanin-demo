import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RequestUser } from '../../common/types/request-user';
import { AuthPrismaService } from './auth-prisma.service';

export type OrganizationTeamMember = Readonly<{
  membershipId: string;
  userId: string;
  fullName: string;
  email: string;
  role: string;
  userStatus: string;
  membershipStatus: string;
  isOrgAdmin: boolean;
  version: string;
  isDefault: boolean;
  joinedAt: string;
  current: boolean;
  activeSessionCount: number | null;
  lastSessionSeenAt: string | null;
}>;

export type OrganizationTeamSnapshot = Readonly<{
  organizationId: string;
  tenantId: string;
  currentMembershipId: string;
  organizationName: string;
  currentRole: string;
  isOrganizationAdmin: boolean;
  hasFreshMfa: boolean;
  members: readonly OrganizationTeamMember[];
}>;

@Injectable()
export class OrganizationTeamService {
  constructor(private readonly prisma: AuthPrismaService) {}

  async readFor(user: RequestUser): Promise<OrganizationTeamSnapshot> {
    const tenantId = String(user.tenantId ?? '').trim();
    const organizationId = String(user.orgId ?? '').trim();
    const membershipId = String(user.membershipId ?? '').trim();
    const userId = String(user.id ?? '').trim();
    if (!tenantId || !organizationId || !membershipId || !userId) {
      throw new ForbiddenException('Active tenant membership is required.');
    }

    const currentMembership = await this.prisma.userOrg.findFirst({
      where: {
        id: membershipId,
        userId,
        organizationId,
        status: 'ACTIVE',
        organization: { tenantId, status: 'VERIFIED' },
        user: { deletedAt: null, status: 'ACTIVE' },
      },
      select: {
        id: true,
        role: true,
        isOrgAdmin: true,
        organization: { select: { name: true } },
      },
    });
    if (!currentMembership) {
      throw new ForbiddenException('Membership does not belong to the active tenant session.');
    }

    const memberships = await this.prisma.userOrg.findMany({
      where: {
        organizationId,
        organization: { tenantId },
        user: { deletedAt: null },
        ...(!currentMembership.isOrgAdmin ? { status: 'ACTIVE' } : {}),
      },
      orderBy: [{ joinedAt: 'asc' }, { id: 'asc' }],
      take: 100,
      select: {
        id: true,
        role: true,
        status: true,
        isOrgAdmin: true,
        version: true,
        isDefault: true,
        joinedAt: true,
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            status: true,
          },
        },
      },
    });

    const freshMfa = this.hasFreshMfa(user);
    const sessionRows = currentMembership.isOrgAdmin && freshMfa
      ? await this.prisma.$queryRaw<Array<{
          membership_id: string;
          active_session_count: bigint;
          last_seen_at: Date | null;
        }>>(Prisma.sql`
          SELECT
            session.membership_id,
            COUNT(*)::bigint AS active_session_count,
            MAX(session.last_seen_at) AS last_seen_at
          FROM auth.sessions session
          JOIN public.user_orgs membership
            ON membership.id = session.membership_id
            AND membership."organizationId" = session.organization_id
            AND membership."userId" = session.user_id
          JOIN public.organizations organization
            ON organization.id = session.organization_id
            AND organization."tenantId" = session.tenant_id
          WHERE session.organization_id = ${organizationId}
            AND session.tenant_id = ${tenantId}
            AND session.status = 'ACTIVE'
            AND session.expires_at > NOW()
          GROUP BY session.membership_id
        `)
      : [];
    const sessionByMembership = new Map(sessionRows.map((row) => [row.membership_id, row]));

    return Object.freeze({
      organizationId,
      tenantId,
      currentMembershipId: membershipId,
      organizationName: currentMembership.organization.name,
      currentRole: currentMembership.role,
      isOrganizationAdmin: currentMembership.isOrgAdmin,
      hasFreshMfa: freshMfa,
      members: Object.freeze(memberships.map((membership) => {
        const sessionSummary = sessionByMembership.get(membership.id);
        return Object.freeze({
        membershipId: membership.id,
        userId: membership.user.id,
        fullName: membership.user.fullName,
        email: membership.user.email,
        role: membership.role,
        userStatus: membership.user.status,
        membershipStatus: membership.status,
        isOrgAdmin: membership.isOrgAdmin,
        version: membership.version.toString(),
        isDefault: membership.isDefault,
        joinedAt: membership.joinedAt.toISOString(),
        current: membership.id === membershipId,
        activeSessionCount: currentMembership.isOrgAdmin && freshMfa
          ? Number(sessionSummary?.active_session_count ?? 0n)
          : null,
        lastSessionSeenAt: sessionSummary?.last_seen_at?.toISOString() ?? null,
      }); })),
    });
  }

  private hasFreshMfa(user: RequestUser): boolean {
    const verifiedAt = Date.parse(String(user.mfaVerifiedAt || ''));
    return Boolean(
      user.mfaVerified
      && Number.isFinite(verifiedAt)
      && verifiedAt <= Date.now() + 30_000
      && Date.now() - verifiedAt <= 15 * 60 * 1000,
    );
  }
}
