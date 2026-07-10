import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { requireSecret } from '../../common/config/secrets';
import type { RequestUser } from '../../common/types/request-user';
import { MFA_ELEVATION_TTL_MS } from '../auth/auth-crypto';

const MFA_CHALLENGE_TTL_MS = 5 * 60 * 1000;
const MFA_KEY = createHash('sha256').update(requireSecret('MFA_ENCRYPTION_KEY')).digest();

function hotp(secret: Buffer, counter: number, digits = 6): string {
  const buf = Buffer.alloc(8);
  let tmp = counter;
  for (let i = 7; i >= 0; i -= 1) {
    buf[i] = tmp & 0xff;
    tmp = Math.floor(tmp / 256);
  }
  const hmac = createHmac('sha1', secret).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(code % 10 ** digits).padStart(digits, '0');
}

function base32Decode(encoded: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = encoded.toUpperCase().replace(/=+$/, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    const index = alphabet.indexOf(char);
    if (index < 0) throw new Error('Invalid base32 secret');
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function base32Encode(buf: Buffer): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += alphabet[(value << (5 - bits)) & 31];
  return output;
}

function verifyTotp(secret: string, code: string, now = Date.now()): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  const secretBuffer = base32Decode(secret);
  const counter = Math.floor(now / 1000 / 30);
  const supplied = Buffer.from(code, 'utf8');
  return [-1, 0, 1].some((window) => {
    const expected = Buffer.from(hotp(secretBuffer, counter + window), 'utf8');
    return expected.length === supplied.length && timingSafeEqual(expected, supplied);
  });
}

function encryptSecret(secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', MFA_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ['v1', iv.toString('base64url'), tag.toString('base64url'), encrypted.toString('base64url')].join(':');
}

