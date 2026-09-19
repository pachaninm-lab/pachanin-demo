import { Prisma, PrismaClient } from '@prisma/client';
import { AuthPrismaService } from '../../src/modules/auth/auth-prisma.service';
import { StaffAccessRepository } from '../../src/modules/staff-access/staff-access.repository';

const userId = 'user-staff-audit-chain-e2e';
const assignmentId = 'sta-audit-chain-e2e';
const ADMIN_DATABASE_URL = process.env.STAFF_ACCESS_TEST_ADMIN_URL ?? '';

describe('staff audit chain PostgreSQL enforcement', () => {
  const prisma = new AuthPrismaService();
  const adminPrisma = new PrismaClient(
    ADMIN_DATABASE_URL ? { datasources: { db: { url: ADMIN_DATABASE_URL } } } : undefined,
  );
  const repository = new StaffAccessRepository(prisma);

  beforeAll(async () => {
    if (!ADMIN_DATABASE_URL) {
      throw new Error('STAFF_ACCESS_TEST_ADMIN_URL is required for isolated fixture bootstrap.');
    }
    await Promise.all([prisma.$connect(), adminPrisma.$connect()]);
    await adminPrisma.user.upsert({
      where: { id: userId },
      create: {
        id: userId,
        email: 'staff-audit-chain-e2e@example.test',
        fullName: 'Staff Audit Chain E2E',
        passwordHash: '$argon2id$v=19$m=65536,t=3,p=1$isolated$staff-audit-chain-e2e',
        status: 'ACTIVE',
      },
      update: {},
    });
    await adminPrisma.$executeRaw(Prisma.sql`
      INSERT INTO auth.staff_assignments (
        id, user_id, role, status, activated_at, granted_by_user_id, reason
      ) VALUES (
        ${assignmentId}, ${userId}, 'SECURITY_AUDITOR', 'ACTIVE', NOW(), ${userId},
        'Isolated PostgreSQL audit chain enforcement fixture'
      )
      ON CONFLICT (id) DO NOTHING
    `);
  });

  afterAll(async () => {
    await Promise.allSettled([prisma.$disconnect(), adminPrisma.$disconnect()]);
  });

  it('accepts the canonical previous hash and rejects a forked previous hash', async () => {
    const firstPrevious = await repository.latestEventHash(prisma, userId);
    await repository.insertEvent(prisma, {
      id: 'sae-audit-chain-e2e-1',
      actorUserId: userId,
      staffRole: 'SECURITY_AUDITOR',
      action: 'staff.audit-chain.first',
      outcome: 'SUCCESS',
      correlationId: 'audit-chain-e2e-1',
      metadata: { fixture: true },
      prevHash: firstPrevious,
      hash: '1'.repeat(64),
    });

    await expect(repository.insertEvent(prisma, {
      id: 'sae-audit-chain-e2e-fork',
      actorUserId: userId,
      staffRole: 'SECURITY_AUDITOR',
      action: 'staff.audit-chain.fork',
      outcome: 'SUCCESS',
      correlationId: 'audit-chain-e2e-fork',
      metadata: { fixture: true },
      prevHash: 'not-the-latest-hash',
      hash: '2'.repeat(64),
    })).rejects.toBeTruthy();

    const latest = await repository.latestEventHash(prisma, userId);
    expect(latest).toBe('1'.repeat(64));
  });
});
