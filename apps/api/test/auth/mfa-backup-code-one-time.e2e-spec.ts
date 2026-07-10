import { createHmac } from 'crypto';
import * as bcrypt from 'bcryptjs';
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

describe('MFA backup codes are strictly one-time', () => {
  const first = runtime();
  const second = runtime();
  const key = 'backup-once';
  const userId = `auth-user-${key}`;
  const organizationId = `auth-org-${key}`;
  const tenantId = `auth-tenant-${key}`;
  const email = `${key}@auth.test`;

  beforeAll(async () => {
    await Promise.all([first.prisma.$connect(), second.prisma.$connect()]);
    await first.prisma.organization.upsert({
      where: { id: organizationId },
      update: {
        status: 'VERIFIED',
        tenantId,
        kycStatus: 'APPROVED',
        amlStatus: 'CLEAR',
      },
      create: {
        id: organizationId,
        inn: '770000088881',
        name: 'Auth Backup Once',
        status: 'VERIFIED',
        tenantId,
        kycStatus: 'APPROVED',
        amlStatus: 'CLEAR',
        verifiedAt: new Date(),
      },
    });
    await first.prisma.user.upsert({
      where: { id: userId },
      update: {
        email,
        passwordHash: await bcrypt.hash(PASSWORD, 10),
        fullName: 'Auth Backup Once',
        status: 'ACTIVE',
        mfaEnabled: false,
        deletedAt: null,
      },
      create: {
        id: userId,
        email,
        passwordHash: await bcrypt.hash(PASSWORD, 10),
        fullName: 'Auth Backup Once',
        status: 'ACTIVE',
        mfaEnabled: false,
      },
    });
    await first.prisma.userOrg.upsert({
      where: {
        userId_organizationId: { userId, organizationId },
      },
      update: { role: Role.COMPLIANCE_OFFICER, isDefault: true },
      create: {
        userId,
        organizationId,
        role: Role.COMPLIANCE_OFFICER,
        isDefault: true,
      },
    });
  });

  afterAll(async () => {
    await Promise.all([first.prisma.$disconnect(), second.prisma.$disconnect()]);
  });

  async function backupHashes(): Promise<string[]> {
    const rows = await first.prisma.$queryRaw<Array<{ mfa_backup_hashes: unknown }>>`
      SELECT mfa_backup_hashes
      FROM auth.credential_states
      WHERE user_id = ${userId}
    `;
    const value = rows[0]?.mfa_backup_hashes;
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  }

  async function pendingChallenge() {
    const login = await first.auth.login({ email, password: PASSWORD }) as any;
    expect(login.mfaRequired).toBe(true);
    expect(login.challengeToken).toMatch(/^mc_/);
    return login;
  }

  it('consumes a backup code once and rejects sequential and concurrent replay', async () => {
    const enrollment = await pendingChallenge();
    expect(enrollment.setupSecret).toEqual(expect.any(String));
    const enrolled = await first.auth.verifyMfa({
      challengeToken: enrollment.challengeToken,
      code: totp(enrollment.setupSecret),
    }) as any;
    expect(enrolled.backupCodes).toHaveLength(8);
    expect(await backupHashes()).toHaveLength(8);

    const sequentialCode = enrolled.backupCodes[0];
    const sequentialChallenge = await pendingChallenge();
    const firstUse = await second.auth.verifyMfa({
      challengeToken: sequentialChallenge.challengeToken,
      code: sequentialCode,
    }) as any;
    expect(firstUse.accessToken).toEqual(expect.any(String));
    expect(firstUse.refreshToken).toMatch(/^rt_/);
    expect(await backupHashes()).toHaveLength(7);

    const replayChallenge = await pendingChallenge();
    await expect(second.auth.verifyMfa({
      challengeToken: replayChallenge.challengeToken,
      code: sequentialCode,
    })).rejects.toThrow(/Invalid or expired MFA challenge/i);
    expect(await backupHashes()).toHaveLength(7);

    const concurrentCode = enrolled.backupCodes[1];
    const left = await pendingChallenge();
    const right = await pendingChallenge();
    const attempts = await Promise.allSettled([
      first.auth.verifyMfa({ challengeToken: left.challengeToken, code: concurrentCode }),
      second.auth.verifyMfa({ challengeToken: right.challengeToken, code: concurrentCode }),
    ]);

    expect(attempts.filter((attempt) => attempt.status === 'fulfilled')).toHaveLength(1);
    expect(attempts.filter((attempt) => attempt.status === 'rejected')).toHaveLength(1);
    expect(await backupHashes()).toHaveLength(6);

    const loserIndex = attempts.findIndex((attempt) => attempt.status === 'rejected');
    const loserToken = loserIndex === 0 ? left.challengeToken : right.challengeToken;
    const loserChallengeId = String(loserToken).split('.')[0];
    const loserRows = await first.prisma.$queryRaw<Array<{
      challenge_status: string;
      attempts: number;
      refresh_count: bigint;
    }>>`
      SELECT
        c.status AS challenge_status,
        c.attempts,
        COUNT(rt.id)::bigint AS refresh_count
      FROM auth.mfa_challenges c
      JOIN auth.sessions s ON s.id = c.session_id
      LEFT JOIN auth.refresh_tokens rt ON rt.session_id = s.id
      WHERE c.id = ${loserChallengeId}
      GROUP BY c.status, c.attempts
    `;
    expect(loserRows).toEqual([
      expect.objectContaining({
        challenge_status: 'PENDING',
        attempts: 1,
        refresh_count: 0n,
      }),
    ]);
  });
});
