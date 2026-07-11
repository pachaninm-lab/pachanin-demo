import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomBytes, randomUUID } from 'crypto';
import { RequestUser } from '../../common/types/request-user';
import {
  hashAuthMaterial,
  hashClientValue,
  sha256,
  stableJson,
} from '../auth/auth-crypto';
import {
  CriticalActionRow,
  StaffAccessRepository,
  StaffAccessRequestRow,
  StaffGrantRow,
  StaffSessionRow,
} from './staff-access.repository';
import {
  FORBIDDEN_STAFF_ACTIONS,
  isStaffAccessMode,
  isStaffPermission,
  isStaffRole,
  MODE_MAX_DURATION_SECONDS,
  MODES_REQUIRING_APPROVAL,
  ROLE_PERMISSION_CEILING,
  StaffAccessContext,
  StaffAccessMode,
  StaffPermission,
  StaffRole,
} from './staff-access.types';

const STAFF_MFA_FRESHNESS_MS = 15 * 60 * 1000;
const REQUEST_TTL_MS = 30 * 60 * 1000;
const CRITICAL_ACTION_TTL_MS = 10 * 60 * 1000;
const READ_ONLY_SUFFIXES = [':read', ':list', ':view-as', ':export'];

const ROLE_ALLOWED_MODES: Readonly<Record<StaffRole, readonly StaffAccessMode[]>> = {
  PLATFORM_OWNER: Object.values(StaffAccessMode),
  PLATFORM_ADMIN: [StaffAccessMode.CONTROL_PLANE, StaffAccessMode.VIEW_AS, StaffAccessMode.ASSISTED, StaffAccessMode.JIT_PRIVILEGED],
  SUPPORT_L1: [StaffAccessMode.CONTROL_PLANE],
  SUPPORT_L2: [StaffAccessMode.CONTROL_PLANE, StaffAccessMode.VIEW_AS, StaffAccessMode.ASSISTED],
  OPERATIONS_AGENT: [StaffAccessMode.CONTROL_PLANE, StaffAccessMode.VIEW_AS, StaffAccessMode.OPERATIONS],
  OPERATIONS_SUPERVISOR: [StaffAccessMode.CONTROL_PLANE, StaffAccessMode.VIEW_AS, StaffAccessMode.OPERATIONS, StaffAccessMode.JIT_PRIVILEGED],
  FINANCE_OPS: [StaffAccessMode.CONTROL_PLANE, StaffAccessMode.JIT_PRIVILEGED],
  COMPLIANCE_STAFF: [StaffAccessMode.CONTROL_PLANE, StaffAccessMode.VIEW_AS, StaffAccessMode.JIT_PRIVILEGED],
  DEVELOPER: [StaffAccessMode.CONTROL_PLANE, StaffAccessMode.JIT_PRIVILEGED],
  SRE_ONCALL: [StaffAccessMode.CONTROL_PLANE, StaffAccessMode.JIT_PRIVILEGED, StaffAccessMode.BREAK_GLASS],
  SECURITY_AUDITOR: [StaffAccessMode.CONTROL_PLANE, StaffAccessMode.VIEW_AS],
  BREAK_GLASS_ADMIN: [StaffAccessMode.CONTROL_PLANE, StaffAccessMode.BREAK_GLASS],
};

export type RequestStaffAccessInput = {
  assignmentId: string;
  accessMode: StaffAccessMode;
  permissions: StaffPermission[];
  targetTenantId?: string;
  targetOrganizationId?: string;
  targetUserId?: string;
  targetRole?: string;
  targetDealId?: string;
  reason: string;
  ticketId: string;
  durationSeconds: number;
};

export type StaffRequestDecisionInput = {
  decision: 'APPROVE' | 'DENY';
  reason: string;
};

@Injectable()
export class StaffAccessService {
  constructor(private readonly repository: StaffAccessRepository) {}

  async enrichActor(user: RequestUser): Promise<RequestUser> {
    const assignments = await this.repository.listActiveAssignments(this.repository.prisma, user.id);
    return {
      ...user,
      staffRoles: assignments.map((assignment) => assignment.role).filter(isStaffRole),
      staffAssignmentIds: assignments.map((assignment) => assignment.id),
    };
  }

