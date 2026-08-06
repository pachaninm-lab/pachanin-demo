import { Prisma, PrismaClient } from '@prisma/client';
import {
  StaffAccessRepository,
  type StaffSqlClient,
  type StaffTargetScopeRow,
} from './staff-access.repository';
import { StaffAuthorityPrismaService } from './staff-authority-prisma.service';

/**
 * Persistent staff grants/sessions remain on the isolated auth datasource.
 * Cross-tenant identity resolution is different: it must execute only through
 * the dedicated staff runtime principal, whose only database authority is the
 * bounded SECURITY DEFINER surface created by the identity-RLS migrations.
 */
export class StaffRuntimeAccessRepository extends StaffAccessRepository {
  constructor(
    prisma: PrismaClient,
    private readonly staffAuthorityPrisma: StaffAuthorityPrismaService,
  ) {
    super(prisma);
  }

  override async resolveTargetScope(
    _client: StaffSqlClient,
    input: {
      actorUserId: string;
      assignmentId: string;
      targetTenantId?: string | null;
      targetOrganizationId?: string | null;
      targetUserId?: string | null;
    },
  ): Promise<StaffTargetScopeRow | null> {
    const rows = await this.staffAuthorityPrisma.$queryRaw<StaffTargetScopeRow[]>(Prisma.sql`
      SELECT tenant_id, organization_id, user_id
      FROM auth.resolve_staff_target_scope(
        ${input.actorUserId},
        ${input.assignmentId},
        ${input.targetTenantId ?? null},
        ${input.targetOrganizationId ?? null},
        ${input.targetUserId ?? null}
      )
    `);
    return rows[0] ?? null;
  }
}
