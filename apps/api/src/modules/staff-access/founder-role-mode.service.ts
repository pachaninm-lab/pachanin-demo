import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { RequestUser } from '../../common/types/request-user';
import { StaffAccessRepository } from './staff-access.repository';
import { StaffAccessService } from './staff-access.service';
import {
  StaffAccessContext,
  StaffAccessMode,
  StaffPermission,
} from './staff-access.types';
import {
  FOUNDER_ROLE_MODE_CABINETS,
  FOUNDER_ROLE_MODE_DEFAULT_DURATION_SECONDS,
  FOUNDER_ROLE_MODE_MAX_DURATION_SECONDS,
  FOUNDER_ROLE_MODE_RESTRICTIONS,
  FOUNDER_ROLE_MODE_RETURN_PATH,
  FOUNDER_ROLE_MODE_SCHEMA,
  founderRoleModeCabinetByEffectiveRole,
  founderRoleModeCabinetByKey,
} from './founder-role-mode.contract';

const CONTROLLED_TEST_TENANT_ID = 'tenant-canonical-test';
const CONTROLLED_TEST_ORGANIZATION_PREFIX = 'org-canonical-';

const FOUNDER_VIEW_AS_PERMISSIONS = [
  StaffPermission.CABINET_VIEW_AS,
  StaffPermission.DEAL_READ,
  StaffPermission.DOCUMENT_METADATA_READ,
] as const;

export type RequestFounderRoleModeInput = Readonly<{
  cabinetKey: string;
  organizationId: string;
  reason: string;
  ticketId: string;
  durationSeconds?: number;
}>;

function controlledTestTarget(tenantId: string | null, organizationId: string | null): boolean {
  return tenantId === CONTROLLED_TEST_TENANT_ID
    || String(organizationId || '').startsWith(CONTROLLED_TEST_ORGANIZATION_PREFIX);
}

@Injectable()
export class FounderRoleModeService {
  constructor(
    private readonly access: StaffAccessService,
    private readonly repository: StaffAccessRepository,
  ) {}

  async registry(user: RequestUser) {
    await this.access.requireActivePlatformOwner(user);
    return {
      schemaVersion: FOUNDER_ROLE_MODE_SCHEMA,
      mode: StaffAccessMode.VIEW_AS,
      readOnly: true,
      returnPath: FOUNDER_ROLE_MODE_RETURN_PATH,
      restrictions: [...FOUNDER_ROLE_MODE_RESTRICTIONS],
      cabinets: FOUNDER_ROLE_MODE_CABINETS.map((cabinet) => ({ ...cabinet })),
    };
  }

  async request(
    user: RequestUser,
    input: RequestFounderRoleModeInput,
    correlationId?: string,
  ) {
    const assignment = await this.access.requireActivePlatformOwner(user);
    const cabinet = founderRoleModeCabinetByKey(input.cabinetKey);
    if (!cabinet) throw new BadRequestException('Unknown founder role-mode cabinet');

    const organizationId = String(input.organizationId || '').trim();
    if (!organizationId || organizationId.length > 128) {
      throw new BadRequestException('A bounded organizationId is required');
    }

    // Resolve the target through the already restricted staff authority before
    // creating any grant. The client never supplies tenant or effective role.
    const target = await this.repository.resolveTargetScope(this.repository.prisma, {
      actorUserId: user.id,
      assignmentId: assignment.id,
      targetOrganizationId: organizationId,
    });
    if (
      !target
      || !target.tenant_id
      || !target.organization_id
      || target.organization_id !== organizationId
    ) {
      throw new ForbiddenException('Founder role-mode target scope could not be verified');
    }
    if (controlledTestTarget(target.tenant_id, target.organization_id)) {
      throw new ForbiddenException('Controlled test targets are not R1 production role-mode authority');
    }

    const durationSeconds = input.durationSeconds ?? FOUNDER_ROLE_MODE_DEFAULT_DURATION_SECONDS;
    if (
      !Number.isInteger(durationSeconds)
      || durationSeconds < 60
      || durationSeconds > FOUNDER_ROLE_MODE_MAX_DURATION_SECONDS
    ) {
      throw new BadRequestException('Founder role-mode duration must be between 60 and 3600 seconds');
    }

    const created = await this.access.requestAccess(user, {
      assignmentId: assignment.id,
      accessMode: StaffAccessMode.VIEW_AS,
      permissions: [...FOUNDER_VIEW_AS_PERMISSIONS],
      targetTenantId: target.tenant_id,
      targetOrganizationId: target.organization_id,
      targetRole: cabinet.effectiveRole,
      reason: input.reason,
      ticketId: input.ticketId,
      durationSeconds,
    }, correlationId);

    return {
      schemaVersion: FOUNDER_ROLE_MODE_SCHEMA,
      ...created,
      roleMode: {
        cabinetKey: cabinet.key,
        canonicalPath: cabinet.canonicalPath,
        effectiveRole: cabinet.effectiveRole,
        effectiveOrganizationId: target.organization_id,
        effectiveTenantId: target.tenant_id,
        mode: StaffAccessMode.VIEW_AS,
        readOnly: true,
        restrictions: [...FOUNDER_ROLE_MODE_RESTRICTIONS],
        returnPath: FOUNDER_ROLE_MODE_RETURN_PATH,
      },
    };
  }

  async session(user: RequestUser, context: StaffAccessContext) {
    await this.access.requireActivePlatformOwner(user);
    if (context.accessMode !== StaffAccessMode.VIEW_AS) {
      throw new ForbiddenException('Founder role-mode requires VIEW_AS');
    }
    if (!context.permissions.includes(StaffPermission.CABINET_VIEW_AS)) {
      throw new ForbiddenException('Founder role-mode session lacks cabinet:view-as');
    }
    const allowed = new Set<string>(FOUNDER_VIEW_AS_PERMISSIONS);
    if (context.permissions.some((permission) => !allowed.has(permission))) {
      throw new ForbiddenException('Founder role-mode session contains non-canonical permissions');
    }

    const cabinet = founderRoleModeCabinetByEffectiveRole(context.effectiveRole);
    if (!cabinet || !context.effectiveOrganizationId || !context.effectiveTenantId) {
      throw new ForbiddenException('Founder role-mode session scope is incomplete');
    }
    if (controlledTestTarget(context.effectiveTenantId, context.effectiveOrganizationId)) {
      throw new ForbiddenException('Controlled test targets are not R1 production role-mode authority');
    }

    const displayName = String(user.fullName || '').trim().slice(0, 160) || 'Platform owner';
    return {
      schemaVersion: FOUNDER_ROLE_MODE_SCHEMA,
      active: true,
      actor: { displayName },
      cabinetKey: cabinet.key,
      canonicalPath: cabinet.canonicalPath,
      effectiveRole: cabinet.effectiveRole,
      effectiveOrganizationId: context.effectiveOrganizationId,
      effectiveTenantId: context.effectiveTenantId,
      mode: StaffAccessMode.VIEW_AS,
      readOnly: true,
      restrictions: [...FOUNDER_ROLE_MODE_RESTRICTIONS],
      expiresAt: context.expiresAt.toISOString(),
      ticketId: context.ticketId,
      mfaRequired: true,
      returnPath: FOUNDER_ROLE_MODE_RETURN_PATH,
    };
  }
}