  async listMyAssignments(user: RequestUser) {
    return this.repository.listActiveAssignments(this.repository.prisma, user.id);
  }

  async listRequests(user: RequestUser) {
    const roles = await this.requireAssignments(user);
    const canReadAll = roles.some(({ role }) => [
      StaffRole.PLATFORM_OWNER,
      StaffRole.PLATFORM_ADMIN,
      StaffRole.OPERATIONS_SUPERVISOR,
      StaffRole.COMPLIANCE_STAFF,
      StaffRole.SECURITY_AUDITOR,
    ].includes(role));
    return this.repository.listAccessRequests(this.repository.prisma, user.id, canReadAll);
  }

  async requestAccess(user: RequestUser, input: RequestStaffAccessInput, correlationId = randomUUID()) {
    this.assertRecentMfa(user);
    if (!isStaffAccessMode(input.accessMode)) throw new BadRequestException('Unknown staff access mode');
    const assignment = await this.repository.getAssignment(this.repository.prisma, input.assignmentId, user.id);
    if (!assignment || !isStaffRole(assignment.role)) throw new ForbiddenException('Active staff assignment is required');
    this.assertAssignmentActive(assignment);
    const role = assignment.role;
    if (!ROLE_ALLOWED_MODES[role].includes(input.accessMode)) {
      throw new ForbiddenException(`${role} cannot request ${input.accessMode}`);
    }

    const permissions = this.normalizePermissions(input.permissions);
    this.assertPermissionCeiling(role, permissions);
    this.assertModePermissions(input.accessMode, permissions);
    const target = await this.validateTargetScope(input);
    const maxDuration = MODE_MAX_DURATION_SECONDS[input.accessMode];
    if (!Number.isInteger(input.durationSeconds) || input.durationSeconds < 60 || input.durationSeconds > maxDuration) {
      throw new BadRequestException(`Duration must be between 60 and ${maxDuration} seconds`);
    }
    const reason = this.requireText(input.reason, 'reason', input.accessMode === StaffAccessMode.BREAK_GLASS ? 20 : 10);
    const ticketId = this.requireText(input.ticketId, 'ticketId', 3);
    const requestId = `sar_${randomUUID()}`;
    const now = new Date();
    const requestExpiry = new Date(now.getTime() + REQUEST_TTL_MS);
    const autoApprove = this.canAutoApprove(role, input.accessMode);

    const result = await this.repository.transaction(async (tx) => {
      await this.repository.createAccessRequest(tx, {
        id: requestId,
        requesterUserId: user.id,
        assignmentId: assignment.id,
        accessMode: input.accessMode,
        targetTenantId: target.tenantId,
        targetOrganizationId: target.organizationId,
        targetUserId: target.userId,
        targetRole: input.targetRole || null,
        targetDealId: input.targetDealId || null,
        permissions,
        reason,
        ticketId,
        maxDurationSeconds: input.durationSeconds,
        expiresAt: requestExpiry,
      });

      let grant: { id: string; expiresAt: Date } | null = null;
      if (autoApprove) {
        const request = await this.requireRequest(tx, requestId, true);
        const changed = await this.repository.markRequest(tx, {
          id: request.id,
          expectedVersion: request.version,
          status: 'APPROVED',
          actorUserId: user.id,
          reason: 'AUTO_APPROVED_OWNER_READ_ONLY',
        });
        if (!changed) throw new ConflictException('Access request changed concurrently');
        grant = await this.createGrant(tx, { ...request, version: request.version + 1 }, now);
      }

      await this.audit(tx, {
        actor: user,
        staffRole: role,
        action: 'staff.access.request',
        outcome: 'SUCCESS',
        reason,
        ticketId,
        correlationId,
        metadata: {
          requestId,
          accessMode: input.accessMode,
          permissions,
          autoApproved: autoApprove,
          target,
        },
      });
      return grant;
    });

    return {
      requestId,
      status: autoApprove ? 'GRANTED' : 'PENDING',
      grantId: result?.id ?? null,
      expiresAt: result?.expiresAt.toISOString() ?? requestExpiry.toISOString(),
    };
  }

