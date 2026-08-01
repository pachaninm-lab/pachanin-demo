import { randomUUID } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { Role, type RequestUser } from '../../src/common/types/request-user';
import { AuthPrismaService } from '../../src/modules/auth/auth-prisma.service';
import { AuthService } from '../../src/modules/auth/auth.service';
import { OrganizationInvitationService } from '../../src/modules/auth/organization-invitation.service';
import { PersistentAuthRepository } from '../../src/modules/auth/persistent-auth.repository';

const PASSWORD = 'Current-Recovery-Password-9!';
const DELIVERY_KEY = 'organization-invitation-delivery-key-for-mfa-e2e';

describe('controlled PostgreSQL MFA recovery', () => {
  const prisma = new PrismaService();
  const authPrisma = new AuthPrismaService();
  const repository = new PersistentAuthRepository(prisma);
  const auth = new AuthService(repository);
  const recovery = new OrganizationInvitationService(authPrisma, repository);
  const previousDeliveryKey = process.env.ORGANIZATION_INVITATION_DELIVERY_KEY;

  beforeAll(async () => {
    process.env.ORGANIZATION_INVITATION_DELIVERY_KEY = DELIVERY_KEY;
    await Promise.all([prisma.$connect(), authPrisma.$connect()]);
  });

  afterAll(async () => {
    if (previousDeliveryKey === undefined) delete process.env.ORGANIZATION_INVITATION_DELIVERY_KEY;
    else process.env.ORGANIZATION_INVITATION_DELIVERY_KEY = previousDeliveryKey;
    await Promise.all([prisma.$disconnect(), authPrisma.$disconnect()]);
  });

  async function seed(options: { sharedAuthority?: boolean } = {}) {
    const key = randomUUID().replaceAll('-', '').slice(0, 20);
    const tenantId = `mfa-recovery-tenant-${key}`;
    const organizationId = `mfa-recovery-org-${key}`;
    const adminUserId = `mfa-recovery-admin-${key}`;
    const targetUserId = `mfa-recovery-target-${key}`;
    const adminEmail = `admin-${key}@mfa-recovery.test`;
    const targetEmail = `target-${key}@mfa-recovery.test`;
    const innDigits = BigInt(`0x${key.slice(0, 12)}`).toString().padStart(10, '0').slice(-10);
    const organization = await prisma.organization.create({
      data: {
        id: organizationId,
        inn: `79${innDigits}`,
        name: `MFA Recovery ${key}`,
        tenantId,
        status: 'VERIFIED',
        kycStatus: 'APPROVED',
        amlStatus: 'CLEAR',
        verifiedAt: new Date(),
      },
    });
    await prisma.user.createMany({
      data: [
        {
          id: adminUserId,
          email: adminEmail,
          passwordHash: await bcrypt.hash(PASSWORD, 10),
          fullName: 'Recovery Administrator',
          status: 'ACTIVE',
          mfaEnabled: true,
        },
        {
          id: targetUserId,
          email: targetEmail,
          passwordHash: await bcrypt.hash(PASSWORD, 10),
          fullName: 'Recovery Subject',
          status: 'ACTIVE',
          mfaEnabled: true,
        },
      ],
    });
    const adminMembership = await prisma.userOrg.create({
      data: {
        userId: adminUserId,
        organizationId,
        role: Role.BUYER,
        status: 'ACTIVE',
        isDefault: true,
        isOrgAdmin: true,
        activatedAt: new Date(),
      },
    });
    const targetMembership = await prisma.userOrg.create({
      data: {
        userId: targetUserId,
        organizationId,
        role: Role.BUYER,
        status: 'ACTIVE',
        isDefault: true,
        activatedAt: new Date(),
      },
    });
    await repository.ensureCredentialState(prisma, adminUserId);
    await repository.ensureCredentialState(prisma, targetUserId);
    await prisma.$executeRaw`
      UPDATE auth.credential_states
      SET mfa_enabled = TRUE,
          mfa_secret_ciphertext = 'v1:test-encrypted-secret',
          mfa_key_version = 'v1',
          mfa_backup_hashes = '["old-backup-hash"]'::jsonb
      WHERE user_id = ${targetUserId}
    `;

    if (options.sharedAuthority) {
      const otherOrganization = await prisma.organization.create({
        data: {
          id: `mfa-recovery-other-org-${key}`,
          inn: `78${innDigits}`,
          name: `MFA Recovery Other ${key}`,
          tenantId: `mfa-recovery-other-tenant-${key}`,
          status: 'VERIFIED',
          kycStatus: 'APPROVED',
          amlStatus: 'CLEAR',
          verifiedAt: new Date(),
        },
      });
      await prisma.userOrg.create({
        data: {
          userId: targetUserId,
          organizationId: otherOrganization.id,
          role: Role.FARMER,
          status: 'ACTIVE',
          activatedAt: new Date(),
        },
      });
      await prisma.$executeRaw`
        INSERT INTO auth.staff_assignments (
          id, user_id, role, status, valid_from, reason
        ) VALUES (
          ${`mfa-recovery-staff-${key}`}, ${targetUserId}, 'SUPPORT_L1', 'ACTIVE', NOW(), 'MFA recovery cross-authority E2E'
        )
      `;
    }

    const actor: RequestUser = {
      id: adminUserId,
      email: adminEmail,
      role: Role.BUYER,
      orgId: organization.id,
      tenantId,
      membershipId: adminMembership.id,
      isOrgAdmin: true,
      mfaVerified: true,
      mfaVerifiedAt: new Date().toISOString(),
    };
    return { actor, targetUserId, targetEmail, targetMembership };
  }

  it('changes no credential until subject proof, then revokes sessions and forces re-enrollment exactly once', async () => {
    const identity = await seed();
    const pendingLogin = await auth.login({ email: identity.targetEmail, password: PASSWORD }) as any;
    expect(pendingLogin).toMatchObject({ mfaRequired: true });

    const initiated = await recovery.resetMembershipMfa(
      identity.actor,
      identity.targetMembership.id,
      identity.targetMembership.version,
      'Controlled recovery requested after support identity review',
      `mfa-recovery-e2e-${randomUUID()}`,
      `mfa-recovery-correlation-${randomUUID()}`,
      DELIVERY_KEY,
    );
    expect(initiated.recoveryDelivery?.token).toMatch(/^mr_[^.]+\.[A-Za-z0-9_-]+$/);

    const [beforeProof] = await prisma.$queryRaw<Array<{
      mfa_enabled: boolean;
      mfa_secret_ciphertext: string | null;
      session_status: string;
    }>>`
      SELECT credential.mfa_enabled, credential.mfa_secret_ciphertext, session.status AS session_status
      FROM auth.credential_states credential
      JOIN auth.sessions session ON session.user_id = credential.user_id
      WHERE credential.user_id = ${identity.targetUserId}
      ORDER BY session.created_at DESC
      LIMIT 1
    `;
    expect(beforeProof).toMatchObject({
      mfa_enabled: true,
      mfa_secret_ciphertext: 'v1:test-encrypted-secret',
      session_status: 'MFA_PENDING',
    });

    await expect(recovery.confirmMfaRecovery(
      { token: initiated.recoveryDelivery!.token, password: 'Wrong-Recovery-Password-9!' },
      `mfa-recovery-wrong-${randomUUID()}`,
      DELIVERY_KEY,
    )).rejects.toThrow();
    const [afterWrongPassword] = await prisma.$queryRaw<Array<{
      attempts: number;
      status: string;
      mfa_secret_ciphertext: string | null;
    }>>`
      SELECT challenge.attempts, challenge.status, credential.mfa_secret_ciphertext
      FROM auth.mfa_recovery_challenges challenge
      JOIN auth.credential_states credential ON credential.user_id = challenge.user_id
      WHERE challenge.id = ${String(initiated.recoveryDelivery!.token).split('.')[0]}
    `;
    expect(afterWrongPassword).toEqual({
      attempts: 1,
      status: 'PENDING',
      mfa_secret_ciphertext: 'v1:test-encrypted-secret',
    });

    const confirmed = await recovery.confirmMfaRecovery(
      { token: initiated.recoveryDelivery!.token, password: PASSWORD },
      `mfa-recovery-confirm-${randomUUID()}`,
      DELIVERY_KEY,
    );
    expect(confirmed).toMatchObject({
      ok: true,
      sessionsRevoked: true,
      mfaReenrollmentRequired: true,
      nextAction: 'LOGIN',
    });
    const [afterProof] = await prisma.$queryRaw<Array<{
      mfa_enabled: boolean;
      mfa_secret_ciphertext: string | null;
      mfa_backup_hashes: unknown;
      challenge_status: string;
      session_status: string;
    }>>`
      SELECT credential.mfa_enabled, credential.mfa_secret_ciphertext,
             credential.mfa_backup_hashes, challenge.status AS challenge_status,
             session.status AS session_status
      FROM auth.credential_states credential
      JOIN auth.mfa_recovery_challenges challenge ON challenge.user_id = credential.user_id
      JOIN auth.sessions session ON session.user_id = credential.user_id
      WHERE credential.user_id = ${identity.targetUserId}
      ORDER BY session.created_at DESC
      LIMIT 1
    `;
    expect(afterProof).toMatchObject({
      mfa_enabled: true,
      mfa_secret_ciphertext: null,
      mfa_backup_hashes: null,
      challenge_status: 'CONSUMED',
      session_status: 'REVOKED',
    });

    await expect(recovery.confirmMfaRecovery(
      { token: initiated.recoveryDelivery!.token, password: PASSWORD },
      `mfa-recovery-replay-${randomUUID()}`,
      DELIVERY_KEY,
    )).rejects.toThrow();
    const reenrollment = await auth.login({ email: identity.targetEmail, password: PASSWORD }) as any;
    expect(reenrollment).toMatchObject({ mfaRequired: true, setupSecret: expect.any(String) });

    const [event] = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM auth.mfa_recovery_events
      WHERE challenge_id = ${String(initiated.recoveryDelivery!.token).split('.')[0]}
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    `;
    await expect(prisma.$executeRaw`
      UPDATE auth.mfa_recovery_events SET reason = 'TAMPERED' WHERE id = ${event.id}
    `).rejects.toThrow(/append-only/i);
  });

  it('requires platform review when the credential is shared with another organization or staff plane', async () => {
    const identity = await seed({ sharedAuthority: true });
    await expect(recovery.resetMembershipMfa(
      identity.actor,
      identity.targetMembership.id,
      identity.targetMembership.version,
      'Controlled recovery requested after support identity review',
      `mfa-recovery-shared-${randomUUID()}`,
      `mfa-recovery-shared-correlation-${randomUUID()}`,
      DELIVERY_KEY,
    )).rejects.toThrow();
    const [{ count }] = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
      FROM auth.mfa_recovery_challenges
      WHERE user_id = ${identity.targetUserId}
    `;
    expect(Number(count)).toBe(0);
  });
});
