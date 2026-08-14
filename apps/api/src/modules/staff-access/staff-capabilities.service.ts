import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RequestUser } from '../../common/types/request-user';
import {
  StaffAccessRepository,
  StaffAssignmentRow,
  StaffSessionRow,
} from './staff-access.repository';
import {
  isStaffRole,
  ROLE_PERMISSION_CEILING,
  StaffAccessMode,
  StaffPermission,
  StaffRole,
} from './staff-access.types';

const RECENT_MFA_MS = 15 * 60 * 1000;

export const StaffWorkspace = {
  EMPLOYEE: 'EMPLOYEE',
  MANAGER: 'MANAGER',
  OWNER: 'OWNER',
  COMMAND: 'COMMAND',
  PEOPLE: 'PEOPLE',
  PARTNERS: 'PARTNERS',
  OPERATIONS: 'OPERATIONS',
  SUPPORT: 'SUPPORT',
  FINANCE: 'FINANCE',
  RISK: 'RISK',
  PLATFORM: 'PLATFORM',
  GOVERNANCE: 'GOVERNANCE',
} as const;

export type StaffWorkspace = typeof StaffWorkspace[keyof typeof StaffWorkspace];

const ROLE_WORKSPACES: Readonly<Record<StaffRole, readonly StaffWorkspace[]>> = {
  PLATFORM_OWNER: [
    StaffWorkspace.EMPLOYEE,
    StaffWorkspace.OWNER,
    StaffWorkspace.COMMAND,
    StaffWorkspace.PEOPLE,
    StaffWorkspace.PARTNERS,
    StaffWorkspace.OPERATIONS,
    StaffWorkspace.SUPPORT,
    StaffWorkspace.FINANCE,
    StaffWorkspace.RISK,
    StaffWorkspace.PLATFORM,
    StaffWorkspace.GOVERNANCE,
  ],
  PLATFORM_ADMIN: [
    StaffWorkspace.EMPLOYEE,
    StaffWorkspace.COMMAND,
    StaffWorkspace.PEOPLE,
    StaffWorkspace.PARTNERS,
    StaffWorkspace.OPERATIONS,
    StaffWorkspace.SUPPORT,
    StaffWorkspace.PLATFORM,
    StaffWorkspace.GOVERNANCE,
  ],
  SUPPORT_L1: [StaffWorkspace.EMPLOYEE, StaffWorkspace.SUPPORT],
  SUPPORT_L2: [StaffWorkspace.EMPLOYEE, StaffWorkspace.SUPPORT],
  OPERATIONS_AGENT: [StaffWorkspace.EMPLOYEE, StaffWorkspace.OPERATIONS, StaffWorkspace.PARTNERS],
  OPERATIONS_SUPERVISOR: [
    StaffWorkspace.EMPLOYEE,
    StaffWorkspace.MANAGER,
    StaffWorkspace.OPERATIONS,
    StaffWorkspace.PARTNERS,
  ],
  FINANCE_OPS: [StaffWorkspace.EMPLOYEE, StaffWorkspace.FINANCE],
  COMPLIANCE_STAFF: [StaffWorkspace.EMPLOYEE, StaffWorkspace.RISK, StaffWorkspace.GOVERNANCE],
  DEVELOPER: [StaffWorkspace.EMPLOYEE, StaffWorkspace.PLATFORM],
  SRE_ONCALL: [StaffWorkspace.EMPLOYEE, StaffWorkspace.PLATFORM],
  SECURITY_AUDITOR: [StaffWorkspace.EMPLOYEE, StaffWorkspace.RISK, StaffWorkspace.GOVERNANCE],
  BREAK_GLASS_ADMIN: [StaffWorkspace.EMPLOYEE, StaffWorkspace.PLATFORM, StaffWorkspace.GOVERNANCE],
};

type SafeAssignment = {
  id: string;
  role: StaffRole;
  status: string;
  validFrom: string;
  validUntil: string | null;
};

type SafeAccessSession = {
  accessSessionId: string;
  staffRole: StaffRole;
  accessMode: string;
  permissions: StaffPermission[];
  effectiveTenantId: string | null;
  effectiveOrganizationId: string | null;
  effectiveUserId: string | null;
  effectiveRole: string | null;
  targetDealId: string | null;
  mfaLevel: string;
  expiresAt: string;
};

type PendingApprovalCountRow = { count: bigint };

type PendingApprovalSummary = {
  total: number;
  staffAccessRequests: number;
  criticalActions: number;
};

@Injectable()
export class StaffCapabilitiesService {
  constructor(private readonly repository: StaffAccessRepository) {}

  async getMine(user: RequestUser) {
    if (user.mfaVerified !== true) {
      throw new ForbiddenException('Staff MFA verification is required');
    }

    const assignmentRows = await this.repository.listActiveAssignments(this.repository.prisma, user.id);
    const assignments = assignmentRows
      .filter((assignment): assignment is StaffAssignmentRow & { role: StaffRole } => isStaffRole(assignment.role))
      .map((assignment) => this.safeAssignment(assignment));

    if (assignments.length === 0) {
      throw new ForbiddenException('Active staff assignment is required');
    }

    const roles = this.unique(assignments.map((assignment) => assignment.role));
    const capabilities = this.unique(
      roles.flatMap((role) => [...ROLE_PERMISSION_CEILING[role]]),
    ).sort();
    const workspaces = this.unique(
      roles.flatMap((role) => [...ROLE_WORKSPACES[role]]),
    );

    const sessionRows = await this.repository.listActiveSessions(this.repository.prisma, user.id);
    const activeAccessSessions = sessionRows
      .filter((session): session is StaffSessionRow & { staff_role: StaffRole } => (
        isStaffRole(session.staff_role) && roles.includes(session.staff_role)
      ))
      .map((session) => this.safeSession(session));
    const pendingApprovals = await this.pendingApprovals(user.id, activeAccessSessions);

    return {
      identity: {
        id: user.id,
        email: user.email,
        fullName: user.fullName ?? null,
      },
      assignments,
      roles,
      capabilities,
      workspaces,
      scopes: activeAccessSessions.map((session) => ({
        accessSessionId: session.accessSessionId,
        accessMode: session.accessMode,
        effectiveTenantId: session.effectiveTenantId,
        effectiveOrganizationId: session.effectiveOrganizationId,
        effectiveUserId: session.effectiveUserId,
        effectiveRole: session.effectiveRole,
        targetDealId: session.targetDealId,
        expiresAt: session.expiresAt,
      })),
      authenticationAssurance: {
        mfaVerified: true,
        mfaVerifiedAt: user.mfaVerifiedAt ?? null,
        recentMfa: this.hasRecentMfa(user.mfaVerifiedAt),
      },
      activeAccessSessions,
      pendingApprovals,
    };
  }