  async decideRequest(user: RequestUser, requestId: string, input: StaffRequestDecisionInput, correlationId = randomUUID()) {
    this.assertRecentMfa(user);
    const approverRole = await this.requirePermission(user, StaffPermission.STAFF_REQUEST_APPROVE);
    const reason = this.requireText(input.reason, 'reason', 5);
    if (!['APPROVE', 'DENY'].includes(input.decision)) throw new BadRequestException('Unknown decision');

    return this.repository.transaction(async (tx) => {
      const request = await this.requireRequest(tx, requestId, true);
      this.assertPendingRequest(request);
      if (request.requester_user_id === user.id) throw new ForbiddenException('Requester cannot approve their own access');
      await this.repository.insertApproval(tx, {
        id: `saa_${randomUUID()}`,
        requestId,
        approverUserId: user.id,
        decision: input.decision,
        reason,
      });

      if (input.decision === 'DENY') {
        const changed = await this.repository.markRequest(tx, {
          id: request.id,
          expectedVersion: request.version,
          status: 'DENIED',
          actorUserId: user.id,
          reason,
        });
        if (!changed) throw new ConflictException('Access request changed concurrently');
        await this.audit(tx, {
          actor: user,
          staffRole: approverRole,
          action: 'staff.access.deny',
          outcome: 'SUCCESS',
          reason,
          ticketId: request.ticket_id,
          correlationId,
          metadata: { requestId },
        });
        return { requestId, status: 'DENIED' };
      }

      const approvalCount = await this.repository.countApprovals(tx, requestId);
      const requiredApprovals = request.access_mode === StaffAccessMode.JIT_PRIVILEGED ? 2 : 1;
      if (approvalCount < requiredApprovals) {
        await this.audit(tx, {
          actor: user,
          staffRole: approverRole,
          action: 'staff.access.approve.partial',
          outcome: 'SUCCESS',
          reason,
          ticketId: request.ticket_id,
          correlationId,
          metadata: { requestId, approvalCount, requiredApprovals },
        });
        return { requestId, status: 'PENDING', approvalCount, requiredApprovals };
      }

      const changed = await this.repository.markRequest(tx, {
        id: request.id,
        expectedVersion: request.version,
        status: 'APPROVED',
        actorUserId: user.id,
        reason,
      });
      if (!changed) throw new ConflictException('Access request changed concurrently');
      const grant = await this.createGrant(tx, { ...request, version: request.version + 1 }, new Date());
      await this.audit(tx, {
        actor: user,
        staffRole: approverRole,
        action: 'staff.access.approve',
        outcome: 'SUCCESS',
        reason,
        ticketId: request.ticket_id,
        correlationId,
        metadata: { requestId, grantId: grant.id, approvalCount },
      });
      return { requestId, status: 'GRANTED', grantId: grant.id, expiresAt: grant.expiresAt.toISOString() };
    });
  }

  async activateGrant(user: RequestUser, grantId: string, userAgent?: string, ip?: string, correlationId = randomUUID()) {
    this.assertRecentMfa(user);
    const token = this.makeAccessToken();
    return this.repository.transaction(async (tx) => {
      const grant = await this.repository.getGrant(tx, grantId, user.id, true);
      if (!grant || !isStaffRole(grant.staff_role)) throw new NotFoundException('Staff grant not found');
      this.assertGrantActive(grant);
      const existing = await this.repository.listActiveSessions(tx, user.id);
      if (existing.some((session) => session.grant_id === grant.id)) {
        throw new ConflictException('Grant already has an active session');
      }
      const sessionId = `sas_${randomUUID()}`;
      await this.repository.createAccessSession(tx, {
        id: sessionId,
        grant,
        tokenHash: token.hash,
        mfaLevel: 'TOTP',
        ipHash: hashClientValue(ip),
        userAgentHash: hashClientValue(userAgent),
      });
      await this.audit(tx, {
        actor: user,
        staffRole: grant.staff_role,
        accessSessionId: sessionId,
        grantId: grant.id,
        action: 'staff.session.activate',
        outcome: 'SUCCESS',
        reason: grant.reason,
        ticketId: grant.ticket_id,
        correlationId,
        metadata: { accessMode: grant.access_mode, expiresAt: grant.expires_at.toISOString() },
      });
      return {
        accessSessionId: sessionId,
        accessToken: token.token,
        expiresAt: grant.expires_at.toISOString(),
        accessMode: grant.access_mode,
        permissions: this.permissions(grant.permissions),
      };
    });
  }

