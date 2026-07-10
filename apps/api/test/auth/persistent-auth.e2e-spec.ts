import { createHmac } from 'crypto';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { Role } from '../../src/common/types/request-user';
import { AuthService } from '../../src/modules/auth/auth.service';
import { PersistentAuthRepository } from '../../src/modules/auth/persistent-auth.repository';

const PASSWORD = 'Correct-Horse-9!';

type Runtime = {
  prisma: PrismaService;
  repository: PersistentAuthRepository;
  auth: AuthService;
};

function runtime(): Runtime {
  const prisma = new PrismaService();
  const repository = new PersistentAuthRepository(prisma);
  return { prisma, repository, auth: new AuthService(repository) };
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
    await Promise.all([first.prisma.$connect(), second.prisma.$connect()]);
  });

  afterAll(async () => {
    await Promise.all([first.prisma.$disconnect(), second.prisma.$disconnect()]);
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
      update: { role, isDefault: true },
      create: { userId, organizationId, role, isDefault: true },
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

    await expect(second.auth.verifyAccessToken(login.accessToken)).resolves.toMatchObject({
      id: identity.userId,
      role: Role.BUYER,
      orgId: identity.organizationId,
      tenantId: identity.tenantId,
      membershipId: identity.membership.id,
      mfaVerified: false,
    });
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

    const suspendedIdentity = await seedIdentity('suspended-org', Role.ELEVATOR);
    const suspendedLogin = await first.auth.login({ email: suspendedIdentity.email, password: PASSWORD }) as any;
    await first.prisma.organization.update({
      where: { id: suspendedIdentity.organizationId },
      data: { status: 'SUSPENDED' },
    });
    await expect(second.auth.verifyAccessToken(suspendedLogin.accessToken)).rejects.toThrow(/not active/i);
  });

  it('ignores client orgId during self-registration and creates a pending organization', async () => {
    const result = await first.auth.register({
      email: 'pending-registration@auth.test',
      fullName: 'Pending Registration',
      role: Role.BUYER,
      password: PASSWORD,
      orgId: 'org-attacker-selected',
      orgInn: '781234567890',
      orgLegalName: 'Pending Registration LLC',
      consentVersion: '1.2',
    } as any) as any;

    expect(result.status).toBe('PENDING_ORGANIZATION_VERIFICATION');
    expect(result.user.orgId).not.toBe('org-attacker-selected');
    const organization = await first.prisma.organization.findUnique({ where: { id: result.user.orgId } });
    expect(organization?.status).toBe('PENDING');
    await expect(
      second.auth.login({ email: 'pending-registration@auth.test', password: PASSWORD }),
    ).rejects.toThrow(/ORGANIZATION_NOT_VERIFIED/);
  });

  it('writes chained auth audit evidence', async () => {
    const rows = await first.prisma.$queryRaw<Array<{
      id: string;
      session_id: string | null;
      user_id: string | null;
      hash: string;
      prev_hash: string | null;
    }>>`
      SELECT id, session_id, user_id, hash, prev_hash
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
  });
});

function hashCode(value: string): number {
  let hash = 0;
  for (const char of value) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  return hash;
}
