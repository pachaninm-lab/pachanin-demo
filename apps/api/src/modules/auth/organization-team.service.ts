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

type OrganizationTeamRow = Readonly<{
  actor_role: string;
  actor_is_org_admin: boolean;
  actor_has_fresh_mfa: boolean;
  organization_name: string;
  membership_id: string;
  member_user_id: string;
  full_name: string;
  email: string;
  member_role: string;
  user_status: string;
  membership_status: string;
  member_is_org_admin: boolean;
  membership_version: bigint;
  is_default: boolean;
  joined_at: Date;
  active_session_count: bigint | null;
  last_session_seen_at: Date | null;
}>;

@Injectable()
export class OrganizationTeamService {
  constructor(private readonly prisma: AuthPrismaService) {}

  async readFor(user: RequestUser): Promise<OrganizationTeamSnapshot> {
    const tenantId = String(user.tenantId ?? '').trim();
    const organizationId = String(user.orgId ?? '').trim();
    const membershipId = String(user.membershipId ?? '').trim();
    const userId = String(user.id ?? '').trim();
    const sessionId = String(user.sessionId ?? '').trim();
    if (!tenantId || !organizationId || !membershipId || !userId || !sessionId) {
      throw new ForbiddenException('Active tenant membership is required.');
    }

    const rows = await this.prisma.$queryRaw<OrganizationTeamRow[]>(Prisma.sql`
      SELECT
        actor_role, actor_is_org_admin, actor_has_fresh_mfa, organization_name,
        membership_id, member_user_id, full_name, email, member_role,
        user_status, membership_status, member_is_org_admin, membership_version,
        is_default, joined_at, active_session_count, last_session_seen_at
      FROM auth.organization_team_snapshot(
        ${sessionId}, ${userId}, ${membershipId}, ${organizationId}, ${tenantId}
      )
    `);
    const actor = rows[0];
    if (!actor) {
      throw new ForbiddenException('Membership does not belong to the active tenant session.');
    }

    return Object.freeze({
      organizationId,
      tenantId,
      currentMembershipId: membershipId,
      organizationName: actor.organization_name,
      currentRole: actor.actor_role,
      isOrganizationAdmin: actor.actor_is_org_admin,
      hasFreshMfa: actor.actor_has_fresh_mfa,
      members: Object.freeze(rows.map((membership) => Object.freeze({
        membershipId: membership.membership_id,
        userId: membership.member_user_id,
        fullName: membership.full_name,
        email: membership.email,
        role: membership.member_role,
        userStatus: membership.user_status,
        membershipStatus: membership.membership_status,
        isOrgAdmin: membership.member_is_org_admin,
        version: membership.membership_version.toString(),
        isDefault: membership.is_default,
        joinedAt: membership.joined_at.toISOString(),
        current: membership.membership_id === membershipId,
        activeSessionCount: membership.active_session_count === null
          ? null
          : Number(membership.active_session_count),
        lastSessionSeenAt: membership.last_session_seen_at?.toISOString() ?? null,
      }))),
    });
  }
}