  async resolveAccessSession(user: RequestUser, token: string): Promise<StaffAccessContext> {
    const tokenHash = hashAuthMaterial(String(token ?? ''));
    const session = await this.repository.getAccessSessionByHash(this.repository.prisma, tokenHash, user.id);
    if (!session || !isStaffRole(session.staff_role) || !isStaffAccessMode(session.access_mode)) {
      throw new UnauthorizedException('Invalid staff access session');
    }
    if (session.status !== 'ACTIVE' || session.expires_at <= new Date()) {
      throw new UnauthorizedException('Staff access session is not active');
    }
    await this.repository.touchAccessSession(this.repository.prisma, session.id);
    return this.toContext(session);
  }

  async endSession(user: RequestUser, sessionId: string, reason = 'STAFF_ENDED', correlationId = randomUUID()) {
    const roles = await this.requireAssignments(user);
    const own = await this.repository.listActiveSessions(this.repository.prisma, user.id);
    const canRevokeAny = roles.some(({ role }) => ROLE_PERMISSION_CEILING[role].includes(StaffPermission.STAFF_SESSION_REVOKE));
    const target = canRevokeAny
      ? (await this.repository.listActiveSessions(this.repository.prisma)).find((session) => session.id === sessionId)
      : own.find((session) => session.id === sessionId);
    if (!target || !isStaffRole(target.staff_role)) throw new NotFoundException('Active staff session not found');
    const ended = await this.repository.endAccessSession(this.repository.prisma, sessionId, target.actor_user_id, reason);
    if (!ended) throw new ConflictException('Staff session is no longer active');
    await this.repository.transaction((tx) => this.audit(tx, {
      actor: user,
      staffRole: roles[0].role,
      accessSessionId: sessionId,
      grantId: target.grant_id,
      action: 'staff.session.end',
      outcome: 'SUCCESS',
      reason,
      ticketId: target.ticket_id,
      correlationId,
    }));
    return { success: true, sessionId };
  }

  async listActiveSessions(user: RequestUser) {
    const roles = await this.requireAssignments(user);
    const canReadAll = roles.some(({ role }) => ROLE_PERMISSION_CEILING[role].includes(StaffPermission.STAFF_SESSION_READ));
    return this.repository.listActiveSessions(this.repository.prisma, canReadAll ? undefined : user.id);
  }

  async activateBreakGlass(user: RequestUser, input: { assignmentId: string; reason: string; ticketId: string }, correlationId = randomUUID()) {
    this.assertRecentMfa(user);
    const assignment = await this.repository.getAssignment(this.repository.prisma, input.assignmentId, user.id);
    if (!assignment || !isStaffRole(assignment.role)) throw new ForbiddenException('Break-glass assignment is required');
    if (![StaffRole.SRE_ONCALL, StaffRole.BREAK_GLASS_ADMIN, StaffRole.PLATFORM_OWNER].includes(assignment.role)) {
      throw new ForbiddenException('Role cannot activate break-glass access');
    }
    const reason = this.requireText(input.reason, 'reason', 20);
    const ticketId = this.requireText(input.ticketId, 'ticketId', 3);
    const activationId = `bga_${randomUUID()}`;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await this.repository.transaction(async (tx) => {
      await this.repository.createBreakGlass(tx, {
        id: activationId,
        actorUserId: user.id,
        assignmentId: assignment.id,
        reason,
        ticketId,
        expiresAt,
        correlationId,
      });
      await this.audit(tx, {
        actor: user,
        staffRole: assignment.role,
        action: 'staff.break-glass.activate',
        outcome: 'SUCCESS',
        reason,
        ticketId,
        correlationId,
        metadata: { activationId, expiresAt: expiresAt.toISOString(), notificationRequired: true },
      });
    });
    return { activationId, expiresAt: expiresAt.toISOString(), notificationRequired: true };
  }

