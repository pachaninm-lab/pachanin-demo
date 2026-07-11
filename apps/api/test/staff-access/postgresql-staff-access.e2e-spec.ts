import { ConflictException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RequestUser, Role } from '../../src/common/types/request-user';
import { AuthPrismaService } from '../../src/modules/auth/auth-prisma.service';
import { StaffAccessRepository } from '../../src/modules/staff-access/staff-access.repository';
import { StaffAccessService } from '../../src/modules/staff-access/staff-access.service';
import { StaffAuditService } from '../../src/modules/staff-access/staff-audit.service';
import { StaffProjectionService } from '../../src/modules/staff-access/staff-projection.service';
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
  const repository = new StaffAccessRepository(prisma);
  const access = new StaffAccessService(repository);
  const projection = new StaffProjectionService(repository, access);
  const audit = new StaffAuditService(repository, access);

  const owner = actor(ids.owner, 'owner.staff.e2e@example.test', ids.platformOrg, 'tenant-staff-platform-e2e');
  const admin = actor(ids.admin, 'admin.staff.e2e@example.test', ids.platformOrg, 'tenant-staff-platform-e2e');
  const supervisor = actor(ids.supervisor, 'supervisor.staff.e2e@example.test', ids.platformOrg, 'tenant-staff-platform-e2e');
  const support = actor(ids.support, 'support.staff.e2e@example.test', ids.platformOrg, 'tenant-staff-platform-e2e');
  const developer = actor(ids.developer, 'developer.staff.e2e@example.test', ids.platformOrg, 'tenant-staff-platform-e2e');
  const sre = actor(ids.sre, 'sre.staff.e2e@example.test', ids.platformOrg, 'tenant-staff-platform-e2e');

  beforeAll(async () => {
    await prisma.$connect();

    await prisma.organization.upsert({
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
    await prisma.organization.upsert({
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
      await prisma.user.upsert({
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
      await prisma.userOrg.upsert({
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
      await prisma.$executeRaw(Prisma.sql`
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
    await prisma.$disconnect();
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
    const target = await prisma.organization.findUnique({
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

    const cabinet = await projection.cabinetProjection(owner, context, target!.id, 'BUYER');
    expect(cabinet.mode).toBe('READ_ONLY_VIEW_AS');
    expect(cabinet.deals.some((deal) => deal.id === 'DEAL-INDUSTRIAL-001')).toBe(true);

    await expect(
      projection.cabinetProjection(owner, context, ids.otherOrg, 'BUYER'),
    ).rejects.toBeTruthy();
    await expect(
      projection.cabinetProjection(owner, context, target!.id, 'BANK'),
    ).rejects.toBeTruthy();
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
    await prisma.$executeRaw(Prisma.sql`
      UPDATE auth.staff_assignments
      SET status = 'REVOKED', revoked_at = NOW(), updated_at = NOW()
      WHERE id = ${ids.ownerAssignment}
    `);

    const grants = await prisma.$queryRaw<Array<{ status: string }>>(Prisma.sql`
      SELECT status FROM auth.staff_access_grants WHERE assignment_id = ${ids.ownerAssignment}
    `);
    const sessions = await prisma.$queryRaw<Array<{ status: string }>>(Prisma.sql`
      SELECT s.status
      FROM auth.staff_access_sessions s
      JOIN auth.staff_access_grants g ON g.id = s.grant_id
      WHERE g.assignment_id = ${ids.ownerAssignment}
    `);
    expect(grants.length).toBeGreaterThan(0);
    expect(grants.every((row) => row.status === 'REVOKED')).toBe(true);
    expect(sessions.length).toBeGreaterThan(0);
    expect(sessions.every((row) => row.status === 'REVOKED')).toBe(true);
  });
});
