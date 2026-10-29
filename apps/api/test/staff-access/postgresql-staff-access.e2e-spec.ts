import { ConflictException, ForbiddenException } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { RequestUser, Role } from '../../src/common/types/request-user';
import { isRetryableTransactionConflict } from '../../src/common/prisma/rls-transaction.service';
import { AuthPrismaService } from '../../src/modules/auth/auth-prisma.service';
import { issueStaffAccessCredential } from '../../src/modules/auth/opaque-token-authority';
import { StaffAccessService } from '../../src/modules/staff-access/staff-access.service';
import { StaffAuditService } from '../../src/modules/staff-access/staff-audit.service';
import { StaffAuthorityPrismaService } from '../../src/modules/staff-access/staff-authority-prisma.service';
import { StaffProjectionService } from '../../src/modules/staff-access/staff-projection.service';
import { StaffRuntimeAccessRepository } from '../../src/modules/staff-access/staff-runtime-access.repository';
import type { StaffSqlClient } from '../../src/modules/staff-access/staff-access.repository';
import {
  StaffAccessMode,
  StaffPermission,
  StaffRole,
} from '../../src/modules/staff-access/staff-access.types';

const ids = {
  platformOrg: 'org-staff-platform-e2e',
  otherOrg: 'org-staff-other-e2e',
  owner: 'user-staff-owner-e2e',
  admin: 'user-staff-admin-e2e',
  supervisor: 'user-staff-supervisor-e2e',
  support: 'user-staff-support-e2e',
  developer: 'user-staff-developer-e2e',
  sre: 'user-staff-sre-e2e',
  ownerAssignment: 'sta-owner-e2e',
  adminAssignment: 'sta-admin-e2e',
  supervisorAssignment: 'sta-supervisor-e2e',
  supportAssignment: 'sta-support-e2e',
  developerAssignment: 'sta-developer-e2e',
  sreAssignment: 'sta-sre-e2e',
};
const ADMIN_DATABASE_URL = process.env.STAFF_ACCESS_TEST_ADMIN_URL ?? '';

function actor(userId: string, email: string, orgId: string, tenantId: string): RequestUser {
  return {
    id: userId,
    email,
    fullName: email,
    orgId,
    tenantId,
    membershipId: `membership-${userId}`,
    sessionId: `session-${userId}`,
    role: Role.ADMIN,
    mfaVerified: true,
    mfaVerifiedAt: new Date().toISOString(),
  };
}