  async requestCriticalAction(user: RequestUser, access: StaffAccessContext, input: {
    action: string;
    resourceType: string;
    resourceId: string;
    payload: unknown;
  }, correlationId = randomUUID()) {
    this.assertRecentMfa(user);
    if (!access.permissions.includes(StaffPermission.CRITICAL_ACTION_REQUEST)) {
      throw new ForbiddenException('Grant cannot request critical actions');
    }
    if (FORBIDDEN_STAFF_ACTIONS.has(input.action)) {
      throw new ForbiddenException('This action must be performed by the authoritative business actor or verified external callback');
    }
    const id = `scar_${randomUUID()}`;
    const payloadHash = sha256(stableJson(input.payload));
    const expiresAt = new Date(Date.now() + CRITICAL_ACTION_TTL_MS);
    await this.repository.transaction(async (tx) => {
      await this.repository.createCriticalAction(tx, {
        id,
        requesterUserId: user.id,
        accessSessionId: access.accessSessionId,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        targetTenantId: access.effectiveTenantId,
        targetOrganizationId: access.effectiveOrganizationId,
        payloadHash,
        requiredApprovals: 2,
        expiresAt,
      });
      await this.audit(tx, {
        actor: user,
        staffRole: access.staffRole,
        accessSessionId: access.accessSessionId,
        grantId: access.grantId,
        action: 'staff.critical.request',
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        outcome: 'SUCCESS',
        reason: access.reason,
        ticketId: access.ticketId,
        correlationId,
        metadata: { criticalRequestId: id, requestedAction: input.action, payloadHash },
      });
    });
    return { criticalRequestId: id, payloadHash, requiredApprovals: 2, expiresAt: expiresAt.toISOString() };
  }

  async approveCriticalAction(user: RequestUser, requestId: string, input: { decision: 'APPROVE' | 'DENY'; reason: string }, correlationId = randomUUID()) {
    this.assertRecentMfa(user);
    const role = await this.requirePermission(user, StaffPermission.CRITICAL_ACTION_APPROVE);
    const reason = this.requireText(input.reason, 'reason', 5);
    return this.repository.transaction(async (tx) => {
      const request = await this.requireCriticalRequest(tx, requestId, true);
      if (request.status !== 'PENDING' || request.expires_at <= new Date()) throw new ConflictException('Critical request is not pending');
      if (request.requester_user_id === user.id) throw new ForbiddenException('Requester cannot approve their own critical action');
      await this.repository.insertCriticalApproval(tx, {
        id: `scaa_${randomUUID()}`,
        requestId,
        approverUserId: user.id,
        decision: input.decision,
        reason,
      });
      if (input.decision === 'DENY') {
        await this.repository.markCriticalAction(tx, requestId, 'DENIED');
        await this.auditCritical(tx, user, role, request, 'staff.critical.deny', reason, correlationId);
        return { requestId, status: 'DENIED' };
      }
      const approvals = await this.repository.countCriticalApprovals(tx, requestId);
      if (approvals >= request.required_approvals) await this.repository.markCriticalAction(tx, requestId, 'APPROVED');
      await this.auditCritical(tx, user, role, request, 'staff.critical.approve', reason, correlationId, { approvals });
      return { requestId, status: approvals >= request.required_approvals ? 'APPROVED' : 'PENDING', approvals, requiredApprovals: request.required_approvals };
    });
  }

