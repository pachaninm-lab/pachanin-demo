from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected exactly one match, got {count}")
    p.write_text(text.replace(old, new, 1))


harness = "apps/api/test/industrial/harness.ts"
replace_once(
    harness,
    """      await tx.userOrg.create({
        data: { userId, organizationId: orgId, role, isDefault: true },
      });""",
    """      await tx.userOrg.create({
        data: {
          id: `membership-e2e-${slug}-${key}`,
          userId,
          organizationId: orgId,
          role,
          isDefault: true,
        },
      });""",
)
replace_once(
    harness,
    """      tenantId: INDUSTRIAL_TENANT,
      sessionId: `session-e2e-${slug}-${key}`,""",
    """      tenantId: INDUSTRIAL_TENANT,
      membershipId: `membership-e2e-${slug}-${key}`,
      sessionId: `session-e2e-${slug}-${key}`,""",
)

repository = "apps/api/src/modules/staff-access/staff-access.repository.ts"
replace_once(
    repository,
    "export type StaffAccessRequestRow = {",
    """export type StaffTargetScopeRow = {
  tenant_id: string | null;
  organization_id: string | null;
  user_id: string | null;
};

export type StaffAccessRequestRow = {""",
)
replace_once(
    repository,
    """  async listActiveAssignments(client: StaffSqlClient, userId: string, now = new Date()): Promise<StaffAssignmentRow[]> {""",
    """  async resolveTargetScope(
    client: StaffSqlClient,
    input: {
      actorUserId: string;
      assignmentId: string;
      targetTenantId?: string | null;
      targetOrganizationId?: string | null;
      targetUserId?: string | null;
    },
  ): Promise<StaffTargetScopeRow | null> {
    const rows = await client.$queryRaw<StaffTargetScopeRow[]>(Prisma.sql`
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

  async listActiveAssignments(client: StaffSqlClient, userId: string, now = new Date()): Promise<StaffAssignmentRow[]> {""",
)

service = "apps/api/src/modules/staff-access/staff-access.service.ts"
replace_once(
    service,
    "    const target = await this.validateTargetScope(input);",
    "    const target = await this.validateTargetScope(user, assignment.id, input);",
)
replace_once(
    service,
    """  private async validateTargetScope(input: RequestStaffAccessInput) {
    const customerMode = input.accessMode !== StaffAccessMode.CONTROL_PLANE;
    if (customerMode && !input.targetOrganizationId && !input.targetTenantId && !input.targetDealId) {
      throw new BadRequestException('Customer-context access must be scoped to a tenant, organization or deal');
    }
    let tenantId = input.targetTenantId || null;
    const organizationId = input.targetOrganizationId || null;
    const userId = input.targetUserId || null;
    if (organizationId) {
      const organization = await this.repository.prisma.organization.findUnique({
        where: { id: organizationId },
        select: { id: true, tenantId: true },
      });
      if (!organization) throw new NotFoundException('Target organization not found');
      if (tenantId && tenantId !== organization.tenantId) throw new ForbiddenException('Tenant and organization scope mismatch');
      tenantId = organization.tenantId;
    }
    if (userId) {
      if (!organizationId) throw new BadRequestException('Target user requires target organization');
      const membership = await this.repository.prisma.userOrg.findFirst({ where: { userId, organizationId }, select: { id: true } });
      if (!membership) throw new ForbiddenException('Target user is not a member of target organization');
    }
    return { tenantId, organizationId, userId };
  }""",
    """  private async validateTargetScope(
    user: RequestUser,
    assignmentId: string,
    input: RequestStaffAccessInput,
  ) {
    const customerMode = input.accessMode !== StaffAccessMode.CONTROL_PLANE;
    if (customerMode && !input.targetOrganizationId && !input.targetTenantId && !input.targetDealId) {
      throw new BadRequestException('Customer-context access must be scoped to a tenant, organization or deal');
    }
    if (input.targetUserId && !input.targetOrganizationId) {
      throw new BadRequestException('Target user requires target organization');
    }

    const target = await this.repository.resolveTargetScope(this.repository.prisma, {
      actorUserId: user.id,
      assignmentId,
      targetTenantId: input.targetTenantId ?? null,
      targetOrganizationId: input.targetOrganizationId ?? null,
      targetUserId: input.targetUserId ?? null,
    });
    if (!target) {
      throw new ForbiddenException('Target staff access scope could not be verified');
    }

    return {
      tenantId: target.tenant_id,
      organizationId: target.organization_id,
      userId: target.user_id,
    };
  }""",
)

one_deal = "scripts/platform-v7-one-deal-e2e.sh"
replace_once(
    one_deal,
    "GRANT EXECUTE ON FUNCTION auth.staff_resolve_deal_scope(TEXT, TEXT) TO one_deal_auth;",
    """GRANT EXECUTE ON FUNCTION auth.staff_resolve_deal_scope(TEXT, TEXT) TO one_deal_auth;
GRANT EXECUTE ON FUNCTION auth.resolve_staff_target_scope(TEXT, TEXT, TEXT, TEXT, TEXT) TO one_deal_auth;""",
)

dr = "scripts/platform-v7-database-dr-rehearsal.sh"
replace_once(
    dr,
    """    'auth.resolve_session_identity(text,text,text,text)',
    'auth.validate_deal_creation_actors""",
    """    'auth.resolve_session_identity(text,text,text,text)',
    'auth.resolve_staff_target_scope(text,text,text,text,text)',
    'auth.validate_deal_creation_actors""",
)
replace_once(
    dr,
    "    GRANT EXECUTE ON FUNCTION auth.resolve_session_identity(text,text,text,text) TO one_deal_auth;",
    """    GRANT EXECUTE ON FUNCTION auth.resolve_session_identity(text,text,text,text) TO one_deal_auth;
    GRANT EXECUTE ON FUNCTION auth.resolve_staff_target_scope(text,text,text,text,text) TO one_deal_auth;""",
)
replace_once(
    dr,
    """         'resolve_session_identity',
         'validate_deal_creation_actors'""",
    """         'resolve_session_identity', 'resolve_staff_target_scope',
         'validate_deal_creation_actors'""",
)
replace_once(dr, '"3:9:0:1:1:0:1:0"', '"3:10:0:1:1:0:1:0"')

for temporary_path in (
    ".github/workflows/identity-rls-source-fix-dispatch.yml",
    ".github/identity-rls-source-fix.trigger",
    "scripts/apply-identity-rls-source-fix.py",
):
    temporary = Path(temporary_path)
    if temporary.exists():
        temporary.unlink()
