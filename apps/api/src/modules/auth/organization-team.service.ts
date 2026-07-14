import { ForbiddenException, Injectable } from '@nestjs/common';
import { RequestUser } from '../../common/types/request-user';
import { AuthPrismaService } from './auth-prisma.service';

export type OrganizationTeamMember = Readonly<{
  membershipId: string;
  userId: string;
  fullName: string;
  email: string;
  role: string;
  userStatus: string;
  isDefault: boolean;
  joinedAt: string;
  current: boolean;
}>;

export type OrganizationTeamSnapshot = Readonly<{
  organizationId: string;
  tenantId: string;
  currentMembershipId: string;
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
        organization: { tenantId },
        user: { deletedAt: null },
      },
      select: { id: true },
    });
    if (!currentMembership) {
      throw new ForbiddenException('Membership does not belong to the active tenant session.');
    }

    const memberships = await this.prisma.userOrg.findMany({
      where: {
        organizationId,
        organization: { tenantId },
        user: { deletedAt: null },
      },
      orderBy: [{ joinedAt: 'asc' }, { id: 'asc' }],
      take: 100,
      select: {
        id: true,
        role: true,
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

    return Object.freeze({
      organizationId,
      tenantId,
      currentMembershipId: membershipId,
      members: Object.freeze(memberships.map((membership) => Object.freeze({
        membershipId: membership.id,
        userId: membership.user.id,
        fullName: membership.user.fullName,
        email: membership.user.email,
        role: membership.role,
        userStatus: membership.user.status,
        isDefault: membership.isDefault,
        joinedAt: membership.joinedAt.toISOString(),
        current: membership.id === membershipId,
      }))),
    });
  }
}
