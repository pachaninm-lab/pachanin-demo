import { createHmac } from 'crypto';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import {
  FINANCIAL_MFA_THRESHOLD_KOPECKS,
  Role,
} from '../../src/common/types/request-user';
import { AuthService } from '../../src/modules/auth/auth.service';
import { AuthPrismaService } from '../../src/modules/auth/auth-prisma.service';
import { CURRENT_CONSENT_VERSION } from '../../src/modules/auth/consent-policy';
import { RegistrationApplicationService } from '../../src/modules/auth/registration-application.service';
import { PersistentAuthRepository } from '../../src/modules/auth/persistent-auth.repository';

const PASSWORD = 'Correct-Horse-9!';

type Runtime = {
  prisma: PrismaService;
  authPrisma: AuthPrismaService;
  repository: PersistentAuthRepository;
  auth: AuthService;
  registration: RegistrationApplicationService;
};

function runtime(): Runtime {
  const prisma = new PrismaService();
  const authPrisma = new AuthPrismaService();
  const repository = new PersistentAuthRepository(prisma);
  return {
    prisma,
    authPrisma,
    repository,
    auth: new AuthService(repository),
    registration: new RegistrationApplicationService(authPrisma, repository),
  };
}

function base32Decode(input: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const normalized = input.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of normalized) {
    value = (value << 5) | alphabet.indexOf(char);
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function totp(secret: string, unixMs = Date.now()): string {
  const counter = BigInt(Math.floor(unixMs / 30_000));
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(counter);
  const digest = createHmac('sha1', base32Decode(secret)).update(counterBuffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = ((digest[offset] & 0x7f) << 24)
    | ((digest[offset + 1] & 0xff) << 16)
    | ((digest[offset + 2] & 0xff) << 8)
    | (digest[offset + 3] & 0xff);
  return String(binary % 1_000_000).padStart(6, '0');
}

describe('persistent PostgreSQL identity, session rotation, revocation and MFA', () => {
  const first = runtime();
  const second = runtime();

  beforeAll(async () => {
    await Promise.all([
      first.prisma.$connect(),
      second.prisma.$connect(),
      first.authPrisma.$connect(),
      second.authPrisma.$connect(),
    ]);
  });

  afterAll(async () => {
    await Promise.all([
      first.prisma.$disconnect(),
      second.prisma.$disconnect(),
      first.authPrisma.$disconnect(),
      second.authPrisma.$disconnect(),
    ]);
  });

  async function seedIdentity(
    key: string,
    role: Role,
    options: { organizationStatus?: string; mfaEnabled?: boolean } = {},
  ) {
    const userId = `auth-user-${key}`;
    const organizationId = `auth-org-${key}`;
    const tenantId = `auth-tenant-${key}`;
    const email = `${key}@auth.test`;
    const organization = await first.prisma.organization.upsert({
      where: { id: organizationId },
      update: {
        status: options.organizationStatus ?? 'VERIFIED',
        tenantId,
        kycStatus: 'APPROVED',
        amlStatus: 'CLEAR',
      },
      create: {
        id: organizationId,
        inn: `77${String(Math.abs(hashCode(key))).padStart(10, '0').slice(0, 10)}`,
        name: `Auth Test ${key}`,
        status: options.organizationStatus ?? 'VERIFIED',
        tenantId,
        kycStatus: 'APPROVED',
        amlStatus: 'CLEAR',
        verifiedAt: new Date(),
      },
    });
    const user = await first.prisma.user.upsert({
      where: { id: userId },
      update: {
        email,
        passwordHash: await bcrypt.hash(PASSWORD, 10),
        fullName: `Auth ${key}`,
        status: 'ACTIVE',
        mfaEnabled: options.mfaEnabled ?? false,
        deletedAt: null,
      },
      create: {
        id: userId,
        email,
        passwordHash: await bcrypt.hash(PASSWORD, 10),
        fullName: `Auth ${key}`,
        status: 'ACTIVE',
        mfaEnabled: options.mfaEnabled ?? false,
      },
    });
    const membership = await first.prisma.userOrg.upsert({
      where: {
        userId_organizationId: {
          userId,
          organizationId,
        },
      },
      update: { role, status: 'ACTIVE', isDefault: true },
      create: { userId, organizationId, role, status: 'ACTIVE', isDefault: true },
    });
    return { user, organization, membership, email, userId, organizationId, tenantId };
  }

  it('keeps role, tenant and organization out of JWT and re-authorizes through PostgreSQL', async () => {
    const identity = await seedIdentity('buyer', Role.BUYER);
    const login = await first.auth.login({ email: identity.email, password: PASSWORD }, 'auth-e2e-1', '127.0.0.1') as any;

    expect(login.mfaRequired).toBe(false);
    expect(login.accessToken).toEqual(expect.any(String));
    expect(login.refreshToken).toMatch(/^rt_/);
    const decoded = jwt.decode(login.accessToken) as Record<string, unknown>;
    expect(decoded).toMatchObject({ sub: identity.userId, typ: 'access' });
    expect(decoded.sid).toEqual(expect.any(String));
    expect(decoded).not.toHaveProperty('role');
    expect(decoded).not.toHaveProperty('orgId');
    expect(decoded).not.toHaveProperty('tenantId');
    const sessionId = String(decoded.sid);

    const sessions = await first.prisma.$queryRaw<Array<{
      user_id: string;
      membership_id: string;
      organization_id: string;
      tenant_id: string;
      status: string;
    }>>`
      SELECT user_id, membership_id, organization_id, tenant_id, status
      FROM auth.sessions
      WHERE id = ${sessionId}
    `;
    expect(sessions).toEqual([
      {
        user_id: identity.userId,
        membership_id: identity.membership.id,
        organization_id: identity.organizationId,
        tenant_id: identity.tenantId,
        status: 'ACTIVE',
      },
    ]);

    await expect(second.auth.verifyAccessToken(login.accessToken)).resolves.toMatchObject({
      id: identity.userId,
      role: Role.BUYER,
      orgId: identity.organizationId,
      tenantId: identity.tenantId,
      membershipId: identity.membership.id,
      mfaVerified: false,
    });

    const restarted = runtime();
    await restarted.prisma.$connect();
    try {
      await expect(restarted.auth.verifyAccessToken(login.accessToken)).resolves.toMatchObject({
        id: identity.userId,
        membershipId: identity.membership.id,
      });
    } finally {
      await restarted.prisma.$disconnect();
    }
  });

  it('rotates refresh once and revokes the complete family on old-token reuse across instances', async () => {
    const identity = await seedIdentity('refresh', Role.FARMER);
    const login = await first.auth.login({ email: identity.email, password: PASSWORD }) as any;
    const rotated = await second.auth.refresh({ refreshToken: login.refreshToken }, 'auth-e2e-2', '127.0.0.2') as any;

    expect(rotated.refreshToken).not.toBe(login.refreshToken);
    await expect(first.auth.verifyAccessToken(rotated.accessToken)).resolves.toMatchObject({ id: identity.userId });

    await expect(
      first.auth.refresh({ refreshToken: login.refreshToken }, 'auth-e2e-reuse', '127.0.0.3'),
    ).rejects.toThrow(/reuse detected/i);
    await expect(second.auth.verifyAccessToken(rotated.accessToken)).rejects.toThrow(/revoked|not active/i);
    await expect(second.auth.refresh({ refreshToken: rotated.refreshToken })).rejects.toThrow(/reuse|invalid|expired/i);

    const sessions = await first.prisma.$queryRaw<Array<{ status: string; revocation_reason: string | null }>>`
      SELECT status, revocation_reason
      FROM auth.sessions
      WHERE user_id = ${identity.userId}
    `;
    expect(sessions).toEqual([
      expect.objectContaining({ status: 'REVOKED', revocation_reason: 'REFRESH_TOKEN_REUSE_DETECTED' }),
    ]);
  });

  it('allows exactly one concurrent refresh winner and revokes its family after reuse detection', async () => {
    const identity = await seedIdentity('concurrent-refresh', Role.FARMER);
    const login = await first.auth.login({ email: identity.email, password: PASSWORD }) as any;
    const attempts = await Promise.allSettled([
      first.auth.refresh({ refreshToken: login.refreshToken }, 'auth-e2e-race-1', '127.0.0.5'),
      second.auth.refresh({ refreshToken: login.refreshToken }, 'auth-e2e-race-2', '127.0.0.6'),
    ]);

    expect(attempts.filter((attempt) => attempt.status === 'fulfilled')).toHaveLength(1);
    expect(attempts.filter((attempt) => attempt.status === 'rejected')).toHaveLength(1);
    const winner = attempts.find((attempt): attempt is PromiseFulfilledResult<any> => attempt.status === 'fulfilled');
    const rejected = attempts.find((attempt): attempt is PromiseRejectedResult => attempt.status === 'rejected');
    expect(String(rejected?.reason?.message ?? rejected?.reason)).toMatch(/reuse detected/i);
    await expect(second.auth.verifyAccessToken(winner!.value.accessToken)).rejects.toThrow(/revoked|not active/i);
  });

  it('persists brute-force lockout across a fresh AuthService instance', async () => {
    const identity = await seedIdentity('lockout', Role.DRIVER);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const service = attempt % 2 === 0 ? first.auth : second.auth;
      await expect(service.login({ email: identity.email, password: 'wrong-password' } as any)).rejects.toThrow(/Invalid credentials/i);
    }
    await expect(
      second.auth.login({ email: identity.email, password: PASSWORD }),
    ).rejects.toThrow(/temporarily locked/i);
  });

  it('requires TOTP before activating a privileged compliance session', async () => {
    const identity = await seedIdentity('compliance', Role.COMPLIANCE_OFFICER);
    const pending = await first.auth.login({ email: identity.email, password: PASSWORD }) as any;

    expect(pending.mfaRequired).toBe(true);
    expect(pending).not.toHaveProperty('accessToken');
    expect(pending.challengeToken).toMatch(/^mc_/);
    expect(pending.setupSecret).toEqual(expect.any(String));
    expect(pending.otpAuthUri).toMatch(/^otpauth:\/\/totp\//);

    const verified = await second.auth.verifyMfa({
      challengeToken: pending.challengeToken,
      code: totp(pending.setupSecret),
    }, 'auth-e2e-mfa', '127.0.0.4') as any;
    expect(verified.accessToken).toEqual(expect.any(String));
    expect(verified.refreshToken).toMatch(/^rt_/);
    expect(verified.backupCodes).toHaveLength(8);

    const user = await first.auth.verifyAccessToken(verified.accessToken);
    expect(user).toMatchObject({
      id: identity.userId,
      role: Role.COMPLIANCE_OFFICER,
      mfaVerified: true,
      mfaVerifiedAt: expect.any(String),
    });

    expect(() => first.auth.assertRecentFinancialMfa(
      { ...user, mfaVerified: false, mfaVerifiedAt: undefined },
      FINANCIAL_MFA_THRESHOLD_KOPECKS,
    )).toThrow(/Recent MFA verification is required/i);
    expect(() => first.auth.assertRecentFinancialMfa(
      user,
      FINANCIAL_MFA_THRESHOLD_KOPECKS,
    )).not.toThrow();
    expect(() => first.auth.assertRecentFinancialMfa(
      { ...user, mfaVerifiedAt: new Date(Date.now() - 16 * 60 * 1000).toISOString() },
      FINANCIAL_MFA_THRESHOLD_KOPECKS,
    )).toThrow(/too old/i);
    expect(() => first.auth.assertRecentFinancialMfa(
      { ...user, mfaVerified: false, mfaVerifiedAt: undefined },
      FINANCIAL_MFA_THRESHOLD_KOPECKS - 1,
    )).not.toThrow();

    await first.auth.logout({}, user.sessionId);
    await expect(second.auth.verifyAccessToken(verified.accessToken)).rejects.toThrow(/revoked|not active/i);
  });

  it('applies administrator revocation and organization suspension across API instances', async () => {
    const revokedIdentity = await seedIdentity('admin-revoke-target', Role.LOGISTICIAN);
    const revokedLogin = await first.auth.login({ email: revokedIdentity.email, password: PASSWORD }) as any;
    const verified = await second.auth.verifyAccessToken(revokedLogin.accessToken);
    expect(verified.id).toBe(revokedIdentity.userId);

    await first.auth.revokeUserSessions(revokedIdentity.userId, 'SECURITY_REVIEW');
    await expect(second.auth.verifyAccessToken(revokedLogin.accessToken)).rejects.toThrow(/revoked|not active/i);

    const membershipIdentity = await seedIdentity('membership-change', Role.BUYER);
    const membershipLogin = await first.auth.login({ email: membershipIdentity.email, password: PASSWORD }) as any;
    const replacementOrganization = await first.prisma.organization.upsert({
      where: { id: 'auth-org-membership-replacement' },
      update: {
        status: 'VERIFIED',
        tenantId: 'auth-tenant-membership-replacement',
      },
      create: {
        id: 'auth-org-membership-replacement',
        inn: '770000099999',
        name: 'Auth Membership Replacement',
        status: 'VERIFIED',
        tenantId: 'auth-tenant-membership-replacement',
        kycStatus: 'APPROVED',
        amlStatus: 'CLEAR',
        verifiedAt: new Date(),
      },
    });
    await first.prisma.userOrg.update({
      where: { id: membershipIdentity.membership.id },
      data: { organizationId: replacementOrganization.id },
    });
    await expect(second.auth.verifyAccessToken(membershipLogin.accessToken)).rejects.toThrow(/not active/i);
    const membershipSessions = await first.prisma.$queryRaw<Array<{
      status: string;
      revocation_reason: string | null;
    }>>`
      SELECT status, revocation_reason
      FROM auth.sessions
      WHERE user_id = ${membershipIdentity.userId}
    `;
    expect(membershipSessions).toEqual([
      expect.objectContaining({ status: 'REVOKED', revocation_reason: 'MEMBERSHIP_CHANGED' }),
    ]);
    await first.prisma.userOrg.update({
      where: { id: membershipIdentity.membership.id },
      data: { organizationId: membershipIdentity.organizationId },
    });
    await expect(second.auth.verifyAccessToken(membershipLogin.accessToken)).rejects.toThrow(/revoked|not active/i);

    const suspendedIdentity = await seedIdentity('suspended-org', Role.ELEVATOR);
    const suspendedLogin = await first.auth.login({ email: suspendedIdentity.email, password: PASSWORD }) as any;
    await first.prisma.organization.update({
      where: { id: suspendedIdentity.organizationId },
      data: { status: 'SUSPENDED' },
    });
    await expect(second.auth.verifyAccessToken(suspendedLogin.accessToken)).rejects.toThrow(/revoked|not active/i);
  });

  it('denies non-active membership at login, refresh and access resolution', async () => {
    const pendingIdentity = await seedIdentity('pending-membership', Role.BUYER);
    await first.prisma.userOrg.update({
      where: { id: pendingIdentity.membership.id },
      data: { status: 'PENDING' },
    });
    await expect(
      first.auth.login({ email: pendingIdentity.email, password: PASSWORD }),
    ).rejects.toThrow(/Invalid credentials/i);
    const [pendingSessionCount] = await first.prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
      FROM auth.sessions
      WHERE user_id = ${pendingIdentity.userId}
    `;
    expect(Number(pendingSessionCount.count)).toBe(0);

    const refreshIdentity = await seedIdentity('suspended-membership-refresh', Role.FARMER);
    const refreshLogin = await first.auth.login({
      email: refreshIdentity.email,
      password: PASSWORD,
    }) as any;
    await first.prisma.userOrg.update({
      where: { id: refreshIdentity.membership.id },
      data: { status: 'SUSPENDED' },
    });
    await expect(
      second.auth.refresh({ refreshToken: refreshLogin.refreshToken }),
    ).rejects.toThrow(/reuse|invalid|expired/i);
    const refreshSessions = await first.prisma.$queryRaw<Array<{
      status: string;
      revocation_reason: string | null;
    }>>`
      SELECT status, revocation_reason
      FROM auth.sessions
      WHERE user_id = ${refreshIdentity.userId}
    `;
    expect(refreshSessions).toEqual([
      expect.objectContaining({ status: 'REVOKED', revocation_reason: 'MEMBERSHIP_NOT_ACTIVE' }),
    ]);

    const accessIdentity = await seedIdentity('revoked-membership-access', Role.LOGISTICIAN);
    const accessLogin = await first.auth.login({
      email: accessIdentity.email,
      password: PASSWORD,
    }) as any;
    await first.prisma.userOrg.update({
      where: { id: accessIdentity.membership.id },
      data: { status: 'REVOKED', revokedAt: new Date() },
    });
    await expect(second.auth.verifyAccessToken(accessLogin.accessToken)).rejects.toThrow(/revoked|not active/i);
    const accessSessions = await first.prisma.$queryRaw<Array<{
      status: string;
      revocation_reason: string | null;
    }>>`
      SELECT status, revocation_reason
      FROM auth.sessions
      WHERE user_id = ${accessIdentity.userId}
    `;
    expect(accessSessions).toEqual([
      expect.objectContaining({ status: 'REVOKED', revocation_reason: 'MEMBERSHIP_NOT_ACTIVE' }),
    ]);
  });

  it('prevents public email and organization enumeration with durable idempotency', async () => {
    const dto = (email: string, orgInn: string, orgLegalName: string) => ({
      email,
      phone: '+79990001122',
      fullName: 'Registration Applicant',
      position: 'Director',
      orgLegalName,
      orgInn,
      orgType: 'LEGAL' as const,
      region: 'Moscow',
      workspace: 'buyer' as const,
      password: PASSWORD,
      termsVersion: CURRENT_CONSENT_VERSION,
      privacyVersion: CURRENT_CONSENT_VERSION,
      acceptTerms: true as const,
      acceptPrivacy: true as const,
    });
    const publicKeys = ['accepted', 'correlationId', 'nextAction', 'status'];

    const existingAccount = await seedIdentity('enumeration-existing-account', Role.BUYER);
    const existingAccountDto = dto(
      existingAccount.email,
      '780000000011',
      'Enumeration Existing Account Probe',
    );
    const suppressed = await first.registration.submit(existingAccountDto, {
      idempotencyKey: 'registration-enumeration-existing-0001',
      correlationId: 'registration-enumeration-existing-correlation',
    });
    const suppressedReplay = await second.registration.submit(existingAccountDto, {
      idempotencyKey: 'registration-enumeration-existing-0001',
      correlationId: 'ignored-replay-correlation',
    });
    expect(Object.keys(suppressed).sort()).toEqual(publicKeys);
    expect(suppressedReplay).toEqual(suppressed);
    await expect(second.registration.submit({ ...existingAccountDto, phone: '+79990001123' }, {
      idempotencyKey: 'registration-enumeration-existing-0001',
      correlationId: 'registration-enumeration-conflict',
    })).rejects.toMatchObject({
      response: { code: 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD' },
    });

    const newOrganizationEmail = 'enumeration-new-org@auth.test';
    const newOrganization = await first.registration.submit(
      dto(newOrganizationEmail, '780000000012', 'Enumeration New Organization'),
      {
        idempotencyKey: 'registration-enumeration-new-org-0001',
        correlationId: 'registration-enumeration-new-org-correlation',
      },
    );
    expect(Object.keys(newOrganization).sort()).toEqual(publicKeys);
    await expect(first.auth.login({ email: newOrganizationEmail, password: PASSWORD }))
      .rejects.toThrow(/Invalid credentials/i);

    const existingOrganization = await seedIdentity('enumeration-existing-org', Role.FARMER);
    const joinOrganization = await first.registration.submit(
      dto('enumeration-join-org@auth.test', existingOrganization.organization.inn, 'Probe Legal Name'),
      {
        idempotencyKey: 'registration-enumeration-join-org-0001',
        correlationId: 'registration-enumeration-join-org-correlation',
      },
    );
    expect(Object.keys(joinOrganization).sort()).toEqual(publicKeys);

    const attempts = await first.prisma.$queryRaw<Array<{
      idempotency_key: string;
      outcome: string;
      application_id: string | null;
    }>>`
      SELECT idempotency_key, outcome, application_id
      FROM auth.registration_public_attempts
      WHERE idempotency_key IN (
        'registration-enumeration-existing-0001',
        'registration-enumeration-new-org-0001',
        'registration-enumeration-join-org-0001'
      )
      ORDER BY idempotency_key
    `;
    expect(attempts).toEqual([
      expect.objectContaining({
        idempotency_key: 'registration-enumeration-existing-0001',
        outcome: 'SUPPRESSED_EXISTING_ACCOUNT',
        application_id: null,
      }),
      expect.objectContaining({
        idempotency_key: 'registration-enumeration-join-org-0001',
        outcome: 'APPLICATION_CREATED',
        application_id: expect.any(String),
      }),
      expect.objectContaining({
        idempotency_key: 'registration-enumeration-new-org-0001',
        outcome: 'APPLICATION_CREATED',
        application_id: expect.any(String),
      }),
    ]);
    await expect(first.prisma.$executeRaw`
      TRUNCATE TABLE auth.registration_public_attempts
    `).rejects.toThrow(/append-only/i);

    const previousDeliveryKey = process.env.REGISTRATION_DELIVERY_KEY;
    process.env.REGISTRATION_DELIVERY_KEY = 'registration-delivery-key-32-characters-minimum';
    try {
      const internal = await first.registration.submit(
        dto('enumeration-delivery@auth.test', '780000000013', 'Enumeration Delivery Organization'),
        {
          idempotencyKey: 'registration-enumeration-delivery-0001',
          correlationId: 'registration-enumeration-delivery-correlation',
          deliveryKey: process.env.REGISTRATION_DELIVERY_KEY,
        },
      ) as any;
      expect(internal.emailDelivery).toMatchObject({ email: 'enumeration-delivery@auth.test' });
      expect(internal.statusToken).toMatch(/^rst_reg_/);
      expect(internal).not.toHaveProperty('kind');
      expect(internal).not.toHaveProperty('requestedWorkspace');
      const publicStatus = await first.registration.status(internal.statusToken);
      expect(publicStatus).not.toHaveProperty('kind');
      expect(publicStatus).not.toHaveProperty('requestedWorkspace');
    } finally {
      if (previousDeliveryKey === undefined) delete process.env.REGISTRATION_DELIVERY_KEY;
      else process.env.REGISTRATION_DELIVERY_KEY = previousDeliveryKey;
    }
  });

  it('persists expiration and safely restarts an abandoned application without duplicate identity rows', async () => {
    const email = 'registration-restart@auth.test';
    const inn = '780000000014';
    const registrationDto = {
      email,
      phone: '+79990001414',
      fullName: 'Restart Applicant',
      position: 'Director',
      orgLegalName: 'Restart Organization',
      orgInn: inn,
      orgType: 'LEGAL' as const,
      region: 'Moscow',
      workspace: 'seller' as const,
      password: PASSWORD,
      termsVersion: CURRENT_CONSENT_VERSION,
      privacyVersion: CURRENT_CONSENT_VERSION,
      acceptTerms: true as const,
      acceptPrivacy: true as const,
    };
    await first.registration.submit(registrationDto, {
      idempotencyKey: 'registration-restart-first-0001',
      correlationId: 'registration-restart-first-correlation',
    });
    const [before] = await first.prisma.$queryRaw<Array<{
      id: string; user_id: string; organization_id: string; membership_id: string;
    }>>`
      SELECT id, user_id, organization_id, membership_id
      FROM auth.registration_applications
      WHERE email = ${email}
      ORDER BY created_at DESC
      LIMIT 1
    `;
    await first.prisma.$executeRaw`
      UPDATE auth.registration_applications
      SET created_at = NOW() - INTERVAL '2 days',
          expires_at = NOW() - INTERVAL '1 day'
      WHERE id = ${before.id}
    `;

    await second.registration.submit({ ...registrationDto, password: 'New-Correct-Horse-10!' }, {
      idempotencyKey: 'registration-restart-second-0001',
      correlationId: 'registration-restart-second-correlation',
    });

    const applications = await first.prisma.$queryRaw<Array<{
      id: string; user_id: string; organization_id: string; membership_id: string; status: string;
    }>>`
      SELECT id, user_id, organization_id, membership_id, status
      FROM auth.registration_applications
      WHERE email = ${email}
      ORDER BY created_at ASC, id ASC
    `;
    expect(applications).toHaveLength(2);
    expect(applications[0]).toMatchObject({
      id: before.id, status: 'EXPIRED', user_id: before.user_id,
      organization_id: before.organization_id, membership_id: before.membership_id,
    });
    expect(applications[1]).toMatchObject({
      status: 'EMAIL_VERIFICATION_REQUIRED', user_id: before.user_id,
      organization_id: before.organization_id, membership_id: before.membership_id,
    });
    const [{ users, organizations, memberships, expiry_events: expiryEvents }] = await first.prisma.$queryRaw<Array<{
      users: bigint; organizations: bigint; memberships: bigint; expiry_events: bigint;
    }>>`
      SELECT
        (SELECT COUNT(*) FROM public.users WHERE email = ${email})::bigint AS users,
        (SELECT COUNT(*) FROM public.organizations WHERE inn = ${inn})::bigint AS organizations,
        (SELECT COUNT(*) FROM public.user_orgs WHERE id = ${before.membership_id})::bigint AS memberships,
        (SELECT COUNT(*) FROM auth.registration_application_events
          WHERE application_id = ${before.id} AND new_status = 'EXPIRED')::bigint AS expiry_events
    `;
    expect({ users: Number(users), organizations: Number(organizations), memberships: Number(memberships), expiryEvents: Number(expiryEvents) })
      .toEqual({ users: 1, organizations: 1, memberships: 1, expiryEvents: 1 });

    await expect(first.prisma.$executeRaw`
      TRUNCATE TABLE auth.registration_application_events
    `).rejects.toThrow(/append-only/i);
  });

  it('writes chained auth audit evidence', async () => {
    const rows = await first.prisma.$queryRaw<Array<{
      id: string;
      session_id: string | null;
      user_id: string | null;
      action: string;
      outcome: string;
      reason: string | null;
      hash: string;
      prev_hash: string | null;
    }>>`
      SELECT id, session_id, user_id, action, outcome, reason, hash, prev_hash
      FROM auth.audit_events
      ORDER BY created_at ASC, id ASC
    `;
    expect(rows.length).toBeGreaterThan(10);
    expect(new Set(rows.map((row) => row.hash)).size).toBe(rows.length);
    expect(rows.every((row) => /^[a-f0-9]{64}$/.test(row.hash))).toBe(true);

    const chains = new Map<string, typeof rows>();
    for (const row of rows) {
      const key = row.session_id ?? row.user_id ?? 'global';
      const chain = chains.get(key) ?? [];
      chain.push(row);
      chains.set(key, chain);
    }
    for (const chain of chains.values()) {
      for (let index = 1; index < chain.length; index += 1) {
        expect(chain[index].prev_hash).toBe(chain[index - 1].hash);
      }
    }

    expect(rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ action: 'auth.login', outcome: 'SUCCESS' }),
      expect.objectContaining({ action: 'auth.refresh', outcome: 'SUCCESS' }),
      expect.objectContaining({
        action: 'auth.refresh.reuse',
        outcome: 'DENIED',
        reason: 'REFRESH_TOKEN_REUSE_DETECTED',
      }),
      expect.objectContaining({ action: 'auth.mfa.verify', outcome: 'SUCCESS' }),
      expect.objectContaining({ action: 'auth.logout', outcome: 'SUCCESS' }),
      expect.objectContaining({ action: 'auth.sessions.revoke_all', outcome: 'SUCCESS' }),
      expect.objectContaining({ action: 'auth.access', outcome: 'DENIED' }),
    ]));

    const beforeCount = rows.length;
    await expect(first.prisma.$executeRaw`
      UPDATE auth.audit_events SET reason = 'TAMPERED' WHERE id = ${rows[0].id}
    `).rejects.toThrow(/append-only/i);
    await expect(first.prisma.$executeRaw`
      DELETE FROM auth.audit_events WHERE id = ${rows[0].id}
    `).rejects.toThrow(/append-only/i);
    await expect(first.prisma.$executeRaw`
      TRUNCATE TABLE auth.audit_events
    `).rejects.toThrow(/append-only/i);
    const [{ count }] = await first.prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count FROM auth.audit_events
    `;
    expect(Number(count)).toBe(beforeCount);
  });
});

function hashCode(value: string): number {
  let hash = 0;
  for (const char of value) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  return hash;
}