function decryptSecret(value: string): string {
  const [version, ivRaw, tagRaw, payloadRaw] = value.split(':');
  if (version !== 'v1' || !ivRaw || !tagRaw || !payloadRaw) throw new Error('Invalid MFA ciphertext');
  const decipher = createDecipheriv('aes-256-gcm', MFA_KEY, Buffer.from(ivRaw, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(payloadRaw, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

function generateBackupCodes(count = 8): { plain: string[]; hashed: string[] } {
  const plain: string[] = [];
  const hashed: string[] = [];
  for (let index = 0; index < count; index += 1) {
    const normalized = randomBytes(6).toString('hex').toUpperCase();
    plain.push(`${normalized.slice(0, 4)}-${normalized.slice(4, 8)}-${normalized.slice(8)}`);
    hashed.push(createHash('sha256').update(normalized, 'utf8').digest('hex'));
  }
  return { plain, hashed };
}

function hashBackupCode(code: string): string {
  return createHash('sha256')
    .update(code.replace(/-/g, '').trim().toUpperCase(), 'utf8')
    .digest('hex');
}

@Injectable()
export class MfaService {
  constructor(private readonly prisma: PrismaService) {}

  async status(user: RequestUser) {
    const activeFactor = await this.prisma.mfaFactor.findFirst({
      where: { userId: user.id, status: 'ACTIVE' },
      select: { id: true, type: true, activatedAt: true, lastUsedAt: true },
    });
    return {
      enabled: Boolean(activeFactor),
      factor: activeFactor,
      elevated: Boolean(user.mfaVerified),
      elevationTtlSeconds: Math.floor(MFA_ELEVATION_TTL_MS / 1000),
    };
  }

  async beginSetup(user: RequestUser) {
    this.requireSession(user);
    const secret = base32Encode(randomBytes(20));
    const now = new Date();
    const expiresAt = new Date(now.getTime() + MFA_CHALLENGE_TTL_MS);

    const result = await this.prisma.$transaction(
      async (tx) => {
        await tx.mfaChallenge.updateMany({
          where: { userId: user.id, purpose: 'SETUP', status: 'PENDING' },
          data: { status: 'EXPIRED', consumedAt: now },
        });
        await tx.mfaFactor.updateMany({
          where: { userId: user.id, status: 'PENDING' },
          data: { status: 'REVOKED', revokedAt: now },
        });
        const factor = await tx.mfaFactor.create({
          data: {
            userId: user.id,
            type: 'TOTP',
            status: 'PENDING',
            secretCiphertext: encryptSecret(secret),
          },
        });
        const challenge = await tx.mfaChallenge.create({
          data: {
            userId: user.id,
            sessionId: user.sessionId,
            factorId: factor.id,
            purpose: 'SETUP',
            status: 'PENDING',
            expiresAt,
          },
        });
        return { factorId: factor.id, challengeId: challenge.id };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    const issuer = 'Прозрачная Цена';
    const otpauthUrl =
      `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(user.email)}` +
      `?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
    return {
      challengeId: result.challengeId,
      factorId: result.factorId,
      otpauthUrl,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async confirmSetup(user: RequestUser, challengeId: string, code: string) {
    this.requireSession(user);
    const now = new Date();
    const backup = generateBackupCodes();

    const result = await this.prisma.$transaction(
      async (tx) => {
        const challenge = await tx.mfaChallenge.findUnique({
          where: { id: challengeId },
          include: { factor: true },
        });
        this.assertChallenge(challenge, user, 'SETUP', now);
        if (!challenge?.factor || challenge.factor.status !== 'PENDING') {
          throw new BadRequestException('Pending MFA factor not found');
        }
        const secret = decryptSecret(challenge.factor.secretCiphertext);
        if (!verifyTotp(secret, code)) throw new UnauthorizedException('Invalid MFA code');

        await tx.mfaFactor.updateMany({
          where: { userId: user.id, status: 'ACTIVE', id: { not: challenge.factor.id } },
          data: { status: 'REVOKED', revokedAt: now },
        });
        await tx.mfaBackupCode.createMany({
          data: backup.hashed.map((codeHash) => ({
            id: randomUUID(),
            factorId: challenge.factor!.id,
            codeHash,
          })),
        });
        await tx.mfaFactor.update({
          where: { id: challenge.factor.id },
          data: { status: 'ACTIVE', activatedAt: now, lastUsedAt: now },
        });
        await tx.mfaChallenge.update({
          where: { id: challenge.id },
          data: { status: 'CONSUMED', verifiedAt: now, consumedAt: now },
        });
        await tx.user.update({ where: { id: user.id }, data: { mfaEnabled: true } });
        const elevated = await tx.authSession.updateMany({
          where: { id: user.sessionId, userId: user.id, status: 'ACTIVE', expiresAt: { gt: now } },
          data: { mfaVerifiedAt: now },
        });
        if (elevated.count !== 1) throw new UnauthorizedException('Active session required');
        return { factorId: challenge.factor.id };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return {
      success: true,
      factorId: result.factorId,
      backupCodes: backup.plain,
      elevationExpiresAt: new Date(now.getTime() + MFA_ELEVATION_TTL_MS).toISOString(),
    };
  }

  async beginStepUp(user: RequestUser) {
    this.requireSession(user);
    const factor = await this.prisma.mfaFactor.findFirst({
      where: { userId: user.id, status: 'ACTIVE' },
      orderBy: { activatedAt: 'desc' },
    });
    if (!factor) throw new BadRequestException('MFA is not configured');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + MFA_CHALLENGE_TTL_MS);
    const challenge = await this.prisma.mfaChallenge.create({
      data: {
        userId: user.id,
        sessionId: user.sessionId,
        factorId: factor.id,
        purpose: 'STEP_UP',
        status: 'PENDING',
        expiresAt,
      },
    });
    return { challengeId: challenge.id, expiresAt: expiresAt.toISOString() };
  }

  async verifyStepUp(
    user: RequestUser,
    input: { challengeId: string; code?: string; backupCode?: string },
  ) {
    this.requireSession(user);
    if (!input.code && !input.backupCode) throw new BadRequestException('MFA code is required');
    const now = new Date();

    await this.prisma.$transaction(
      async (tx) => {
        const challenge = await tx.mfaChallenge.findUnique({
          where: { id: input.challengeId },
          include: { factor: true },
        });
        this.assertChallenge(challenge, user, 'STEP_UP', now);
        if (!challenge?.factor || challenge.factor.status !== 'ACTIVE') {
          throw new BadRequestException('Active MFA factor not found');
        }

        let valid = false;
        if (input.code) {
          valid = verifyTotp(decryptSecret(challenge.factor.secretCiphertext), input.code);
        } else if (input.backupCode) {
          const used = await tx.mfaBackupCode.updateMany({
            where: {
              factorId: challenge.factor.id,
              codeHash: hashBackupCode(input.backupCode),
              usedAt: null,
            },
            data: { usedAt: now },
          });
          valid = used.count === 1;
        }
        if (!valid) throw new UnauthorizedException('Invalid MFA code');

        await tx.mfaFactor.update({
          where: { id: challenge.factor.id },
          data: { lastUsedAt: now },
        });
        await tx.mfaChallenge.update({
          where: { id: challenge.id },
          data: { status: 'CONSUMED', verifiedAt: now, consumedAt: now },
        });
        const elevated = await tx.authSession.updateMany({
          where: { id: user.sessionId, userId: user.id, status: 'ACTIVE', expiresAt: { gt: now } },
          data: { mfaVerifiedAt: now },
        });
        if (elevated.count !== 1) throw new UnauthorizedException('Active session required');
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return {
      valid: true,
      elevationExpiresAt: new Date(now.getTime() + MFA_ELEVATION_TTL_MS).toISOString(),
    };
  }

  assertMfaVerified(mfaVerified: boolean | undefined, requireMfa: boolean): void {
    if (requireMfa && !mfaVerified) {
      throw new UnauthorizedException('MFA verification required for this operation');
    }
  }

  private requireSession(user: RequestUser): asserts user is RequestUser & { sessionId: string } {
    if (!user.sessionId) throw new UnauthorizedException('Active session is required');
  }

  private assertChallenge(
    challenge:
      | {
          id: string;
          userId: string;
          sessionId: string | null;
          purpose: string;
          status: string;
          expiresAt: Date;
        }
      | null,
    user: RequestUser & { sessionId: string },
    purpose: 'SETUP' | 'STEP_UP',
    now: Date,
  ): void {
    if (
      !challenge ||
      challenge.userId !== user.id ||
      challenge.sessionId !== user.sessionId ||
      challenge.purpose !== purpose ||
      challenge.status !== 'PENDING' ||
      challenge.expiresAt <= now
    ) {
      throw new UnauthorizedException('MFA challenge is invalid or expired');
    }
  }
}
