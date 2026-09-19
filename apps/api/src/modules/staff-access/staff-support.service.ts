import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { RequestUser } from '../../common/types/request-user';
import { StaffAccessRepository, StaffSqlClient } from './staff-access.repository';
import { StaffAccessService } from './staff-access.service';
import { StaffAuditWriterService } from './staff-audit-writer.service';
import { StaffAccessContext, StaffPermission } from './staff-access.types';
import {
  CreateStaffSupportCaseDto,
  InitiateUserRecoveryDto,
  RevokeUserSessionsDto,
  TransitionStaffSupportCaseDto,
} from './staff-support.dto';

type SupportCaseRow = {
  id: string;
  tenant_id: string;
  organization_id: string;
  organization_name: string;
  organization_inn: string;
  user_id: string | null;
  user_email: string | null;
  user_full_name: string | null;
  deal_id: string | null;
  deal_number: string | null;
  subject: string;
  description: string;
  priority: string;
  status: string;
  source: string;
  created_by_user_id: string;
  assigned_staff_user_id: string | null;
  idempotency_key: string;
  version: number;
  created_at: Date;
  updated_at: Date;
  resolved_at: Date | null;
  closed_at: Date | null;
};

type OrganizationScope = { id: string; tenantId: string; name: string };
type SupportCaseState = Pick<SupportCaseRow, 'id' | 'tenant_id' | 'organization_id' | 'user_id' | 'deal_id' | 'status' | 'version'>;

const CASE_TRANSITIONS: Readonly<Record<string, readonly string[]>> = {
  OPEN: ['IN_PROGRESS', 'WAITING_CUSTOMER', 'ESCALATED', 'RESOLVED'],
  IN_PROGRESS: ['WAITING_CUSTOMER', 'ESCALATED', 'RESOLVED'],
  WAITING_CUSTOMER: ['IN_PROGRESS', 'ESCALATED', 'RESOLVED'],
  ESCALATED: ['IN_PROGRESS', 'RESOLVED'],
  RESOLVED: ['IN_PROGRESS', 'CLOSED'],
  CLOSED: [],
};

@Injectable()
export class StaffSupportService {
  constructor(
    private readonly repository: StaffAccessRepository,
    private readonly accessService: StaffAccessService,
    private readonly audit: StaffAuditWriterService,
  ) {}

  async listCases(
    actor: RequestUser,
    access: StaffAccessContext,
    filters: { status?: string; organizationId?: string; limit?: string },
  ) {
    await this.accessService.requirePermission(actor, StaffPermission.SUPPORT_CASE_READ);
    const limit = Math.max(1, Math.min(500, Number(filters.limit || 200) || 200));
    const status = String(filters.status || '').trim().toUpperCase();
    const organizationId = String(filters.organizationId || '').trim();
    if (organizationId) this.assertAccessScope(access, undefined, organizationId);
    const scopedTenant = access.effectiveTenantId;
    const scopedOrganization = access.effectiveOrganizationId;
    const statusFilter = status ? Prisma.sql` AND c.status = ${status}` : Prisma.empty;
    const organizationFilter = organizationId
      ? Prisma.sql` AND c.organization_id = ${organizationId}`
      : scopedOrganization
        ? Prisma.sql` AND c.organization_id = ${scopedOrganization}`
        : Prisma.empty;
    const tenantFilter = scopedTenant ? Prisma.sql` AND c.tenant_id = ${scopedTenant}` : Prisma.empty;
    return this.repository.prisma.$queryRaw<SupportCaseRow[]>(Prisma.sql`
      SELECT
        c.id,
        c.tenant_id,
        c.organization_id,
        o.name AS organization_name,
        o.inn AS organization_inn,
        c.user_id,
        u.email AS user_email,
        u."fullName" AS user_full_name,
        c.deal_id,
        d."dealNumber" AS deal_number,
        c.subject,
        c.description,
        c.priority,
        c.status,
        c.source,
        c.created_by_user_id,
        c.assigned_staff_user_id,
        c.idempotency_key,
        c.version,
        c.created_at,
        c.updated_at,
        c.resolved_at,
        c.closed_at
      FROM support.cases c
      JOIN public.organizations o ON o.id = c.organization_id
      LEFT JOIN public.users u ON u.id = c.user_id
      LEFT JOIN public.deals d ON d.id = c.deal_id
      WHERE TRUE${tenantFilter}${organizationFilter}${statusFilter}
      ORDER BY
        CASE c.priority WHEN 'CRITICAL' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'NORMAL' THEN 2 ELSE 3 END,
        CASE c.status WHEN 'ESCALATED' THEN 0 WHEN 'OPEN' THEN 1 WHEN 'IN_PROGRESS' THEN 2 ELSE 3 END,
        c.updated_at DESC,
        c.id
      LIMIT ${limit}
    `);
  }