describe('Staff Access Control Plane PostgreSQL exploitation gate', () => {
  const prisma = new AuthPrismaService();
  const staffPrisma = new StaffAuthorityPrismaService();
  const adminPrisma = new PrismaClient(
    ADMIN_DATABASE_URL ? { datasources: { db: { url: ADMIN_DATABASE_URL } } } : undefined,
  );
  const repository = new StaffRuntimeAccessRepository(prisma, staffPrisma);
  const access = new StaffAccessService(repository);
  const projection = new StaffProjectionService(staffPrisma, access);
  const audit = new StaffAuditService(repository, access);

  const owner = actor(ids.owner, 'owner.staff.e2e@example.test', ids.platformOrg, 'tenant-staff-platform-e2e');
  const admin = actor(ids.admin, 'admin.staff.e2e@example.test', ids.platformOrg, 'tenant-staff-platform-e2e');
  const supervisor = actor(ids.supervisor, 'supervisor.staff.e2e@example.test', ids.platformOrg, 'tenant-staff-platform-e2e');
  const support = actor(ids.support, 'support.staff.e2e@example.test', ids.platformOrg, 'tenant-staff-platform-e2e');
  const developer = actor(ids.developer, 'developer.staff.e2e@example.test', ids.platformOrg, 'tenant-staff-platform-e2e');
  const sre = actor(ids.sre, 'sre.staff.e2e@example.test', ids.platformOrg, 'tenant-staff-platform-e2e');

  beforeAll(async () => {
    if (!ADMIN_DATABASE_URL) {
      throw new Error('STAFF_ACCESS_TEST_ADMIN_URL is required for isolated fixture bootstrap.');
    }
    await Promise.all([prisma.$connect(), staffPrisma.onModuleInit(), adminPrisma.$connect()]);

    await adminPrisma.organization.upsert({
      where: { id: ids.platformOrg },
      create: {
        id: ids.platformOrg,
        inn: '990000100001',
        name: 'Staff Platform E2E',
        tenantId: 'tenant-staff-platform-e2e',
        status: 'ACTIVE',
        kycStatus: 'VERIFIED',
        amlStatus: 'CLEAR',
      },
      update: {},
    });
    await adminPrisma.organization.upsert({
      where: { id: ids.otherOrg },
      create: {
        id: ids.otherOrg,
        inn: '990000100002',
        name: 'Staff Other E2E',
        tenantId: 'tenant-staff-other-e2e',
        status: 'ACTIVE',
        kycStatus: 'VERIFIED',
        amlStatus: 'CLEAR',
      },
      update: {},
    });

    for (const user of [owner, admin, supervisor, support, developer, sre]) {
      await adminPrisma.user.upsert({
        where: { id: user.id },
        create: {
          id: user.id,
          email: user.email,
          fullName: user.fullName || user.email,
          passwordHash: '$argon2id$v=19$m=65536,t=3,p=1$isolated$staff-access-e2e',
          status: 'ACTIVE',
        },
        update: {},
      });
      await adminPrisma.userOrg.upsert({
        where: { userId_organizationId: { userId: user.id, organizationId: ids.platformOrg } },
        create: {
          id: `membership-${user.id}`,
          userId: user.id,
          organizationId: ids.platformOrg,
          role: 'ADMIN',
          isDefault: true,
        },
        update: {},
      });
    }

    const assignments = [
      [ids.ownerAssignment, ids.owner, StaffRole.PLATFORM_OWNER],
      [ids.adminAssignment, ids.admin, StaffRole.PLATFORM_ADMIN],
      [ids.supervisorAssignment, ids.supervisor, StaffRole.OPERATIONS_SUPERVISOR],
      [ids.supportAssignment, ids.support, StaffRole.SUPPORT_L1],
      [ids.developerAssignment, ids.developer, StaffRole.DEVELOPER],
      [ids.sreAssignment, ids.sre, StaffRole.SRE_ONCALL],
    ] as const;

    for (const [id, userId, role] of assignments) {
      await adminPrisma.$executeRaw(Prisma.sql`
        INSERT INTO auth.staff_assignments (
          id, user_id, role, status, activated_at, granted_by_user_id, reason
        ) VALUES (
          ${id}, ${userId}, ${role}, 'ACTIVE', NOW(), ${ids.owner}, 'Isolated PostgreSQL exploitation fixture'
        )
        ON CONFLICT (id) DO NOTHING
      `);
    }
  });

  afterAll(async () => {
    await Promise.allSettled([
      prisma.$disconnect(),
      staffPrisma.onModuleDestroy(),
      adminPrisma.$disconnect(),
    ]);
  });

  it('forces MFA enrollment for every active staff assignment', async () => {
    const rows = await prisma.$queryRaw<Array<{ user_id: string; mfa_enabled: boolean }>>(Prisma.sql`
      SELECT user_id, mfa_enabled
      FROM auth.credential_states
      WHERE user_id IN (
        ${ids.owner}, ${ids.admin}, ${ids.supervisor}, ${ids.support}, ${ids.developer}, ${ids.sre}
      )
      ORDER BY user_id
    `);
    expect(rows).toHaveLength(6);
    expect(rows.every((row) => row.mfa_enabled)).toBe(true);
  });

  it('enforces role ceilings for support and developer staff', async () => {
    await expect(access.requestAccess(support, {
      assignmentId: ids.supportAssignment,
      accessMode: StaffAccessMode.CONTROL_PLANE,
      permissions: [StaffPermission.DOCUMENT_CONTENT_READ],
      reason: 'Attempt to exceed L1 support permission ceiling',
      ticketId: 'SUP-E2E-1',
      durationSeconds: 600,
    })).rejects.toBeInstanceOf(ForbiddenException);

    await expect(access.requestAccess(developer, {
      assignmentId: ids.developerAssignment,
      accessMode: StaffAccessMode.VIEW_AS,
      permissions: [StaffPermission.CABINET_VIEW_AS],
      targetOrganizationId: ids.otherOrg,
      targetRole: 'BUYER',
      reason: 'Developer must not open a customer cabinet',
      ticketId: 'INC-E2E-1',
      durationSeconds: 600,
    })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('creates an owner view-as session and enforces the exact organization and role in PostgreSQL', async () => {
    const target = await adminPrisma.organization.findUnique({
      where: { id: 'org-canonical-buyer' },
      select: { id: true, tenantId: true },
    });
    expect(target).not.toBeNull();

    const requested = await access.requestAccess(owner, {
      assignmentId: ids.ownerAssignment,
      accessMode: StaffAccessMode.VIEW_AS,
      permissions: [StaffPermission.CABINET_VIEW_AS, StaffPermission.DEAL_READ],
      targetOrganizationId: target!.id,
      targetTenantId: target!.tenantId,
      targetRole: 'BUYER',
      reason: 'Owner read-only inspection of the buyer cabinet',
      ticketId: 'OWN-E2E-VIEW',
      durationSeconds: 900,
    });
    expect(requested.status).toBe('GRANTED');
    expect(requested.grantId).toBeTruthy();

    const activated = await access.activateGrant(
      owner,
      requested.grantId!,
      'staff-access-e2e',
      '127.0.0.1',
      'corr-owner-view',
    );
    const context = await access.resolveAccessSession(owner, activated.accessToken);
    expect(context.actorUserId).toBe(ids.owner);
    expect(context.effectiveOrganizationId).toBe(target!.id);
    expect(context.effectiveRole).toBe('BUYER');
    expect(context.accessMode).toBe(StaffAccessMode.VIEW_AS);

    const cabinet = await projection.cabinetProjection(
      owner,
      context,
      activated.accessToken,
      target!.id,
      'BUYER',
    );
    expect(cabinet.mode).toBe('READ_ONLY_VIEW_AS');
    expect(cabinet.deals.some((deal) => deal.id === 'DEAL-INDUSTRIAL-001')).toBe(true);

    await expect(
      projection.cabinetProjection(owner, context, activated.accessToken, ids.otherOrg, 'BUYER'),
    ).rejects.toBeTruthy();
    await expect(
      projection.cabinetProjection(owner, context, activated.accessToken, target!.id, 'BANK'),
    ).rejects.toBeTruthy();
    await access.endSession(owner, activated.accessSessionId, 'Completed isolated view-as inspection');
  });

  async function ownerViewGrant(ticketId: string) {
    const target = await adminPrisma.organization.findUnique({
      where: { id: 'org-canonical-buyer' }, select: { id: true, tenantId: true },
    });
    if (!target) throw new Error('Canonical buyer organization fixture is required');
    const requested = await access.requestAccess(owner, {
      assignmentId: ids.ownerAssignment,
      accessMode: StaffAccessMode.VIEW_AS,
      permissions: [StaffPermission.CABINET_VIEW_AS, StaffPermission.DEAL_READ],
      targetOrganizationId: target.id, targetTenantId: target.tenantId, targetRole: 'BUYER',
      reason: 'Isolated actor session concurrency acceptance', ticketId, durationSeconds: 900,
    });
    if (!requested.grantId) throw new Error('Owner view-as fixture must create a grant');
    return requested.grantId;
  }

  async function endOwnSessionIfActive(sessionId: string, reason: string) {
    const rows = await adminPrisma.$queryRaw<Array<{ status: string }>>(Prisma.sql`
      SELECT status FROM auth.staff_access_sessions
      WHERE id = ${sessionId} AND actor_user_id = ${owner.id} AND expires_at > NOW()
    `);
    if (rows[0]?.status === 'ACTIVE') await access.endSession(owner, sessionId, reason);
  }

  it.each([
    'grant_revoked', 'grant_revocation_marker', 'grant_expired', 'grant_not_started',
    'assignment_expired', 'assignment_not_started', 'assignment_revocation_marker',
    'grant_foreign_grantee', 'assignment_foreign_actor', 'session_scope_mismatch',
    'session_permission_exceeds_grant',
    'assignment_role_downgrade', 'linked_mode_ceiling', 'unknown_permission', 'duplicate_permission',
  ] as const)('denies exact linked authority %s despite another qualifying assignment', async (fault) => {
    const otherAssignment = `sta-other-valid-${randomUUID()}`;
    const savedAssignments = await adminPrisma.$queryRaw<Array<{
      user_id: string; role: StaffRole; valid_from: Date; valid_until: Date | null; revoked_at: Date | null;
    }>>(Prisma.sql`SELECT user_id, role, valid_from, valid_until, revoked_at FROM auth.staff_assignments WHERE id = ${ids.ownerAssignment}`);
    const saved = savedAssignments[0]; if (!saved) throw new Error('Owner assignment fixture is required');
    let current: Awaited<ReturnType<StaffAccessService['activateGrant']>> | undefined;
    try {
      await adminPrisma.$executeRaw(Prisma.sql`
        INSERT INTO auth.staff_assignments (id, user_id, role, status, valid_from, valid_until, reason)
        VALUES (${otherAssignment}, ${owner.id}, 'PLATFORM_ADMIN', 'ACTIVE', NOW() - INTERVAL '1 minute',
          NOW() + INTERVAL '1 hour', 'Isolated alternate qualifying assignment')
      `);
      const grantId = await ownerViewGrant(`OWN-E2E-LINKED-${fault}`);
      current = await access.activateGrant(owner, grantId);
      await expect(access.resolveAccessSession(owner, current.accessToken)).resolves.toMatchObject({ accessSessionId: current.accessSessionId });
      if (fault === 'grant_revoked') {
        await adminPrisma.$executeRaw(Prisma.sql`UPDATE auth.staff_access_grants SET status = 'REVOKED', revoked_at = NOW() WHERE id = ${grantId}`);
      } else if (fault === 'grant_revocation_marker') {
        await adminPrisma.$executeRaw(Prisma.sql`UPDATE auth.staff_access_grants SET revoked_at = NOW() WHERE id = ${grantId}`);
      } else if (fault === 'grant_expired') {
        await adminPrisma.$executeRaw(Prisma.sql`UPDATE auth.staff_access_grants SET starts_at = NOW() - INTERVAL '1 hour', expires_at = NOW() - INTERVAL '1 second' WHERE id = ${grantId}`);
      } else if (fault === 'grant_not_started') {
        await adminPrisma.$executeRaw(Prisma.sql`UPDATE auth.staff_access_grants SET starts_at = NOW() + INTERVAL '1 minute' WHERE id = ${grantId}`);
      } else if (fault === 'assignment_expired') {
        await adminPrisma.$executeRaw(Prisma.sql`UPDATE auth.staff_assignments SET valid_from = NOW() - INTERVAL '1 day', valid_until = NOW() - INTERVAL '1 second' WHERE id = ${ids.ownerAssignment}`);
      } else if (fault === 'assignment_not_started') {
        await adminPrisma.$executeRaw(Prisma.sql`UPDATE auth.staff_assignments SET valid_from = NOW() + INTERVAL '1 hour', valid_until = NULL WHERE id = ${ids.ownerAssignment}`);
      } else if (fault === 'assignment_revocation_marker') {
        await adminPrisma.$executeRaw(Prisma.sql`UPDATE auth.staff_assignments SET revoked_at = NOW() WHERE id = ${ids.ownerAssignment}`);
      } else if (fault === 'grant_foreign_grantee') {
        await adminPrisma.$executeRaw(Prisma.sql`UPDATE auth.staff_access_grants SET grantee_user_id = ${admin.id} WHERE id = ${grantId}`);
      } else if (fault === 'assignment_foreign_actor') {
        await adminPrisma.$executeRaw(Prisma.sql`UPDATE auth.staff_assignments SET user_id = ${admin.id} WHERE id = ${ids.ownerAssignment}`);
      } else if (fault === 'session_scope_mismatch') {
        await adminPrisma.$executeRaw(Prisma.sql`UPDATE auth.staff_access_sessions SET effective_organization_id = ${ids.otherOrg} WHERE id = ${current.accessSessionId}`);
      } else if (fault === 'assignment_role_downgrade') {
        // Canonical triggers revoke linked grants/sessions on a role change.
        // The service's corrupt-linked-role ceiling is covered by its unit suite.
        await adminPrisma.$executeRaw(Prisma.sql`UPDATE auth.staff_assignments SET role = 'SUPPORT_L1' WHERE id = ${ids.ownerAssignment}`);
      } else if (fault === 'linked_mode_ceiling') {
        // Keep the session/grant mode equal so the service's own mode ceiling,
        // rather than just a mismatched pair, must reject critical permissions.
        const permissions = JSON.stringify([StaffPermission.CRITICAL_ACTION_REQUEST]);
        await adminPrisma.$executeRaw(Prisma.sql`UPDATE auth.staff_access_grants SET access_mode = 'VIEW_AS', permissions = ${permissions}::jsonb WHERE id = ${grantId}`);
        await adminPrisma.$executeRaw(Prisma.sql`UPDATE auth.staff_access_sessions SET access_mode = 'VIEW_AS', permissions = ${permissions}::jsonb WHERE id = ${current.accessSessionId}`);
      } else if (fault === 'unknown_permission' || fault === 'duplicate_permission') {
        const permissions = JSON.stringify(fault === 'unknown_permission'
          ? [StaffPermission.CABINET_VIEW_AS, StaffPermission.DEAL_READ, 'unknown:permission']
          : [StaffPermission.CABINET_VIEW_AS, StaffPermission.DEAL_READ, StaffPermission.DEAL_READ]);
        // Both arrays agree: a permission subset alone must not turn unknown
        // or duplicate permission values into valid current authority.
        await adminPrisma.$executeRaw(Prisma.sql`UPDATE auth.staff_access_grants SET permissions = ${permissions}::jsonb WHERE id = ${grantId}`);
        await adminPrisma.$executeRaw(Prisma.sql`UPDATE auth.staff_access_sessions SET permissions = ${permissions}::jsonb WHERE id = ${current.accessSessionId}`);
      } else {
        await adminPrisma.$executeRaw(Prisma.sql`UPDATE auth.staff_access_sessions SET permissions = permissions || '["critical-action:request"]'::jsonb WHERE id = ${current.accessSessionId}`);
      }
      const enriched = await access.enrichActor(owner);
      expect(enriched.staffRoles).toContain(StaffRole.PLATFORM_ADMIN);
      const rows = await adminPrisma.$queryRaw<Array<{ status: string; last_seen_at: Date | null }>>(Prisma.sql`
        SELECT status, last_seen_at FROM auth.staff_access_sessions WHERE id = ${current.accessSessionId}
      `);
      expect(rows[0]?.status).toBe(fault === 'assignment_role_downgrade' ? 'REVOKED' : 'ACTIVE');
      if (fault === 'assignment_role_downgrade') {
        const grants = await adminPrisma.$queryRaw<Array<{ status: string; revoked_at: Date | null }>>(Prisma.sql`
          SELECT status, revoked_at FROM auth.staff_access_grants WHERE id = ${grantId}
        `);
        expect(grants[0]?.status).toBe('REVOKED');
        expect(grants[0]?.revoked_at).toBeInstanceOf(Date);
      }
      await expect(access.resolveAccessSession(enriched, current.accessToken)).rejects.toMatchObject({ status: 401 });
      const after = await adminPrisma.$queryRaw<Array<{ last_seen_at: Date | null }>>(Prisma.sql`
        SELECT last_seen_at FROM auth.staff_access_sessions WHERE id = ${current.accessSessionId}
      `);
      expect(after[0]?.last_seen_at).toEqual(rows[0]?.last_seen_at);
    } finally {
      try {
        if (current) await endOwnSessionIfActive(current.accessSessionId, 'Completed isolated linked-authority fault');
      } finally {
        try {
          await adminPrisma.$executeRaw(Prisma.sql`
            UPDATE auth.staff_assignments SET user_id = ${saved.user_id}, role = ${saved.role}, valid_from = ${saved.valid_from},
              valid_until = ${saved.valid_until}, revoked_at = ${saved.revoked_at} WHERE id = ${ids.ownerAssignment}
          `);
        } finally {
          await adminPrisma.$executeRaw(Prisma.sql`DELETE FROM auth.staff_assignments WHERE id = ${otherAssignment}`);
        }
      }
    }
  });

  it('bounds a valid session context to its shortened linked assignment expiry', async () => {
    const grantId = await ownerViewGrant('OWN-E2E-LINKED-EXPIRY-BOUND');
    const current = await access.activateGrant(owner, grantId);
    const saved = await adminPrisma.$queryRaw<Array<{ valid_until: Date | null }>>(Prisma.sql`
      SELECT valid_until FROM auth.staff_assignments WHERE id = ${ids.ownerAssignment}
    `);
    try {
      const rows = await adminPrisma.$queryRaw<Array<{ valid_until: Date }>>(Prisma.sql`
        UPDATE auth.staff_assignments SET valid_until = NOW() + INTERVAL '1 minute'
        WHERE id = ${ids.ownerAssignment} RETURNING valid_until
      `);
      const context = await access.resolveAccessSession(owner, current.accessToken);
      expect(context.expiresAt.getTime()).toBe(rows[0]!.valid_until.getTime());
      expect(context.expiresAt.getTime()).toBeLessThan(new Date(current.expiresAt).getTime());
    } finally {
      await access.endSession(owner, current.accessSessionId, 'Completed isolated linked expiry bound');
      await adminPrisma.$executeRaw(Prisma.sql`UPDATE auth.staff_assignments SET valid_until = ${saved[0]!.valid_until} WHERE id = ${ids.ownerAssignment}`);
    }
  });

  it.each(['endSession', 'revokeSession'] as const)('rolls back %s if its audit insert fails, then commits one audited retry', async (method) => {
    const grantId = await ownerViewGrant(`OWN-E2E-AUDIT-${method}`);
    const current = await access.activateGrant(owner, grantId);
    const operator = method === 'endSession' ? owner : admin;
    const failCorrelation = `corr-audit-fail-${method}`;
    const retryCorrelation = `corr-audit-retry-${method}`;
    const fault = new Error('Isolated PostgreSQL audit-insertion fault');
    // Only the audit insertion is faulted; the real Prisma transaction and
    // production session update must establish rollback in PostgreSQL.
    const insertion = jest.spyOn(repository, 'insertEvent').mockRejectedValueOnce(fault);
    try {
      await expect(access[method](operator, current.accessSessionId, 'Audit failure regression', failCorrelation)).rejects.toBe(fault);
      const rows = await prisma.$queryRaw<Array<{ status: string; ended_at: Date | null }>>(Prisma.sql`
        SELECT status, ended_at FROM auth.staff_access_sessions WHERE id = ${current.accessSessionId}
      `);
      expect(rows).toEqual([{ status: 'ACTIVE', ended_at: null }]);
      await expect(access.resolveAccessSession(owner, current.accessToken)).resolves.toMatchObject({ accessSessionId: current.accessSessionId });
      insertion.mockRestore();
      await expect(access[method](operator, current.accessSessionId, 'Audited lifecycle retry', retryCorrelation)).resolves.toMatchObject({ success: true });
      const ended = await prisma.$queryRaw<Array<{ status: string }>>(Prisma.sql`
        SELECT status FROM auth.staff_access_sessions WHERE id = ${current.accessSessionId}
      `);
      expect(ended).toEqual([{ status: 'ENDED' }]);
      const events = await prisma.$queryRaw<Array<{ correlation_id: string }>>(Prisma.sql`
        SELECT correlation_id FROM auth.staff_access_events
        WHERE access_session_id = ${current.accessSessionId}
          AND correlation_id IN (${failCorrelation}, ${retryCorrelation})
          AND outcome = 'SUCCESS'
      `);
      expect(events).toEqual([{ correlation_id: retryCorrelation }]);
      await expect(access.resolveAccessSession(owner, current.accessToken)).rejects.toBeTruthy();
    } finally {
      insertion.mockRestore();
      const rows = await repository.listActiveSessions(prisma, owner.id);
      if (rows.some((row) => row.id === current.accessSessionId)) {
        await access.endSession(owner, current.accessSessionId, 'Completed isolated audit-failure test');
      }
    }
  });

  it('commits only one audited completion when ending and revoking the same session from two PostgreSQL connections', async () => {
    const current = await access.activateGrant(owner, await ownerViewGrant('OWN-E2E-LIFECYCLE-RACE'));
    const peerPrisma = new AuthPrismaService();
    const backendPids = new Set<number>();
    let arrivals = 0;
    let release!: () => void;
    let failBarrier!: (error: Error) => void;
    const barrier = new Promise<void>((resolve, reject) => { release = resolve; failBarrier = reject; });
    const timer = setTimeout(() => failBarrier(new Error('Two-connection lifecycle barrier timed out')), 5_000);
    class LifecycleBarrierRepository extends StaffRuntimeAccessRepository {
      override async getActiveAccessSession(client: StaffSqlClient, id: string, actorId?: string) {
        if (id === current.accessSessionId && arrivals < 2) {
          const pids = await client.$queryRaw<Array<{ pid: number }>>(Prisma.sql`SELECT pg_backend_pid() AS pid`);
          backendPids.add(pids[0].pid); arrivals++;
          if (arrivals === 2) release();
          await barrier;
        }
        return super.getActiveAccessSession(client, id, actorId);
      }
    }
    const first = new StaffAccessService(new LifecycleBarrierRepository(prisma, staffPrisma));
    const second = new StaffAccessService(new LifecycleBarrierRepository(peerPrisma, staffPrisma));
    try {
      await peerPrisma.$connect();
      const results = await Promise.allSettled([
        first.endSession(owner, current.accessSessionId, 'Concurrent own end', 'corr-lifecycle-race-end'),
        second.revokeSession(admin, current.accessSessionId, 'Concurrent operator revoke', 'corr-lifecycle-race-revoke'),
      ]);
      clearTimeout(timer);
      expect(arrivals).toBe(2); expect(backendPids.size).toBe(2);
      const fulfilled = results.filter((row) => row.status === 'fulfilled');
      const rejected = results.filter((row): row is PromiseRejectedResult => row.status === 'rejected');
      expect(fulfilled).toHaveLength(1); expect(rejected).toHaveLength(1);
      expect([404, 409]).toContain(rejected[0].reason.getStatus());
      if (rejected[0].reason.getStatus() === 409) {
        expect(rejected[0].reason.getResponse()).toMatchObject({ code: 'STAFF_SESSION_LIFECYCLE_CONFLICT', retryable: true });
      }
      const events = await prisma.$queryRaw<Array<{ count: number }>>(Prisma.sql`
        SELECT COUNT(*)::int AS count FROM auth.staff_access_events
        WHERE access_session_id = ${current.accessSessionId}
          AND action IN ('staff.session.end', 'staff.session.revoke') AND outcome = 'SUCCESS'
          AND correlation_id IN ('corr-lifecycle-race-end', 'corr-lifecycle-race-revoke')
      `);
      expect(events[0].count).toBe(1);
      await expect(access.resolveAccessSession(owner, current.accessToken)).rejects.toBeTruthy();
    } finally {
      clearTimeout(timer);
      try {
        const rows = await repository.listActiveSessions(prisma, owner.id);
        if (rows.some((row) => row.id === current.accessSessionId)) await access.endSession(owner, current.accessSessionId, 'Completed isolated lifecycle race');
      } finally { await peerPrisma.$disconnect(); }
    }
  });

  it.each(['endSession', 'revokeSession'] as const)('%s reaches an older exact ID beyond the 200-row display window', async (method) => {
    const grantId = await ownerViewGrant(`OWN-E2E-LEGACY-CAP-${method}`);
    const current = await access.activateGrant(owner, grantId);
    const fillerIds: string[] = [];
    try {
      const grant = await repository.getGrant(prisma, grantId, owner.id);
      if (!grant) throw new Error('Isolated legacy fixture grant must exist');
      // Isolated ADMIN bootstrap models sessions left by the old multi-grant
      // policy. These are never activated through the new exclusive service,
      // never presented as acceptance credentials, and never production data.
      for (let index = 0; index < 200; index++) {
        const id = `sas_legacy_cap_${randomUUID()}`;
        const credential = issueStaffAccessCredential();
        await repository.createAccessSession(adminPrisma, { id, grant, tokenHash: credential.storedDigest, mfaLevel: 'TOTP' });
        fillerIds.push(id);
      }
      const shown = await repository.listActiveSessions(prisma, method === 'endSession' ? owner.id : undefined);
      expect(shown).toHaveLength(200);
      expect(shown.some((row) => row.id === current.accessSessionId)).toBe(false);
      await expect(access[method](method === 'endSession' ? owner : admin, current.accessSessionId, 'Exact legacy target cleanup'))
        .resolves.toMatchObject({ success: true });
      await expect(access.resolveAccessSession(owner, current.accessToken)).rejects.toBeTruthy();
    } finally {
      // Scope cleanup to these inserted fixture IDs. No ambient sessions are
      // rewritten to force this test or production acceptance to pass.
      if (fillerIds.length) await adminPrisma.$executeRaw(Prisma.sql`
        UPDATE auth.staff_access_sessions SET status = 'ENDED', ended_at = NOW(), end_reason = 'ISOLATED_LEGACY_FIXTURE_CLEANUP', updated_at = NOW()
        WHERE id IN (${Prisma.join(fillerIds)}) AND actor_user_id = ${owner.id} AND status = 'ACTIVE'
      `);
      const rows = await repository.listActiveSessions(prisma, owner.id);
      if (rows.some((row) => row.id === current.accessSessionId)) await access.endSession(owner, current.accessSessionId, 'Completed isolated display-window test');
    }
  });

  it('rejects same and different grants with a typed conflict after a cookie-less activation', async () => {
    const firstGrant = await ownerViewGrant('OWN-E2E-EXCLUSIVE-A');
    const otherGrant = await ownerViewGrant('OWN-E2E-EXCLUSIVE-B');
    const active = await access.activateGrant(owner, firstGrant, undefined, undefined, 'corr-exclusive-first');
    try {
      for (const grantId of [firstGrant, otherGrant]) {
        await expect(access.activateGrant(owner, grantId, undefined, undefined, 'corr-exclusive-retry'))
          .rejects.toMatchObject({ response: { code: 'STAFF_ACTIVE_SESSION_CONFLICT' }, status: 409 });
      }
      const sessions = await repository.listActiveSessions(prisma, owner.id);
      expect(sessions).toHaveLength(1);
      expect(sessions[0].id).toBe(active.accessSessionId);
      const events = await prisma.$queryRaw<Array<{ count: number }>>(Prisma.sql`
        SELECT COUNT(*)::int AS count FROM auth.staff_access_events
        WHERE actor_user_id = ${owner.id} AND action = 'staff.session.activate'
          AND correlation_id IN ('corr-exclusive-first', 'corr-exclusive-retry')
      `);
      expect(events[0].count).toBe(1);
    } finally {
      await access.endSession(owner, active.accessSessionId, 'Completed isolated exclusivity test');
    }
  });

  it('allows only one different-grant activation when two PostgreSQL connections read the empty actor concurrently', async () => {
    const grants = [await ownerViewGrant('OWN-E2E-RACE-A'), await ownerViewGrant('OWN-E2E-RACE-B')];
    const peerPrisma = new AuthPrismaService();
    await peerPrisma.$connect();
    const backendPids = new Set<number>();
    let arrivals = 0;
    let release!: () => void;
    let failBarrier!: (error: Error) => void;
    const barrier = new Promise<void>((resolve, reject) => { release = resolve; failBarrier = reject; });
    let commitWinner!: () => void;
    let failWinner!: (error: Error) => void;
    const winnerCommitted = new Promise<void>((resolve, reject) => { commitWinner = resolve; failWinner = reject; });
    let serializationAborts = 0;
    let retriesAfterWinnerCommit = 0;
    // Attach rejection handlers before either barrier is awaited. A broken
    // schedule must fail within the bound rather than leave a transaction open.
    void barrier.catch(() => undefined);
    void winnerCommitted.catch(() => undefined);
    const timer = setTimeout(() => {
      const error = new Error('Two-connection activation schedule timed out');
      failBarrier(error);
      failWinner(error);
    }, 5_000);
    class BarrierRepository extends StaffRuntimeAccessRepository {
      override async transaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
        try {
          const result = await super.transaction(work);
          // $transaction resolves only after the real PostgreSQL commit.
          commitWinner();
          return result;
        } catch (error) {
          if (isRetryableTransactionConflict(error)) {
            serializationAborts += 1;
            // Keep the first-attempt empty-read race real. Only its aborted
            // loser waits here, before the unchanged bounded retry loop starts
            // a fresh snapshot that can observe the committed winner.
            await winnerCommitted;
            retriesAfterWinnerCommit += 1;
          }
          throw error;
        }
      }

      override async hasActiveSession(client: StaffSqlClient, actorUserId: string): Promise<boolean> {
        const active = await super.hasActiveSession(client, actorUserId);
        if (actorUserId === owner.id && !active && arrivals < 2) {
          const pids = await client.$queryRaw<Array<{ pid: number }>>(Prisma.sql`SELECT pg_backend_pid() AS pid`);
          backendPids.add(pids[0].pid);
          arrivals += 1;
          if (arrivals === 2) release();
          await barrier;
        }
        return active;
      }
    }
    const first = new StaffAccessService(new BarrierRepository(prisma, staffPrisma));
    const second = new StaffAccessService(new BarrierRepository(peerPrisma, staffPrisma));
    let winnerSessionId: string | null = null;
    const createdSessionIds: string[] = [];
    try {
      const results = await Promise.allSettled([
        first.activateGrant(owner, grants[0], undefined, undefined, 'corr-race-a'),
        second.activateGrant(owner, grants[1], undefined, undefined, 'corr-race-b'),
      ]);
      clearTimeout(timer);
      const fulfilled = results.filter((row): row is PromiseFulfilledResult<Awaited<ReturnType<StaffAccessService['activateGrant']>>> => row.status === 'fulfilled');
      const rejected = results.filter((row): row is PromiseRejectedResult => row.status === 'rejected');
      createdSessionIds.push(...fulfilled.map((row) => row.value.accessSessionId));
      if (fulfilled.length === 1) winnerSessionId = fulfilled[0].value.accessSessionId;
      expect(arrivals).toBe(2);
      expect(backendPids.size).toBe(2);
      expect(serializationAborts).toBe(1);
      expect(retriesAfterWinnerCommit).toBe(1);
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0].reason).toMatchObject({ response: { code: 'STAFF_ACTIVE_SESSION_CONFLICT' }, status: 409 });
      const loserIndex = results.findIndex((row) => row.status === 'rejected');
      await expect([first, second][loserIndex].activateGrant(
        owner, grants[loserIndex], undefined, undefined, 'corr-race-after-settle',
      )).rejects.toMatchObject({ response: { code: 'STAFF_ACTIVE_SESSION_CONFLICT' }, status: 409 });
      const sessions = await repository.listActiveSessions(prisma, owner.id);
      expect(sessions).toHaveLength(1);
      expect(sessions[0].id).toBe(winnerSessionId);
      const events = await prisma.$queryRaw<Array<{ count: number }>>(Prisma.sql`
        SELECT COUNT(*)::int AS count FROM auth.staff_access_events
        WHERE actor_user_id = ${owner.id} AND action = 'staff.session.activate'
          AND correlation_id IN ('corr-race-a', 'corr-race-b')
      `);
      expect(events[0].count).toBe(1);
      const durableSessions = await prisma.$queryRaw<Array<{ count: number }>>(Prisma.sql`
        SELECT COUNT(*)::int AS count FROM auth.staff_access_sessions
        WHERE actor_user_id = ${owner.id} AND grant_id IN (${Prisma.join(grants)})
      `);
      expect(durableSessions[0].count).toBe(1);
      const loserCorrelationId = loserIndex === 0 ? 'corr-race-a' : 'corr-race-b';
      const loserEvents = await prisma.$queryRaw<Array<{ count: number }>>(Prisma.sql`
        SELECT COUNT(*)::int AS count FROM auth.staff_access_events
        WHERE actor_user_id = ${owner.id} AND action = 'staff.session.activate'
          AND correlation_id IN (${loserCorrelationId}, 'corr-race-after-settle')
      `);
      expect(loserEvents[0].count).toBe(0);
    } finally {
      clearTimeout(timer);
      release();
      commitWinner();
      for (const sessionId of createdSessionIds) {
        await access.endSession(owner, sessionId, 'Completed isolated two-connection race');
      }
      await peerPrisma.$disconnect();
    }
  });

  it.each(['ended', 'revoked', 'expired'] as const)('permits a fresh grant after the previous actor session is %s', async (lifecycle) => {
    const firstGrant = await ownerViewGrant(`OWN-E2E-${lifecycle}-A`);
    const otherGrant = await ownerViewGrant(`OWN-E2E-${lifecycle}-B`);
    let previous: Awaited<ReturnType<StaffAccessService['activateGrant']>> | undefined;
    let fresh: Awaited<ReturnType<StaffAccessService['activateGrant']>> | undefined;
    try {
      previous = await access.activateGrant(owner, firstGrant, undefined, undefined, `corr-${lifecycle}-before`);
      if (lifecycle === 'ended') {
        await access.endSession(owner, previous.accessSessionId, 'Isolated session end');
      } else if (lifecycle === 'revoked') {
        await access.revokeSession(admin, previous.accessSessionId, 'Isolated session revocation');
      } else {
        // A consistent past interval respects the real database CHECK constraint.
        // Only this disposable fixture is aged; no production constraint is relaxed.
        await adminPrisma.$executeRaw(Prisma.sql`
          UPDATE auth.staff_access_sessions
          SET started_at = NOW() - INTERVAL '1 minute', expires_at = NOW() - INTERVAL '1 second'
          WHERE id = ${previous.accessSessionId} AND actor_user_id = ${owner.id}
        `);
      }
      fresh = await access.activateGrant(owner, otherGrant, undefined, undefined, `corr-${lifecycle}-after`);
      const sessions = await repository.listActiveSessions(prisma, owner.id);
      expect(sessions).toHaveLength(1);
      expect(sessions[0].id).toBe(fresh.accessSessionId);
      await expect(access.resolveAccessSession(owner, previous.accessToken)).rejects.toBeTruthy();
    } finally {
      try {
        if (fresh) await endOwnSessionIfActive(fresh.accessSessionId, 'Completed isolated lifecycle test');
      } finally {
        if (previous) await endOwnSessionIfActive(previous.accessSessionId, 'Completed isolated prior lifecycle');
      }
    }
  });

  it('requires two distinct approvers for owner JIT and rejects self-approval', async () => {
    const requested = await access.requestAccess(owner, {
      assignmentId: ids.ownerAssignment,
      accessMode: StaffAccessMode.JIT_PRIVILEGED,
      permissions: [StaffPermission.DIAGNOSTIC_READ, StaffPermission.CRITICAL_ACTION_REQUEST],
      targetTenantId: 'tenant-staff-platform-e2e',
      targetOrganizationId: ids.platformOrg,
      reason: 'Investigate a controlled production-like incident',
      ticketId: 'INC-E2E-JIT',
      durationSeconds: 900,
    });
    expect(requested.status).toBe('PENDING');

    await expect(access.decideRequest(owner, requested.requestId, {
      decision: 'APPROVE',
      reason: 'Owner self approval must be rejected',
    })).rejects.toBeInstanceOf(ForbiddenException);

    const first = await access.decideRequest(admin, requested.requestId, {
      decision: 'APPROVE',
      reason: 'First independent approval for JIT access',
    });
    expect(first.status).toBe('PENDING');
    expect(first.approvalCount).toBe(1);

    const second = await access.decideRequest(supervisor, requested.requestId, {
      decision: 'APPROVE',
      reason: 'Second independent approval for JIT access',
    });
    expect(second.status).toBe('GRANTED');
    expect(second.grantId).toBeTruthy();

    const activated = await access.activateGrant(owner, second.grantId!, 'staff-access-e2e', '127.0.0.1');
    const context = await access.resolveAccessSession(owner, activated.accessToken);

    const critical = await access.requestCriticalAction(owner, context, {
      action: 'feature-flag:write',
      resourceType: 'feature_flag',
      resourceId: 'flag-e2e',
      payload: { enabled: false, version: 4 },
    });
    expect(critical.requiredApprovals).toBe(2);

    const approvalOne = await access.approveCriticalAction(admin, critical.criticalRequestId, {
      decision: 'APPROVE',
      reason: 'First independent critical action approval',
    });
    expect(approvalOne.status).toBe('PENDING');

    const approvalTwo = await access.approveCriticalAction(supervisor, critical.criticalRequestId, {
      decision: 'APPROVE',
      reason: 'Second independent critical action approval',
    });
    expect(approvalTwo.status).toBe('APPROVED');

    await expect(access.consumeCriticalAction(owner, context, critical.criticalRequestId, {
      enabled: true,
      version: 4,
    })).rejects.toBeInstanceOf(ForbiddenException);

    const consumed = await access.consumeCriticalAction(owner, context, critical.criticalRequestId, {
      enabled: false,
      version: 4,
    });
    expect(consumed.success).toBe(true);

    await expect(access.consumeCriticalAction(owner, context, critical.criticalRequestId, {
      enabled: false,
      version: 4,
    })).rejects.toBeInstanceOf(ConflictException);
  });

  it('limits break-glass to fifteen minutes and requires post-incident review', async () => {
    const activated = await access.activateBreakGlass(sre, {
      assignmentId: ids.sreAssignment,
      reason: 'Restore service during an isolated production-like incident',
      ticketId: 'INC-E2E-BG',
    }, 'corr-break-glass');
    const duration = new Date(activated.expiresAt).getTime() - Date.now();
    expect(duration).toBeGreaterThan(0);
    expect(duration).toBeLessThanOrEqual(15 * 60 * 1000);

    await expect(prisma.$executeRaw(Prisma.sql`
      INSERT INTO auth.break_glass_activations (
        id, actor_user_id, assignment_id, reason, ticket_id, started_at, expires_at, notification_correlation_id
      ) VALUES (
        'bga-invalid-e2e', ${ids.sre}, ${ids.sreAssignment},
        'This invalid activation exceeds the maximum duration', 'INC-E2E-BG-BAD',
        NOW(), NOW() + INTERVAL '16 minutes', 'corr-invalid-break-glass'
      )
    `)).rejects.toBeTruthy();
  });

  it('keeps staff audit append-only and hash-chain verifiable', async () => {
    const verified = await audit.verifyActorChain(owner, ids.owner, 10_000);
    expect(verified.valid).toBe(true);
    expect(verified.checked).toBeGreaterThan(0);

    await expect(prisma.$executeRaw(Prisma.sql`
      UPDATE auth.staff_access_events
      SET action = 'tampered'
      WHERE actor_user_id = ${ids.owner}
    `)).rejects.toBeTruthy();

    await expect(prisma.$executeRaw(Prisma.sql`
      DELETE FROM auth.staff_access_events
      WHERE actor_user_id = ${ids.owner}
    `)).rejects.toBeTruthy();
  });

  it('revokes every active grant and delegated session when a staff assignment is revoked', async () => {
    // Build both terminal history and a live session explicitly, including when
    // this case is selected alone. Earlier successful JIT sessions are ended via
    // the ordinary audited lifecycle rather than directly rewriting their state.
    for (const session of await repository.listActiveSessions(prisma, owner.id)) {
      await access.endSession(owner, session.id, 'Prepare isolated assignment revocation');
    }
    const historicalGrant = await ownerViewGrant('OWN-E2E-REVOKE-HISTORY');
    const historical = await access.activateGrant(owner, historicalGrant);
    await access.endSession(owner, historical.accessSessionId, 'Preserve terminal history during assignment revocation');
    const activeGrant = await ownerViewGrant('OWN-E2E-REVOKE-ACTIVE');
    const active = await access.activateGrant(owner, activeGrant);
    await expect(access.resolveAccessSession(owner, active.accessToken)).resolves.toMatchObject({
      accessSessionId: active.accessSessionId,
    });
    const beforeGrants = await prisma.$queryRaw<Array<{ id: string; status: string }>>(Prisma.sql`
      SELECT id, status FROM auth.staff_access_grants WHERE assignment_id = ${ids.ownerAssignment}
    `);
    const beforeSessions = await prisma.$queryRaw<Array<{ id: string; status: string }>>(Prisma.sql`
      SELECT s.id, s.status
      FROM auth.staff_access_sessions s
      JOIN auth.staff_access_grants g ON g.id = s.grant_id
      WHERE g.assignment_id = ${ids.ownerAssignment}
    `);
    expect(beforeGrants.some((row) => row.id === activeGrant && row.status === 'ACTIVE')).toBe(true);
    expect(beforeSessions.some((row) => row.id === active.accessSessionId && row.status === 'ACTIVE')).toBe(true);
    expect(beforeSessions.some((row) => row.id === historical.accessSessionId && row.status === 'ENDED')).toBe(true);

    await prisma.$executeRaw(Prisma.sql`
      UPDATE auth.staff_assignments
      SET status = 'REVOKED', revoked_at = NOW(), updated_at = NOW()
      WHERE id = ${ids.ownerAssignment}
    `);

    const grants = await prisma.$queryRaw<Array<{ id: string; status: string }>>(Prisma.sql`
      SELECT id, status FROM auth.staff_access_grants WHERE assignment_id = ${ids.ownerAssignment}
    `);
    const sessions = await prisma.$queryRaw<Array<{ id: string; status: string }>>(Prisma.sql`
      SELECT s.id, s.status
      FROM auth.staff_access_sessions s
      JOIN auth.staff_access_grants g ON g.id = s.grant_id
      WHERE g.assignment_id = ${ids.ownerAssignment}
    `);
    expect(grants).toHaveLength(beforeGrants.length);
    expect(sessions).toHaveLength(beforeSessions.length);
    for (const before of beforeGrants) {
      expect(grants.find((row) => row.id === before.id)?.status)
        .toBe(before.status === 'ACTIVE' ? 'REVOKED' : before.status);
    }
    for (const before of beforeSessions) {
      expect(sessions.find((row) => row.id === before.id)?.status)
        .toBe(before.status === 'ACTIVE' ? 'REVOKED' : before.status);
    }
    await expect(access.resolveAccessSession(owner, active.accessToken)).rejects.toMatchObject({ status: 401 });
    await expect(access.resolveAccessSession(owner, historical.accessToken)).rejects.toMatchObject({ status: 401 });
    await expect(access.activateGrant(owner, activeGrant)).rejects.toMatchObject({
      status: 409, response: { message: 'Staff grant is not active' },
    });
  });
});