  async consumeCriticalAction(user: RequestUser, access: StaffAccessContext, requestId: string, payload: unknown, correlationId = randomUUID()) {
    const request = await this.repository.getCriticalAction(this.repository.prisma, requestId, true);
    if (!request || request.requester_user_id !== user.id || request.access_session_id !== access.accessSessionId) {
      throw new NotFoundException('Critical action approval not found');
    }
    if (request.status !== 'APPROVED' || request.expires_at <= new Date()) throw new ConflictException('Critical action approval is not active');
    const payloadHash = sha256(stableJson(payload));
    if (payloadHash !== request.payload_hash) throw new ForbiddenException('Critical action payload changed after approval');
    const consumed = await this.repository.markCriticalAction(this.repository.prisma, request.id, 'CONSUMED', true);
    if (!consumed) throw new ConflictException('Critical action approval was already consumed');
    await this.repository.transaction((tx) => this.auditCritical(tx, user, access.staffRole, request, 'staff.critical.consume', access.reason, correlationId));
    return { success: true, requestId, action: request.action, payloadHash };
  }

  async organizationDirectory(user: RequestUser) {
    await this.requirePermission(user, StaffPermission.ORGANIZATION_LIST);
    return this.repository.prisma.organization.findMany({
      select: { id: true, tenantId: true, name: true, inn: true, status: true, kycStatus: true, amlStatus: true, updatedAt: true },
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
      take: 500,
    });
  }

  async organizationUsers(user: RequestUser, organizationId: string) {
    await this.requirePermission(user, StaffPermission.USER_LIST);
    return this.repository.prisma.userOrg.findMany({
      where: { organizationId },
      select: {
        id: true,
        role: true,
        isDefault: true,
        joinedAt: true,
        user: { select: { id: true, email: true, fullName: true, status: true, mfaEnabled: true } },
      },
      orderBy: { joinedAt: 'asc' },
      take: 500,
    });
  }