  async createCase(
    actor: RequestUser,
    access: StaffAccessContext,
    input: CreateStaffSupportCaseDto,
    correlationId: string = randomUUID(),
  ) {
    await this.accessService.requirePermission(actor, StaffPermission.SUPPORT_CASE_UPDATE);
    const organization = await this.requireOrganization(input.organizationId);
    this.assertAccessScope(access, organization.tenantId, organization.id);
    await this.validateUserAndDeal(organization, input.userId, input.dealId);
    const id = `sup_${randomUUID()}`;
    const subject = input.subject.trim();
    const description = input.description.trim();
    const idempotencyKey = input.idempotencyKey.trim();

    return this.repository.transaction(async (tx) => {
      const inserted = await tx.$queryRaw<SupportCaseRow[]>(Prisma.sql`
        INSERT INTO support.cases (
          id, tenant_id, organization_id, user_id, deal_id, subject, description,
          priority, status, source, created_by_user_id, idempotency_key
        ) VALUES (
          ${id}, ${organization.tenantId}, ${organization.id}, ${input.userId || null}, ${input.dealId || null},
          ${subject}, ${description}, ${input.priority}, 'OPEN', 'STAFF', ${actor.id}, ${idempotencyKey}
        )
        ON CONFLICT (tenant_id, idempotency_key) DO NOTHING
        RETURNING
          id, tenant_id, organization_id, ''::TEXT AS organization_name, ''::TEXT AS organization_inn,
          user_id, NULL::TEXT AS user_email, NULL::TEXT AS user_full_name,
          deal_id, NULL::TEXT AS deal_number, subject, description, priority, status, source,
          created_by_user_id, assigned_staff_user_id, idempotency_key, version,
          created_at, updated_at, resolved_at, closed_at
      `);
      if (inserted.length === 0) {
        const existing = await this.caseByIdempotency(tx, organization.tenantId, idempotencyKey);
        if (!existing) throw new ConflictException('Support case idempotency conflict');
        return { case: existing, replayed: true };
      }
      await this.insertCaseEvent(tx, {
        caseId: id,
        actorUserId: actor.id,
        action: 'CASE_CREATED',
        fromStatus: null,
        toStatus: 'OPEN',
        note: description,
        correlationId,
      });
      await this.audit.recordInTransaction(tx, actor, access, {
        action: 'staff.support.case.create',
        resourceType: 'support-case',
        resourceId: id,
        reason: subject,
        correlationId,
        metadata: {
          targetTenantId: organization.tenantId,
          targetOrganizationId: organization.id,
          targetUserId: input.userId || null,
          targetDealId: input.dealId || null,
          priority: input.priority,
        },
      });
      return { case: inserted[0], replayed: false };
    });
  }