  private safeAssignment(assignment: StaffAssignmentRow & { role: StaffRole }): SafeAssignment {
    return {
      id: assignment.id,
      role: assignment.role,
      status: assignment.status,
      validFrom: assignment.valid_from.toISOString(),
      validUntil: assignment.valid_until?.toISOString() ?? null,
    };
  }

  private safeSession(session: StaffSessionRow & { staff_role: StaffRole }): SafeAccessSession {
    const currentRoleCeiling = new Set(ROLE_PERMISSION_CEILING[session.staff_role]);
    return {
      accessSessionId: session.id,
      staffRole: session.staff_role,
      accessMode: session.access_mode,
      permissions: this.safePermissions(session.permissions)
        .filter((permission) => currentRoleCeiling.has(permission)),
      effectiveTenantId: session.effective_tenant_id,
      effectiveOrganizationId: session.effective_organization_id,
      effectiveUserId: session.effective_user_id,
      effectiveRole: session.effective_role,
      targetDealId: session.target_deal_id,
      mfaLevel: session.mfa_level,
      expiresAt: session.expires_at.toISOString(),
    };
  }

  private async pendingApprovals(
    userId: string,
    sessions: SafeAccessSession[],
  ): Promise<PendingApprovalSummary> {
    const controlPlanePermissions = new Set(
      sessions
        .filter((session) => session.accessMode === StaffAccessMode.CONTROL_PLANE)
        .flatMap((session) => session.permissions),
    );
    const canApproveStaffAccess = controlPlanePermissions.has(StaffPermission.STAFF_REQUEST_APPROVE);
    const canApproveCriticalAction = controlPlanePermissions.has(StaffPermission.CRITICAL_ACTION_APPROVE);

    const zero: PendingApprovalCountRow[] = [{ count: 0n }];
    const [staffRows, criticalRows] = await Promise.all([
      canApproveStaffAccess
        ? this.repository.prisma.$queryRaw<PendingApprovalCountRow[]>(Prisma.sql`
            SELECT COUNT(*)::bigint AS count
            FROM auth.staff_access_requests request
            JOIN auth.staff_assignments assignment ON assignment.id = request.assignment_id
            WHERE request.status = 'PENDING'
              AND request.expires_at > NOW()
              AND request.requester_user_id <> ${userId}
              AND assignment.status IN ('ELIGIBLE', 'ACTIVE')
              AND assignment.valid_from <= NOW()
              AND (assignment.valid_until IS NULL OR assignment.valid_until > NOW())
              AND NOT EXISTS (
                SELECT 1
                FROM auth.staff_access_approvals approval
                WHERE approval.request_id = request.id
                  AND approval.approver_user_id = ${userId}
              )
          `)
        : Promise.resolve(zero),
      canApproveCriticalAction
        ? this.repository.prisma.$queryRaw<PendingApprovalCountRow[]>(Prisma.sql`
            SELECT COUNT(*)::bigint AS count
            FROM auth.staff_critical_action_requests request
            WHERE request.status = 'PENDING'
              AND request.expires_at > NOW()
              AND request.requester_user_id <> ${userId}
              AND NOT EXISTS (
                SELECT 1
                FROM auth.staff_critical_action_approvals approval
                WHERE approval.critical_request_id = request.id
                  AND approval.approver_user_id = ${userId}
              )
          `)
        : Promise.resolve(zero),
    ]);

    const staffAccessRequests = this.safeCount(staffRows[0]?.count);
    const criticalActions = this.safeCount(criticalRows[0]?.count);
    return {
      total: staffAccessRequests + criticalActions,
      staffAccessRequests,
      criticalActions,
    };
  }

  private safeCount(value: bigint | undefined): number {
    if (typeof value !== 'bigint' || value < 0n) return 0;
    const limit = BigInt(Number.MAX_SAFE_INTEGER);
    return Number(value > limit ? limit : value);
  }

  private safePermissions(value: unknown): StaffPermission[] {
    const candidate = Array.isArray(value)
      ? value
      : typeof value === 'string'
        ? this.parsePermissions(value)
        : [];
    return candidate
      .filter((permission): permission is StaffPermission => (
        typeof permission === 'string'
        && Object.values(StaffPermission).includes(permission as StaffPermission)
      ));
  }

  private parsePermissions(value: string): unknown[] {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private hasRecentMfa(value?: string): boolean {
    if (!value) return false;
    const verifiedAt = Date.parse(value);
    if (!Number.isFinite(verifiedAt)) return false;
    const age = Date.now() - verifiedAt;
    return age >= 0 && age <= RECENT_MFA_MS;
  }

  private unique<T extends string>(values: T[]): T[] {
    return [...new Set(values)];
  }
}
