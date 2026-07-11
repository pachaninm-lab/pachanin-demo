import { Injectable } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

export type StaffSqlClient = Pick<Prisma.TransactionClient, '$queryRaw' | '$executeRaw'>;

export type StaffAssignmentRow = {
  id: string;
  user_id: string;
  role: string;
  status: string;
  valid_from: Date;
  valid_until: Date | null;
};

export type StaffAccessRequestRow = {
  id: string;
  requester_user_id: string;
  assignment_id: string;
  access_mode: string;
  target_tenant_id: string | null;
  target_organization_id: string | null;
  target_user_id: string | null;
  target_role: string | null;
  target_deal_id: string | null;
  requested_permissions: unknown;
  reason: string;
  ticket_id: string;
  status: string;
  max_duration_seconds: number;
  requested_at: Date;
  expires_at: Date;
  decided_by_user_id: string | null;
  decided_at: Date | null;
  decision_reason: string | null;
  version: number;
};

export type StaffGrantRow = {
  id: string;
  request_id: string;
  grantee_user_id: string;
  assignment_id: string;
  staff_role: string;
  access_mode: string;
  target_tenant_id: string | null;
  target_organization_id: string | null;
  target_user_id: string | null;
  target_role: string | null;
  target_deal_id: string | null;
  permissions: unknown;
  status: string;
  starts_at: Date;
  expires_at: Date;
  reason: string;
  ticket_id: string;
};

export type StaffSessionRow = {
  id: string;
  grant_id: string;
  actor_user_id: string;
  staff_role: string;
  token_hash: string;
  status: string;
  effective_tenant_id: string | null;
  effective_organization_id: string | null;
  effective_user_id: string | null;
  effective_role: string | null;
  target_deal_id: string | null;
  access_mode: string;
  permissions: unknown;
  reason: string;
  ticket_id: string;
  mfa_level: string;
  expires_at: Date;
  ended_at: Date | null;
};

export type CriticalActionRow = {
  id: string;
  requester_user_id: string;
  access_session_id: string;
  action: string;
  resource_type: string;
  resource_id: string;
  target_tenant_id: string | null;
  target_organization_id: string | null;
  payload_hash: string;
  required_approvals: number;
  status: string;
  expires_at: Date;
  consumed_at: Date | null;
};

@Injectable()
export class StaffAccessRepository {
  constructor(readonly prisma: PrismaClient) {}

  transaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(work, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 5_000,
      timeout: 15_000,
    });
  }

  async listActiveAssignments(client: StaffSqlClient, userId: string, now = new Date()): Promise<StaffAssignmentRow[]> {
    return client.$queryRaw<StaffAssignmentRow[]>(Prisma.sql`
      SELECT id, user_id, role, status, valid_from, valid_until
      FROM auth.staff_assignments
      WHERE user_id = ${userId}
        AND status IN ('ELIGIBLE', 'ACTIVE')
        AND valid_from <= ${now}
        AND (valid_until IS NULL OR valid_until > ${now})
      ORDER BY CASE role WHEN 'PLATFORM_OWNER' THEN 0 ELSE 1 END, created_at, id
    `);
  }

  async getAssignment(
    client: StaffSqlClient,
    id: string,
    userId?: string,
    forUpdate = false,
  ): Promise<StaffAssignmentRow | null> {
    const userFilter = userId ? Prisma.sql` AND user_id = ${userId}` : Prisma.empty;
    const lock = forUpdate ? Prisma.sql` FOR UPDATE` : Prisma.empty;
    const rows = await client.$queryRaw<StaffAssignmentRow[]>(Prisma.sql`
      SELECT id, user_id, role, status, valid_from, valid_until
      FROM auth.staff_assignments
      WHERE id = ${id}${userFilter}${lock}
    `);
    return rows[0] ?? null;
  }

  async createAssignment(client: StaffSqlClient, input: {
    id: string;
    userId: string;
    role: string;
    status: 'ELIGIBLE' | 'ACTIVE';
    validUntil?: Date | null;
    grantedByUserId?: string | null;
    reason: string;
  }): Promise<void> {
    await client.$executeRaw(Prisma.sql`
      INSERT INTO auth.staff_assignments (
        id, user_id, role, status, valid_until, activated_at, granted_by_user_id, reason
      ) VALUES (
        ${input.id}, ${input.userId}, ${input.role}, ${input.status}, ${input.validUntil ?? null},
        ${input.status === 'ACTIVE' ? new Date() : null}, ${input.grantedByUserId ?? null}, ${input.reason}
      )
    `);
  }

  async createAccessRequest(client: StaffSqlClient, input: {
    id: string;
    requesterUserId: string;
    assignmentId: string;
    accessMode: string;
    targetTenantId?: string | null;
    targetOrganizationId?: string | null;
    targetUserId?: string | null;
    targetRole?: string | null;
    targetDealId?: string | null;
    permissions: string[];
    reason: string;
    ticketId: string;
    maxDurationSeconds: number;
    expiresAt: Date;
  }): Promise<void> {
    await client.$executeRaw(Prisma.sql`
      INSERT INTO auth.staff_access_requests (
        id, requester_user_id, assignment_id, access_mode,
        target_tenant_id, target_organization_id, target_user_id, target_role, target_deal_id,
        requested_permissions, reason, ticket_id, max_duration_seconds, expires_at
      ) VALUES (
        ${input.id}, ${input.requesterUserId}, ${input.assignmentId}, ${input.accessMode},
        ${input.targetTenantId ?? null}, ${input.targetOrganizationId ?? null}, ${input.targetUserId ?? null},
        ${input.targetRole ?? null}, ${input.targetDealId ?? null},
        ${JSON.stringify(input.permissions)}::jsonb, ${input.reason}, ${input.ticketId},
        ${input.maxDurationSeconds}, ${input.expiresAt}
      )
    `);
  }

  async getAccessRequest(
    client: StaffSqlClient,
    id: string,
    forUpdate = false,
  ): Promise<StaffAccessRequestRow | null> {
    const lock = forUpdate ? Prisma.sql` FOR UPDATE` : Prisma.empty;
    const rows = await client.$queryRaw<StaffAccessRequestRow[]>(Prisma.sql`
      SELECT * FROM auth.staff_access_requests WHERE id = ${id}${lock}
    `);
    return rows[0] ?? null;
  }

  listAccessRequests(
    client: StaffSqlClient,
    userId: string,
    canReadAll: boolean,
  ): Promise<StaffAccessRequestRow[]> {
    const filter = canReadAll ? Prisma.empty : Prisma.sql` WHERE requester_user_id = ${userId}`;
    return client.$queryRaw<StaffAccessRequestRow[]>(Prisma.sql`
      SELECT * FROM auth.staff_access_requests${filter}
      ORDER BY requested_at DESC, id DESC
      LIMIT 200
    `);
  }

  async insertApproval(client: StaffSqlClient, input: {
    id: string;
    requestId: string;
    approverUserId: string;
    decision: 'APPROVE' | 'DENY';
    reason: string;
  }): Promise<void> {
    await client.$executeRaw(Prisma.sql`
      INSERT INTO auth.staff_access_approvals (id, request_id, approver_user_id, decision, reason)
      VALUES (${input.id}, ${input.requestId}, ${input.approverUserId}, ${input.decision}, ${input.reason})
    `);
  }

  async countApprovals(client: StaffSqlClient, requestId: string): Promise<number> {
    const rows = await client.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
      SELECT COUNT(*)::bigint AS count
      FROM auth.staff_access_approvals
      WHERE request_id = ${requestId} AND decision = 'APPROVE'
    `);
    return Number(rows[0]?.count ?? 0n);
  }

  async markRequest(client: StaffSqlClient, input: {
    id: string;
    expectedVersion: number;
    status: 'APPROVED' | 'DENIED' | 'CANCELLED' | 'EXPIRED' | 'GRANTED';
    actorUserId?: string | null;
    reason?: string | null;
  }): Promise<boolean> {
    const changed = await client.$executeRaw(Prisma.sql`
      UPDATE auth.staff_access_requests
      SET status = ${input.status},
          decided_by_user_id = COALESCE(${input.actorUserId ?? null}, decided_by_user_id),
          decided_at = CASE WHEN ${input.status} IN ('APPROVED', 'DENIED') THEN NOW() ELSE decided_at END,
          decision_reason = COALESCE(${input.reason ?? null}, decision_reason),
          version = version + 1,
          updated_at = NOW()
      WHERE id = ${input.id}
        AND version = ${input.expectedVersion}
    `);
    return changed === 1;
  }

  async createGrant(client: StaffSqlClient, input: {
    id: string;
    request: StaffAccessRequestRow;
    startsAt: Date;
    expiresAt: Date;
  }): Promise<void> {
    await client.$executeRaw(Prisma.sql`
      INSERT INTO auth.staff_access_grants (
        id, request_id, grantee_user_id, assignment_id, access_mode,
        target_tenant_id, target_organization_id, target_user_id, target_role, target_deal_id,
        permissions, starts_at, expires_at
      ) VALUES (
        ${input.id}, ${input.request.id}, ${input.request.requester_user_id}, ${input.request.assignment_id},
        ${input.request.access_mode}, ${input.request.target_tenant_id}, ${input.request.target_organization_id},
        ${input.request.target_user_id}, ${input.request.target_role}, ${input.request.target_deal_id},
        ${JSON.stringify(input.request.requested_permissions)}::jsonb, ${input.startsAt}, ${input.expiresAt}
      )
    `);
  }

  async getGrant(
    client: StaffSqlClient,
    id: string,
    userId?: string,
    forUpdate = false,
  ): Promise<StaffGrantRow | null> {
    const userFilter = userId ? Prisma.sql` AND g.grantee_user_id = ${userId}` : Prisma.empty;
    const lock = forUpdate ? Prisma.sql` FOR UPDATE OF g` : Prisma.empty;
    const rows = await client.$queryRaw<StaffGrantRow[]>(Prisma.sql`
      SELECT
        g.*,
        a.role AS staff_role,
        r.reason,
        r.ticket_id
      FROM auth.staff_access_grants g
      JOIN auth.staff_assignments a ON a.id = g.assignment_id
      JOIN auth.staff_access_requests r ON r.id = g.request_id
      WHERE g.id = ${id}${userFilter}${lock}
    `);
    return rows[0] ?? null;
  }

  async createAccessSession(client: StaffSqlClient, input: {
    id: string;
    grant: StaffGrantRow;
    tokenHash: string;
    mfaLevel: string;
    ipHash?: string | null;
    userAgentHash?: string | null;
  }): Promise<void> {
    await client.$executeRaw(Prisma.sql`
      INSERT INTO auth.staff_access_sessions (
        id, grant_id, actor_user_id, token_hash, effective_tenant_id, effective_organization_id,
        effective_user_id, effective_role, access_mode, permissions, reason, ticket_id,
        mfa_level, ip_hash, user_agent_hash, expires_at
      ) VALUES (
        ${input.id}, ${input.grant.id}, ${input.grant.grantee_user_id}, ${input.tokenHash},
        ${input.grant.target_tenant_id}, ${input.grant.target_organization_id},
        ${input.grant.target_user_id}, ${input.grant.target_role}, ${input.grant.access_mode},
        ${JSON.stringify(input.grant.permissions)}::jsonb, ${input.grant.reason}, ${input.grant.ticket_id},
        ${input.mfaLevel}, ${input.ipHash ?? null}, ${input.userAgentHash ?? null}, ${input.grant.expires_at}
      )
    `);
  }

  async getAccessSessionByHash(
    client: StaffSqlClient,
    tokenHash: string,
    actorUserId: string,
    forUpdate = false,
  ): Promise<StaffSessionRow | null> {
    const lock = forUpdate ? Prisma.sql` FOR UPDATE OF s` : Prisma.empty;
    const rows = await client.$queryRaw<StaffSessionRow[]>(Prisma.sql`
      SELECT
        s.*,
        a.role AS staff_role,
        g.target_deal_id
      FROM auth.staff_access_sessions s
      JOIN auth.staff_access_grants g ON g.id = s.grant_id
      JOIN auth.staff_assignments a ON a.id = g.assignment_id
      WHERE s.token_hash = ${tokenHash}
        AND s.actor_user_id = ${actorUserId}${lock}
    `);
    return rows[0] ?? null;
  }

  async touchAccessSession(client: StaffSqlClient, id: string): Promise<void> {
    await client.$executeRaw(Prisma.sql`
      UPDATE auth.staff_access_sessions
      SET last_seen_at = NOW(), updated_at = NOW()
      WHERE id = ${id} AND status = 'ACTIVE'
    `);
  }

  async endAccessSession(
    client: StaffSqlClient,
    id: string,
    actorUserId: string,
    reason: string,
  ): Promise<boolean> {
    const changed = await client.$executeRaw(Prisma.sql`
      UPDATE auth.staff_access_sessions
      SET status = 'ENDED', ended_at = NOW(), end_reason = ${reason}, updated_at = NOW()
      WHERE id = ${id} AND actor_user_id = ${actorUserId} AND status = 'ACTIVE'
    `);
    return changed === 1;
  }

  listActiveSessions(client: StaffSqlClient, actorUserId?: string): Promise<StaffSessionRow[]> {
    const filter = actorUserId ? Prisma.sql` AND s.actor_user_id = ${actorUserId}` : Prisma.empty;
    return client.$queryRaw<StaffSessionRow[]>(Prisma.sql`
      SELECT s.*, a.role AS staff_role, g.target_deal_id
      FROM auth.staff_access_sessions s
      JOIN auth.staff_access_grants g ON g.id = s.grant_id
      JOIN auth.staff_assignments a ON a.id = g.assignment_id
      WHERE s.status = 'ACTIVE' AND s.expires_at > NOW()${filter}
      ORDER BY s.started_at DESC
      LIMIT 200
    `);
  }

  async createBreakGlass(client: StaffSqlClient, input: {
    id: string;
    actorUserId: string;
    assignmentId: string;
    reason: string;
    ticketId: string;
    expiresAt: Date;
    correlationId: string;
  }): Promise<void> {
    await client.$executeRaw(Prisma.sql`
      INSERT INTO auth.break_glass_activations (
        id, actor_user_id, assignment_id, reason, ticket_id, expires_at, notification_correlation_id
      ) VALUES (
        ${input.id}, ${input.actorUserId}, ${input.assignmentId}, ${input.reason}, ${input.ticketId},
        ${input.expiresAt}, ${input.correlationId}
      )
    `);
  }

  async endBreakGlass(
    client: StaffSqlClient,
    id: string,
    actorUserId: string,
    reason: string,
  ): Promise<boolean> {
    const changed = await client.$executeRaw(Prisma.sql`
      UPDATE auth.break_glass_activations
      SET status = 'ENDED', ended_at = NOW(), end_reason = ${reason}, updated_at = NOW()
      WHERE id = ${id} AND actor_user_id = ${actorUserId} AND status = 'ACTIVE'
    `);
    return changed === 1;
  }

  async createCriticalAction(client: StaffSqlClient, input: {
    id: string;
    requesterUserId: string;
    accessSessionId: string;
    action: string;
    resourceType: string;
    resourceId: string;
    targetTenantId?: string | null;
    targetOrganizationId?: string | null;
    payloadHash: string;
    requiredApprovals: number;
    expiresAt: Date;
  }): Promise<void> {
    await client.$executeRaw(Prisma.sql`
      INSERT INTO auth.staff_critical_action_requests (
        id, requester_user_id, access_session_id, action, resource_type, resource_id,
        target_tenant_id, target_organization_id, payload_hash, required_approvals, expires_at
      ) VALUES (
        ${input.id}, ${input.requesterUserId}, ${input.accessSessionId}, ${input.action},
        ${input.resourceType}, ${input.resourceId}, ${input.targetTenantId ?? null},
        ${input.targetOrganizationId ?? null}, ${input.payloadHash}, ${input.requiredApprovals}, ${input.expiresAt}
      )
    `);
  }

  async getCriticalAction(
    client: StaffSqlClient,
    id: string,
    forUpdate = false,
  ): Promise<CriticalActionRow | null> {
    const lock = forUpdate ? Prisma.sql` FOR UPDATE` : Prisma.empty;
    const rows = await client.$queryRaw<CriticalActionRow[]>(Prisma.sql`
      SELECT * FROM auth.staff_critical_action_requests WHERE id = ${id}${lock}
    `);
    return rows[0] ?? null;
  }

  async insertCriticalApproval(client: StaffSqlClient, input: {
    id: string;
    requestId: string;
    approverUserId: string;
    decision: 'APPROVE' | 'DENY';
    reason: string;
  }): Promise<void> {
    await client.$executeRaw(Prisma.sql`
      INSERT INTO auth.staff_critical_action_approvals (
        id, critical_request_id, approver_user_id, decision, reason
      ) VALUES (
        ${input.id}, ${input.requestId}, ${input.approverUserId}, ${input.decision}, ${input.reason}
      )
    `);
  }

  async countCriticalApprovals(client: StaffSqlClient, requestId: string): Promise<number> {
    const rows = await client.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
      SELECT COUNT(*)::bigint AS count
      FROM auth.staff_critical_action_approvals
      WHERE critical_request_id = ${requestId} AND decision = 'APPROVE'
    `);
    return Number(rows[0]?.count ?? 0n);
  }

  async markCriticalAction(
    client: StaffSqlClient,
    id: string,
    status: string,
    consumed = false,
  ): Promise<boolean> {
    const changed = await client.$executeRaw(Prisma.sql`
      UPDATE auth.staff_critical_action_requests
      SET status = ${status},
          consumed_at = CASE WHEN ${consumed} THEN NOW() ELSE consumed_at END,
          updated_at = NOW()
      WHERE id = ${id} AND status IN ('PENDING', 'APPROVED')
    `);
    return changed === 1;
  }

  async latestEventHash(client: StaffSqlClient, actorUserId: string): Promise<string | null> {
    await client.$executeRaw(Prisma.sql`SELECT auth.lock_staff_access_event_chain(${actorUserId})`);
    const rows = await client.$queryRaw<Array<{ hash: string }>>(Prisma.sql`
      SELECT hash FROM auth.staff_access_events
      WHERE actor_user_id = ${actorUserId}
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    `);
    return rows[0]?.hash ?? null;
  }

  async insertEvent(client: StaffSqlClient, input: {
    id: string;
    actorUserId: string;
    staffRole: string;
    accessSessionId?: string | null;
    grantId?: string | null;
    effectiveTenantId?: string | null;
    effectiveOrganizationId?: string | null;
    effectiveUserId?: string | null;
    effectiveRole?: string | null;
    accessMode?: string | null;
    action: string;
    resourceType?: string | null;
    resourceId?: string | null;
    outcome: 'SUCCESS' | 'FAILURE' | 'DENIED';
    reason?: string | null;
    ticketId?: string | null;
    correlationId: string;
    metadata?: Record<string, unknown> | null;
    prevHash?: string | null;
    hash: string;
  }): Promise<void> {
    await client.$executeRaw(Prisma.sql`
      INSERT INTO auth.staff_access_events (
        id, actor_user_id, staff_role, access_session_id, grant_id,
        effective_tenant_id, effective_organization_id, effective_user_id, effective_role,
        access_mode, action, resource_type, resource_id, outcome, reason, ticket_id,
        correlation_id, metadata, prev_hash, hash
      ) VALUES (
        ${input.id}, ${input.actorUserId}, ${input.staffRole}, ${input.accessSessionId ?? null},
        ${input.grantId ?? null}, ${input.effectiveTenantId ?? null},
        ${input.effectiveOrganizationId ?? null}, ${input.effectiveUserId ?? null},
        ${input.effectiveRole ?? null}, ${input.accessMode ?? null}, ${input.action},
        ${input.resourceType ?? null}, ${input.resourceId ?? null}, ${input.outcome},
        ${input.reason ?? null}, ${input.ticketId ?? null}, ${input.correlationId},
        ${JSON.stringify(input.metadata ?? {})}::jsonb, ${input.prevHash ?? null}, ${input.hash}
      )
    `);
  }
}