  async transitionCase(
    actor: RequestUser,
    access: StaffAccessContext,
    caseId: string,
    input: TransitionStaffSupportCaseDto,
    correlationId: string = randomUUID(),
  ) {
    await this.accessService.requirePermission(actor, StaffPermission.SUPPORT_CASE_UPDATE);
    return this.repository.transaction(async (tx) => {
      const current = await this.lockCase(tx, caseId);
      this.assertAccessScope(access, current.tenant_id, current.organization_id);
      if (current.version !== input.expectedVersion) {
        throw new ConflictException(`Support case version changed: expected ${input.expectedVersion}, actual ${current.version}`);
      }
      const allowed = CASE_TRANSITIONS[current.status] || [];
      if (!allowed.includes(input.status)) {
        throw new ConflictException(`Support case transition ${current.status} -> ${input.status} is not allowed`);
      }
      if (input.assignedStaffUserId) {
        const assignee = await tx.$queryRaw<{ exists: boolean }[]>(Prisma.sql`
          SELECT EXISTS(
            SELECT 1
            FROM auth.staff_assignments
            WHERE user_id = ${input.assignedStaffUserId}
              AND status IN ('ELIGIBLE', 'ACTIVE')
              AND valid_from <= NOW()
              AND (valid_until IS NULL OR valid_until > NOW())
          ) AS exists
        `);
        if (!assignee[0]?.exists) throw new BadRequestException('Assigned staff user has no active staff assignment');
      }
      const updated = await tx.$queryRaw<SupportCaseState[]>(Prisma.sql`
        UPDATE support.cases
        SET status = ${input.status},
            assigned_staff_user_id = COALESCE(${input.assignedStaffUserId || null}, assigned_staff_user_id),
            version = version + 1,
            updated_at = NOW(),
            resolved_at = CASE WHEN ${input.status} = 'RESOLVED' THEN NOW() ELSE resolved_at END,
            closed_at = CASE WHEN ${input.status} = 'CLOSED' THEN NOW() ELSE closed_at END
        WHERE id = ${caseId} AND version = ${input.expectedVersion}
        RETURNING id, tenant_id, organization_id, user_id, deal_id, status, version
      `);
      if (updated.length !== 1) throw new ConflictException('Support case changed concurrently');
      await this.insertCaseEvent(tx, {
        caseId,
        actorUserId: actor.id,
        action: 'STATUS_CHANGED',
        fromStatus: current.status,
        toStatus: input.status,
        note: input.note.trim(),
        correlationId,
      });
      await this.audit.recordInTransaction(tx, actor, access, {
        action: 'staff.support.case.transition',
        resourceType: 'support-case',
        resourceId: caseId,
        reason: input.note.trim(),
        correlationId,
        metadata: {
          targetTenantId: current.tenant_id,
          targetOrganizationId: current.organization_id,
          targetUserId: current.user_id,
          targetDealId: current.deal_id,
          beforeStatus: current.status,
          afterStatus: input.status,
          beforeVersion: current.version,
          afterVersion: updated[0].version,
          assignedStaffUserId: input.assignedStaffUserId || null,
        },
      });
      return updated[0];
    });
  }

