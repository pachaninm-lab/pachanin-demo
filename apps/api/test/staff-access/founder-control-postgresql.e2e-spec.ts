import { Prisma, PrismaClient } from '@prisma/client';
import { StaffAuthorityPrismaService } from '../../src/modules/staff-access/staff-authority-prisma.service';
import {
  FounderDecisionQueueRow,
  FounderMetricDrillDownRow,
  FounderMetricRow,
} from '../../src/modules/founder-control/founder-control.types';

const ADMIN_DATABASE_URL = process.env.STAFF_ACCESS_TEST_ADMIN_URL ?? '';

const ids = {
  platformOrg: 'org-founder-r1-3-e2e',
  otherOrg: 'org-founder-r1-3-other-e2e',
  ownerUser: 'user-founder-r1-3-e2e',
  membership: 'membership-founder-r1-3-e2e',
  assignment: 'assignment-founder-r1-3-e2e',
  session: 'session-founder-r1-3-e2e',
  deal: 'deal-founder-r1-3-e2e',
  dispute: 'dispute-founder-r1-3-e2e',
};

describe('R1.3 Founder Control PostgreSQL exploitation gate', () => {
  const staffPrisma = new StaffAuthorityPrismaService();
  const adminPrisma = new PrismaClient(
    ADMIN_DATABASE_URL ? { datasources: { db: { url: ADMIN_DATABASE_URL } } } : undefined,
  );

  beforeAll(async () => {
    if (!ADMIN_DATABASE_URL) {
      throw new Error('STAFF_ACCESS_TEST_ADMIN_URL is required for Founder R1.3 PostgreSQL acceptance.');
    }

    await Promise.all([staffPrisma.onModuleInit(), adminPrisma.$connect()]);

    await adminPrisma.organization.upsert({
      where: { id: ids.platformOrg },
      create: {
        id: ids.platformOrg,
        inn: '990000130001',
        name: 'Founder R1.3 E2E',
        tenantId: 'tenant-founder-r1-3-e2e',
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
        inn: '990000130002',
        name: 'Founder R1.3 Other E2E',
        tenantId: 'tenant-founder-r1-3-other-e2e',
        status: 'ACTIVE',
        kycStatus: 'VERIFIED',
        amlStatus: 'CLEAR',
      },
      update: {},
    });

    await adminPrisma.user.upsert({
      where: { id: ids.ownerUser },
      create: {
        id: ids.ownerUser,
        email: 'founder.r1.3.e2e@example.test',
        fullName: 'Founder R1.3 E2E',
        passwordHash: '$argon2id$v=19$m=65536,t=3,p=1$isolated$founder-r1-3-e2e',
        status: 'ACTIVE',
      },
      update: { status: 'ACTIVE', deletedAt: null },
    });
    await adminPrisma.userOrg.upsert({
      where: {
        userId_organizationId: {
          userId: ids.ownerUser,
          organizationId: ids.platformOrg,
        },
      },
      create: {
        id: ids.membership,
        userId: ids.ownerUser,
        organizationId: ids.platformOrg,
        role: 'ADMIN',
        isDefault: true,
      },
      update: { role: 'ADMIN' },
    });

    await adminPrisma.$executeRaw(Prisma.sql`
      INSERT INTO auth.credential_states (
        user_id, credential_version, mfa_enabled, created_at, updated_at
      ) VALUES (
        ${ids.ownerUser}, 1, true, NOW(), NOW()
      )
      ON CONFLICT (user_id) DO UPDATE
      SET credential_version = EXCLUDED.credential_version,
          mfa_enabled = true,
          updated_at = NOW()
    `);

    await adminPrisma.$executeRaw(Prisma.sql`
      INSERT INTO auth.staff_assignments (
        id, user_id, role, status, activated_at, granted_by_user_id, reason
      ) VALUES (
        ${ids.assignment}, ${ids.ownerUser}, 'PLATFORM_OWNER', 'ACTIVE',
        NOW(), ${ids.ownerUser}, 'R1.3 Founder PostgreSQL acceptance fixture'
      )
      ON CONFLICT (id) DO UPDATE
      SET status = 'ACTIVE',
          suspended_at = NULL,
          revoked_at = NULL,
          valid_from = NOW() - INTERVAL '1 minute',
          valid_until = NULL,
          activated_at = NOW(),
          updated_at = NOW()
    `);

    await adminPrisma.$executeRaw(Prisma.sql`
      INSERT INTO auth.sessions (
        id, user_id, membership_id, organization_id, tenant_id,
        status, refresh_family_id, credential_version, mfa_level,
        mfa_verified_at, mfa_verified_method, expires_at
      ) VALUES (
        ${ids.session}, ${ids.ownerUser}, ${ids.membership}, ${ids.platformOrg},
        'tenant-founder-r1-3-e2e', 'ACTIVE', 'family-founder-r1-3-e2e',
        1, 'TOTP', NOW(), 'TOTP', NOW() + INTERVAL '30 minutes'
      )
      ON CONFLICT (id) DO UPDATE
      SET status = 'ACTIVE',
          credential_version = 1,
          mfa_level = 'TOTP',
          mfa_verified_at = NOW(),
          mfa_verified_method = 'TOTP',
          expires_at = NOW() + INTERVAL '30 minutes',
          revoked_at = NULL,
          revocation_reason = NULL,
          updated_at = NOW()
    `);

    await adminPrisma.deal.upsert({
      where: { id: ids.deal },
      create: {
        id: ids.deal,
        tenantId: 'tenant-founder-r1-3-e2e',
        sellerOrgId: ids.platformOrg,
        buyerOrgId: ids.otherOrg,
        status: 'DRAFT',
        currency: 'RUB',
      },
      update: { status: 'DRAFT' },
    });

    await adminPrisma.$executeRaw(Prisma.sql`
      INSERT INTO dispute.cases (
        id, tenant_id, deal_id, status, type, description,
        initiator_org_id, initiator_user_id, respondent_org_id,
        claim_amount_minor, currency, severity, owner_user_id, owner_org_id,
        sla_deadline, version
      ) VALUES (
        ${ids.dispute}, 'tenant-founder-r1-3-e2e', ${ids.deal}, 'OPEN',
        'FOUNDER_R1_3_ACCEPTANCE', 'R1.3 deterministic P0 acceptance fixture',
        ${ids.platformOrg}, ${ids.ownerUser}, ${ids.otherOrg},
        500000, 'RUB', 'CRITICAL', NULL, NULL,
        NOW() + INTERVAL '5 minutes', 3
      )
      ON CONFLICT (id) DO UPDATE
      SET status = 'OPEN',
          severity = 'CRITICAL',
          owner_user_id = NULL,
          owner_org_id = NULL,
          sla_deadline = NOW() + INTERVAL '5 minutes',
          version = 3,
          updated_at = NOW()
    `);
  });

  afterAll(async () => {
    await Promise.allSettled([
      staffPrisma.onModuleDestroy(),
      adminPrisma.$disconnect(),
    ]);
  });

  it('exposes five real PostgreSQL Company Health metrics through the staff function surface only', async () => {
    const privilege = await adminPrisma.$queryRaw<Array<{
      direct_deals: boolean;
      exported_health: boolean;
      internal_authorizer: boolean;
    }>>(Prisma.sql`
      SELECT
        has_table_privilege('one_deal_staff', 'public.deals', 'SELECT') AS direct_deals,
        has_function_privilege(
          'one_deal_staff',
          'auth.founder_company_health(text,text)',
          'EXECUTE'
        ) AS exported_health,
        has_function_privilege(
          'one_deal_staff',
          'auth.founder_control_actor_authorized(text,text)',
          'EXECUTE'
        ) AS internal_authorizer
    `);
    expect(privilege[0]).toEqual({
      direct_deals: false,
      exported_health: true,
      internal_authorizer: false,
    });

    const rows = await staffPrisma.$queryRaw<FounderMetricRow[]>(Prisma.sql`
      SELECT *
      FROM auth.founder_company_health(${ids.ownerUser}, ${ids.session})
    `);

    expect(rows).toHaveLength(5);
    expect(rows.map((row) => row.metric_id).sort()).toEqual([
      'business.open_deals',
      'finance.unmatched_statement_entries',
      'operations.active_shipments',
      'risk.high_critical_open_disputes',
      'system.outbox_attention_entries',
    ]);
    for (const row of rows) {
      expect(typeof row.value_count).toBe('bigint');
      expect(row.value_count).toBeGreaterThanOrEqual(0n);
      expect(row.freshness_state).toBe('CURRENT');
      expect(row.as_of).toBeInstanceOf(Date);
      expect(row.source_relation).toMatch(/^(public|dispute)\./);
      expect(row.grain.length).toBeGreaterThan(0);
      expect(row.definition.length).toBeGreaterThan(0);
    }
    expect(
      rows.find((row) => row.metric_id === 'business.open_deals')!.value_count,
    ).toBeGreaterThanOrEqual(1n);
    expect(
      rows.find((row) => row.metric_id === 'risk.high_critical_open_disputes')!.value_count,
    ).toBeGreaterThanOrEqual(1n);
  });

  it('drills down to the canonical test objects without exposing arbitrary payloads', async () => {
    const deals = await staffPrisma.$queryRaw<FounderMetricDrillDownRow[]>(Prisma.sql`
      SELECT *
      FROM auth.founder_metric_drilldown(
        ${ids.ownerUser},
        ${ids.session},
        'business.open_deals',
        100
      )
    `);
    const operations = await staffPrisma.$queryRaw<FounderMetricDrillDownRow[]>(Prisma.sql`
      SELECT *
      FROM auth.founder_metric_drilldown(
        ${ids.ownerUser},
        ${ids.session},
        'operations.active_shipments',
        100
      )
    `);

    expect(deals.some((row) => row.object_id === ids.deal && row.tenant_id === 'tenant-founder-r1-3-e2e')).toBe(true);
    expect(Array.isArray(operations)).toBe(true);
    expect(operations.every((row) => row.metric_id === 'operations.active_shipments')).toBe(true);
  });

  it('returns a stable P0 queue item with real SLA, impact, next action, escalation and source', async () => {
    const rows = await staffPrisma.$queryRaw<FounderDecisionQueueRow[]>(Prisma.sql`
      SELECT *
      FROM auth.founder_decision_queue(${ids.ownerUser}, ${ids.session}, 100)
    `);
    const item = rows.find((row) => row.object_id === ids.dispute);

    expect(item).toBeDefined();
    expect(item).toMatchObject({
      item_id: `dispute:${ids.dispute}:v3`,
      object_type: 'DISPUTE',
      object_id: ids.dispute,
      object_version: '3',
      priority: 'P0',
      owner_kind: 'UNASSIGNED',
      owner_id: null,
      next_action: 'ASSIGN_AND_TRIAGE',
      escalation: 'ASSIGN_OWNER',
      source_relation: 'dispute.cases',
      source_ref: `dispute.cases/${ids.dispute}`,
      freshness_state: 'CURRENT',
    });
    expect(item!.deadline).toBeInstanceOf(Date);
    expect(item!.as_of).toBeInstanceOf(Date);
    expect(item!.impact).toEqual(expect.objectContaining({
      dealId: ids.deal,
      claimAmountMinor: '500000',
      currency: 'RUB',
    }));
  });

  it('fails closed after durable PLATFORM_OWNER revocation', async () => {
    await adminPrisma.$executeRaw(Prisma.sql`
      UPDATE auth.staff_assignments
      SET status = 'REVOKED', revoked_at = NOW(), updated_at = NOW()
      WHERE id = ${ids.assignment}
    `);

    await expect(staffPrisma.$queryRaw(Prisma.sql`
      SELECT * FROM auth.founder_company_health(${ids.ownerUser}, ${ids.session})
    `)).rejects.toMatchObject({ code: 'P2010' });

    await adminPrisma.$executeRaw(Prisma.sql`
      UPDATE auth.staff_assignments
      SET status = 'ACTIVE', revoked_at = NULL, suspended_at = NULL,
          valid_from = NOW() - INTERVAL '1 minute', updated_at = NOW()
      WHERE id = ${ids.assignment}
    `);
  });

  it('fails closed when MFA freshness expires and recovers only after a new verified session timestamp', async () => {
    await adminPrisma.$executeRaw(Prisma.sql`
      UPDATE auth.sessions
      SET mfa_verified_at = NOW() - INTERVAL '16 minutes', updated_at = NOW()
      WHERE id = ${ids.session}
    `);

    await expect(staffPrisma.$queryRaw(Prisma.sql`
      SELECT * FROM auth.founder_decision_queue(${ids.ownerUser}, ${ids.session}, 10)
    `)).rejects.toMatchObject({ code: 'P2010' });

    await adminPrisma.$executeRaw(Prisma.sql`
      UPDATE auth.sessions
      SET mfa_verified_at = NOW(), updated_at = NOW()
      WHERE id = ${ids.session}
    `);

    const recovered = await staffPrisma.$queryRaw<FounderMetricRow[]>(Prisma.sql`
      SELECT * FROM auth.founder_company_health(${ids.ownerUser}, ${ids.session})
    `);
    expect(recovered).toHaveLength(5);
  });

  it('rejects unknown metric ids and unbounded drill-down limits at the PostgreSQL boundary', async () => {
    await expect(staffPrisma.$queryRaw(Prisma.sql`
      SELECT * FROM auth.founder_metric_drilldown(
        ${ids.ownerUser}, ${ids.session}, 'unknown.metric', 10
      )
    `)).rejects.toMatchObject({ code: 'P2010' });

    await expect(staffPrisma.$queryRaw(Prisma.sql`
      SELECT * FROM auth.founder_metric_drilldown(
        ${ids.ownerUser}, ${ids.session}, 'business.open_deals', 101
      )
    `)).rejects.toMatchObject({ code: 'P2010' });
  });
});