  async cabinetProjection(user: RequestUser, organizationId: string, role: string) {
    const staffRole = await this.requirePermission(user, StaffPermission.CABINET_VIEW_AS);
    const organization = await this.repository.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, tenantId: true, name: true, status: true, kycStatus: true, amlStatus: true },
    });
    if (!organization) throw new NotFoundException('Organization not found');
    const members = await this.repository.prisma.userOrg.count({ where: { organizationId, role } });
    const deals = await this.repository.prisma.deal.findMany({
      where: {
        OR: [{ sellerOrgId: organizationId }, { buyerOrgId: organizationId }],
      },
      select: { id: true, dealNumber: true, status: true, nextAction: true, slaAt: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
    return {
      mode: 'READ_ONLY_VIEW_AS',
      actorUserId: user.id,
      actorStaffRole: staffRole,
      effectiveOrganization: organization,
      effectiveRole: role,
      roleMembers: members,
      deals,
      prohibitedActions: [...FORBIDDEN_STAFF_ACTIONS],
    };
  }

  async requirePermission(user: RequestUser, permission: StaffPermission): Promise<StaffRole> {
    const assignments = await this.requireAssignments(user);
    const assignment = assignments.find(({ role }) => ROLE_PERMISSION_CEILING[role].includes(permission));
    if (!assignment) throw new ForbiddenException(`Missing staff permission ${permission}`);
    return assignment.role;
  }

  private async requireAssignments(user: RequestUser) {
    const rows = await this.repository.listActiveAssignments(this.repository.prisma, user.id);
    const assignments = rows
      .filter((row): row is typeof row & { role: StaffRole } => isStaffRole(row.role))
      .map((row) => ({ ...row, role: row.role as StaffRole }));
    if (assignments.length === 0) throw new ForbiddenException('Active staff assignment is required');
    return assignments;
  }

  private assertRecentMfa(user: RequestUser) {
    if (!user.mfaVerified || !user.mfaVerifiedAt) throw new ForbiddenException('Staff access requires MFA');
    const age = Date.now() - new Date(user.mfaVerifiedAt).getTime();
    if (!Number.isFinite(age) || age < 0 || age > STAFF_MFA_FRESHNESS_MS) {
      throw new ForbiddenException('Staff access requires recent MFA verification');
    }
  }

  private assertAssignmentActive(assignment: { status: string; valid_from: Date; valid_until: Date | null }) {
    const now = new Date();
    if (!['ELIGIBLE', 'ACTIVE'].includes(assignment.status) || assignment.valid_from > now || (assignment.valid_until && assignment.valid_until <= now)) {
      throw new ForbiddenException('Staff assignment is not active');
    }
  }

  private normalizePermissions(values: unknown): StaffPermission[] {
    if (!Array.isArray(values) || values.length === 0) throw new BadRequestException('At least one permission is required');
    const permissions = [...new Set(values)].filter(isStaffPermission);
    if (permissions.length !== values.length) throw new BadRequestException('Unknown or duplicate staff permission');
    return permissions;
  }

  private assertPermissionCeiling(role: StaffRole, permissions: StaffPermission[]) {
    const ceiling = new Set(ROLE_PERMISSION_CEILING[role]);
    const denied = permissions.filter((permission) => !ceiling.has(permission));
    if (denied.length > 0) throw new ForbiddenException(`Permissions exceed ${role} ceiling: ${denied.join(', ')}`);
  }

  private assertModePermissions(mode: StaffAccessMode, permissions: StaffPermission[]) {
    if (mode === StaffAccessMode.VIEW_AS) {
      const writes = permissions.filter((permission) => !READ_ONLY_SUFFIXES.some((suffix) => permission.endsWith(suffix)) && permission !== StaffPermission.DOCUMENT_METADATA_READ);
      if (writes.length > 0) throw new ForbiddenException(`VIEW_AS is read-only: ${writes.join(', ')}`);
      if (!permissions.includes(StaffPermission.CABINET_VIEW_AS)) throw new BadRequestException('VIEW_AS requires cabinet:view-as');
    }
    if (mode === StaffAccessMode.BREAK_GLASS && permissions.some((permission) => permission.startsWith('payment:'))) {
      throw new ForbiddenException('Break-glass cannot grant payment authority');
    }
  }

  private async validateTargetScope(input: RequestStaffAccessInput) {
    const customerMode = input.accessMode !== StaffAccessMode.CONTROL_PLANE;
    if (customerMode && !input.targetOrganizationId && !input.targetTenantId && !input.targetDealId) {
      throw new BadRequestException('Customer-context access must be scoped to a tenant, organization or deal');
    }
    let tenantId = input.targetTenantId || null;
    let organizationId = input.targetOrganizationId || null;
    let userId = input.targetUserId || null;
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
  }

  private canAutoApprove(role: StaffRole, mode: StaffAccessMode) {
    return role === StaffRole.PLATFORM_OWNER && [StaffAccessMode.CONTROL_PLANE, StaffAccessMode.VIEW_AS].includes(mode);
  }

  private async createGrant(tx: Prisma.TransactionClient, request: StaffAccessRequestRow, now: Date) {
    const grantId = `sag_${randomUUID()}`;
    const expiresAt = new Date(now.getTime() + request.max_duration_seconds * 1000);
    await this.repository.createGrant(tx, { id: grantId, request, startsAt: now, expiresAt });
    const marked = await this.repository.markRequest(tx, {
      id: request.id,
      expectedVersion: request.version,
      status: 'GRANTED',
      reason: 'GRANT_CREATED',
    });
    if (!marked) throw new ConflictException('Access request changed while grant was created');
    return { id: grantId, expiresAt };
  }

  private makeAccessToken() {
    const id = `sat_${randomBytes(18).toString('base64url')}`;
    const secret = randomBytes(32).toString('base64url');
    const token = `${id}.${secret}`;
    return { token, hash: hashAuthMaterial(token) };
  }

  private assertGrantActive(grant: StaffGrantRow) {
    const now = new Date();
    if (grant.status !== 'ACTIVE' || grant.starts_at > now || grant.expires_at <= now) {
      throw new ConflictException('Staff grant is not active');
    }
  }

  private toContext(session: StaffSessionRow): StaffAccessContext {
    return {
      accessSessionId: session.id,
      grantId: session.grant_id,
      actorUserId: session.actor_user_id,
      staffRole: session.staff_role as StaffRole,
      accessMode: session.access_mode as StaffAccessMode,
      permissions: this.permissions(session.permissions),
      effectiveTenantId: session.effective_tenant_id,
      effectiveOrganizationId: session.effective_organization_id,
      effectiveUserId: session.effective_user_id,
      effectiveRole: session.effective_role,
      targetDealId: session.target_deal_id,
      reason: session.reason,
      ticketId: session.ticket_id,
      expiresAt: session.expires_at,
    };
  }

  private permissions(value: unknown): StaffPermission[] {
    return Array.isArray(value) ? value.filter(isStaffPermission) : [];
  }

  private async requireRequest(client: Parameters<StaffAccessRepository['getAccessRequest']>[0], id: string, forUpdate: boolean) {
    const request = await this.repository.getAccessRequest(client, id, forUpdate);
    if (!request) throw new NotFoundException('Staff access request not found');
    return request;
  }

  private assertPendingRequest(request: StaffAccessRequestRow) {
    if (request.status !== 'PENDING' || request.expires_at <= new Date()) {
      throw new ConflictException('Staff access request is not pending');
    }
  }

  private async requireCriticalRequest(client: Parameters<StaffAccessRepository['getCriticalAction']>[0], id: string, forUpdate: boolean) {
    const request = await this.repository.getCriticalAction(client, id, forUpdate);
    if (!request) throw new NotFoundException('Critical action request not found');
    return request;
  }

  private requireText(value: unknown, field: string, minLength: number) {
    const normalized = String(value ?? '').trim();
    if (normalized.length < minLength) throw new BadRequestException(`${field} must be at least ${minLength} characters`);
    return normalized.slice(0, 2000);
  }

  private async auditCritical(
    tx: Prisma.TransactionClient,
    actor: RequestUser,
    role: StaffRole,
    request: CriticalActionRow,
    action: string,
    reason: string,
    correlationId: string,
    metadata: Record<string, unknown> = {},
  ) {
    return this.audit(tx, {
      actor,
      staffRole: role,
      accessSessionId: request.access_session_id,
      action,
      resourceType: request.resource_type,
      resourceId: request.resource_id,
      outcome: 'SUCCESS',
      reason,
      correlationId,
      metadata: { criticalRequestId: request.id, requestedAction: request.action, ...metadata },
    });
  }

  private async audit(tx: Prisma.TransactionClient, input: {
    actor: RequestUser;
    staffRole: StaffRole;
    accessSessionId?: string | null;
    grantId?: string | null;
    action: string;
    resourceType?: string | null;
    resourceId?: string | null;
    outcome: 'SUCCESS' | 'FAILURE' | 'DENIED';
    reason?: string | null;
    ticketId?: string | null;
    correlationId: string;
    metadata?: Record<string, unknown>;
  }) {
    const prevHash = await this.repository.latestEventHash(tx, input.actor.id);
    const eventId = `sae_${randomUUID()}`;
    const payload = {
      id: eventId,
      actorUserId: input.actor.id,
      staffRole: input.staffRole,
      accessSessionId: input.accessSessionId ?? null,
      grantId: input.grantId ?? null,
      action: input.action,
      resourceType: input.resourceType ?? null,
      resourceId: input.resourceId ?? null,
      outcome: input.outcome,
      reason: input.reason ?? null,
      ticketId: input.ticketId ?? null,
      correlationId: input.correlationId,
      metadata: input.metadata ?? {},
      prevHash,
    };
    const hash = sha256(stableJson(payload));
    await this.repository.insertEvent(tx, {
      ...payload,
      effectiveTenantId: input.metadata?.targetTenantId as string | undefined,
      effectiveOrganizationId: input.metadata?.targetOrganizationId as string | undefined,
      effectiveUserId: input.metadata?.targetUserId as string | undefined,
      effectiveRole: input.metadata?.targetRole as string | undefined,
      accessMode: input.metadata?.accessMode as string | undefined,
      hash,
    });
  }
}