  async revokeUserSessions(
    actor: RequestUser,
    access: StaffAccessContext,
    userId: string,
    input: RevokeUserSessionsDto,
    correlationId: string = randomUUID(),
  ) {
    await this.accessService.requirePermission(actor, StaffPermission.USER_SESSION_REVOKE);
    const organization = await this.requireOrganization(input.organizationId);
    this.assertAccessScope(access, organization.tenantId, organization.id);
    await this.requireMembership(userId, organization.id);
    return this.repository.transaction(async (tx) => {
      const sessions = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
        UPDATE auth.sessions
        SET status = 'REVOKED', revoked_at = NOW(), revocation_reason = ${input.reason.trim()}, updated_at = NOW()
        WHERE user_id = ${userId}
          AND organization_id = ${organization.id}
          AND status IN ('ACTIVE', 'MFA_PENDING')
        RETURNING id
      `);
      const sessionIds = sessions.map((session) => session.id);
      let refreshTokens = 0;
      if (sessionIds.length > 0) {
        refreshTokens = await tx.$executeRaw(Prisma.sql`
          UPDATE auth.refresh_tokens
          SET status = 'REVOKED', revoked_at = NOW(), revocation_reason = ${input.reason.trim()}
          WHERE session_id IN (${Prisma.join(sessionIds)})
            AND status IN ('ACTIVE', 'ROTATED')
        `);
      }
      await this.audit.recordInTransaction(tx, actor, access, {
        action: 'staff.user.sessions.revoke',
        resourceType: 'user',
        resourceId: userId,
        reason: input.reason.trim(),
        correlationId,
        metadata: {
          targetTenantId: organization.tenantId,
          targetOrganizationId: organization.id,
          targetUserId: userId,
          revokedSessions: sessions.length,
          revokedRefreshTokens: refreshTokens,
        },
      });
      return { success: true, revokedSessions: sessions.length, revokedRefreshTokens: refreshTokens };
    });
  }

  async initiateRecovery(
    actor: RequestUser,
    access: StaffAccessContext,
    userId: string,
    input: InitiateUserRecoveryDto,
    correlationId: string = randomUUID(),
  ) {
    await this.accessService.requirePermission(actor, StaffPermission.USER_ACCESS_RECOVERY_INITIATE);
    const organization = await this.requireOrganization(input.organizationId);
    this.assertAccessScope(access, organization.tenantId, organization.id);
    await this.requireMembership(userId, organization.id);
    const id = `srr_${randomUUID()}`;
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    return this.repository.transaction(async (tx) => {
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO support.access_recovery_requests (
          id, tenant_id, organization_id, user_id, requested_by_user_id,
          reason, ticket_id, status, correlation_id, expires_at
        ) VALUES (
          ${id}, ${organization.tenantId}, ${organization.id}, ${userId}, ${actor.id},
          ${input.reason.trim()}, ${input.ticketId.trim()}, 'PENDING_DELIVERY', ${correlationId}, ${expiresAt}
        )
      `);
      await this.audit.recordInTransaction(tx, actor, access, {
        action: 'staff.user.recovery.initiate',
        resourceType: 'user',
        resourceId: userId,
        reason: input.reason.trim(),
        correlationId,
        metadata: {
          targetTenantId: organization.tenantId,
          targetOrganizationId: organization.id,
          targetUserId: userId,
          recoveryRequestId: id,
          deliveryStatus: 'PENDING_DELIVERY',
          expiresAt: expiresAt.toISOString(),
        },
      });
      return {
        requestId: id,
        status: 'PENDING_DELIVERY',
        expiresAt: expiresAt.toISOString(),
      };
    });
  }

  private async requireOrganization(organizationId: string): Promise<OrganizationScope> {
    const organization = await this.repository.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, tenantId: true, name: true },
    });
    if (!organization) throw new NotFoundException('Organization not found');
    return organization;
  }

  private async requireMembership(userId: string, organizationId: string) {
    const membership = await this.repository.prisma.userOrg.findFirst({
      where: { userId, organizationId },
      select: { id: true },
    });
    if (!membership) throw new ForbiddenException('User is not a member of the target organization');
  }

  private async validateUserAndDeal(organization: OrganizationScope, userId?: string, dealId?: string) {
    if (userId) await this.requireMembership(userId, organization.id);
    if (dealId) {
      const deal = await this.repository.prisma.deal.findFirst({
        where: {
          id: dealId,
          OR: [{ sellerOrgId: organization.id }, { buyerOrgId: organization.id }],
        },
        select: { id: true, tenantId: true },
      });
      if (!deal) throw new ForbiddenException('Deal is outside the target organization');
      if (deal.tenantId && deal.tenantId !== organization.tenantId) {
        throw new ForbiddenException('Deal tenant does not match the organization tenant');
      }
    }
  }

  private assertAccessScope(access: StaffAccessContext, tenantId?: string, organizationId?: string) {
    if (access.effectiveTenantId && tenantId && access.effectiveTenantId !== tenantId) {
      throw new ForbiddenException('Staff session tenant scope mismatch');
    }
    if (access.effectiveOrganizationId && organizationId && access.effectiveOrganizationId !== organizationId) {
      throw new ForbiddenException('Staff session organization scope mismatch');
    }
  }

  private async lockCase(client: StaffSqlClient, caseId: string) {
    const rows = await client.$queryRaw<SupportCaseState[]>(Prisma.sql`
      SELECT id, tenant_id, organization_id, user_id, deal_id, status, version
      FROM support.cases
      WHERE id = ${caseId}
      FOR UPDATE
    `);
    if (rows.length !== 1) throw new NotFoundException('Support case not found');
    return rows[0];
  }

  private async caseByIdempotency(client: StaffSqlClient, tenantId: string, idempotencyKey: string) {
    const rows = await client.$queryRaw<SupportCaseRow[]>(Prisma.sql`
      SELECT
        c.id, c.tenant_id, c.organization_id, o.name AS organization_name, o.inn AS organization_inn,
        c.user_id, u.email AS user_email, u."fullName" AS user_full_name,
        c.deal_id, d."dealNumber" AS deal_number, c.subject, c.description, c.priority, c.status, c.source,
        c.created_by_user_id, c.assigned_staff_user_id, c.idempotency_key, c.version,
        c.created_at, c.updated_at, c.resolved_at, c.closed_at
      FROM support.cases c
      JOIN public.organizations o ON o.id = c.organization_id
      LEFT JOIN public.users u ON u.id = c.user_id
      LEFT JOIN public.deals d ON d.id = c.deal_id
      WHERE c.tenant_id = ${tenantId} AND c.idempotency_key = ${idempotencyKey}
      LIMIT 1
    `);
    return rows[0] || null;
  }

  private async insertCaseEvent(client: StaffSqlClient, input: {
    caseId: string;
    actorUserId: string;
    action: string;
    fromStatus: string | null;
    toStatus: string | null;
    note: string;
    correlationId: string;
  }) {
    await client.$executeRaw(Prisma.sql`
      INSERT INTO support.case_events (
        id, case_id, actor_user_id, action, from_status, to_status, note, correlation_id
      ) VALUES (
        ${`sce_${randomUUID()}`}, ${input.caseId}, ${input.actorUserId}, ${input.action},
        ${input.fromStatus}, ${input.toStatus}, ${input.note}, ${input.correlationId}
      )
    `);
  }
}
