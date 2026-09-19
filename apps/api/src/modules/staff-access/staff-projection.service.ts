import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RequestUser } from '../../common/types/request-user';
import { digestOpaqueAuthToken } from '../auth/opaque-token-authority';
import { StaffAccessService } from './staff-access.service';
import { StaffAccessContext, StaffPermission } from './staff-access.types';
import { StaffAuthorityPrismaService } from './staff-authority-prisma.service';

export type StaffOrganizationProjection = {
  id: string;
  tenant_id: string;
  name: string;
  inn: string;
  status: string;
  kyc_status: string;
  aml_status: string;
  updated_at: Date;
};

export type StaffOrganizationUserProjection = {
  membership_id: string;
  user_id: string;
  email: string;
  full_name: string;
  user_status: string;
  mfa_enabled: boolean;
  role: string;
  is_default: boolean;
  joined_at: Date;
};

export type StaffCabinetDealProjection = {
  id: string;
  deal_number: string | null;
  status: string;
  next_action: string | null;
  sla_at: Date | null;
  updated_at: Date;
};

@Injectable()
export class StaffProjectionService {
  constructor(
    private readonly staffAuthorityPrisma: StaffAuthorityPrismaService,
    private readonly access: StaffAccessService,
  ) {}

  async organizationDirectory(
    user: RequestUser,
    accessContext: StaffAccessContext,
    capabilityToken: string,
  ) {
    await this.access.requirePermission(user, StaffPermission.ORGANIZATION_LIST);
    const capabilityHash = this.capabilityHash(capabilityToken);
    return this.staffAuthorityPrisma.$queryRaw<StaffOrganizationProjection[]>(Prisma.sql`
      SELECT *
      FROM auth.staff_organization_directory(
        ${user.id},
        ${accessContext.accessSessionId},
        ${capabilityHash}
      )
    `);
  }

  async organizationUsers(
    user: RequestUser,
    accessContext: StaffAccessContext,
    capabilityToken: string,
    organizationId: string,
  ) {
    await this.access.requirePermission(user, StaffPermission.USER_LIST);
    const capabilityHash = this.capabilityHash(capabilityToken);
    return this.staffAuthorityPrisma.$queryRaw<StaffOrganizationUserProjection[]>(Prisma.sql`
      SELECT *
      FROM auth.staff_organization_users(
        ${user.id},
        ${accessContext.accessSessionId},
        ${capabilityHash},
        ${organizationId}
      )
    `);
  }

  async cabinetProjection(
    user: RequestUser,
    accessContext: StaffAccessContext,
    capabilityToken: string,
    organizationId: string,
    role: string,
  ) {
    await this.access.requirePermission(user, StaffPermission.CABINET_VIEW_AS);
    const capabilityHash = this.capabilityHash(capabilityToken);
    const deals = await this.staffAuthorityPrisma.$queryRaw<StaffCabinetDealProjection[]>(Prisma.sql`
      SELECT *
      FROM auth.staff_cabinet_deals(
        ${user.id},
        ${accessContext.accessSessionId},
        ${capabilityHash},
        ${organizationId},
        ${role}
      )
    `);
    return {
      mode: 'READ_ONLY_VIEW_AS' as const,
      actorUserId: user.id,
      actorStaffRole: accessContext.staffRole,
      accessSessionId: accessContext.accessSessionId,
      effectiveTenantId: accessContext.effectiveTenantId,
      effectiveOrganizationId: organizationId,
      effectiveRole: role,
      expiresAt: accessContext.expiresAt.toISOString(),
      deals,
    };
  }

  private capabilityHash(capabilityToken: string): string {
    const token = String(capabilityToken ?? '').trim();
    if (!token) throw new UnauthorizedException('Staff access capability is required');
    return digestOpaqueAuthToken({ purpose: 'staff-access', rawToken: token });
  }
}
