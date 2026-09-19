import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { requireSecret } from '../../common/config/secrets';

/**
 * Bank-callback signing-key registry with overlapping rotation windows and
 * immediate database-backed revocation.
 *
 * Key MATERIAL is delivered only through the environment / secret manager:
 *  - BANK_HMAC_KEYS: JSON array of
 *      { keyId, partnerId?, secret, notBefore?, notAfter? }
 *    Multiple entries may be valid at once — that is what allows a partner to
 *    roll keys without downtime (old key stays valid until notAfter).
 *  - BANK_HMAC_SECRET (+ BANK_HMAC_KEY_ID, default "primary"): legacy single
 *    key, still honoured so existing deployments keep working.
 *
 * Rotation STATE that must apply immediately across every API instance lives
 * in PostgreSQL: a row in bank_key_revocations disables the key everywhere on
 * the next request. Fail closed: unknown, not-yet-valid, expired and revoked
 * keys are all rejected the same way, with a security audit trail written by
 * the caller.
 */

export interface BankSigningKey {
  keyId: string;
  partnerId: string;
  secret: string;
  notBefore?: Date;
  notAfter?: Date;
}

export type BankKeyRejection =
  | 'UNKNOWN_KEY'
  | 'PARTNER_MISMATCH'
  | 'KEY_NOT_YET_VALID'
  | 'KEY_EXPIRED'
  | 'KEY_REVOKED';

export class BankKeyError extends UnauthorizedException {
  constructor(readonly rejection: BankKeyRejection, keyId: string) {
    super({ code: rejection, message: `Bank signing key ${keyId} rejected: ${rejection}` });
  }
}

function parseConfiguredKeys(env: Record<string, string | undefined>): BankSigningKey[] {
  const keys: BankSigningKey[] = [];
  const raw = String(env.BANK_HMAC_KEYS ?? '').trim();
  if (raw) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      throw new Error(`BANK_HMAC_KEYS is not valid JSON: ${(error as Error).message}`);
    }
    if (!Array.isArray(parsed)) {
      throw new Error('BANK_HMAC_KEYS must be a JSON array of key entries.');
    }
    for (const entry of parsed as Array<Record<string, unknown>>) {
      const keyId = String(entry.keyId ?? '').trim();
      const secret = String(entry.secret ?? '').trim();
      if (!keyId || secret.length < 32) {
        throw new Error('Every BANK_HMAC_KEYS entry requires keyId and a secret of at least 32 chars.');
      }
      keys.push({
        keyId,
        partnerId: String(entry.partnerId ?? env.BANK_PARTNER_ID ?? 'safe-deals'),
        secret,
        notBefore: entry.notBefore ? new Date(String(entry.notBefore)) : undefined,
        notAfter: entry.notAfter ? new Date(String(entry.notAfter)) : undefined,
      });
    }
  }

  // Legacy single-key configuration stays valid alongside rotated keys.
  const legacyKeyId = String(env.BANK_HMAC_KEY_ID ?? 'primary');
  if (!keys.some((key) => key.keyId === legacyKeyId)) {
    keys.push({
      keyId: legacyKeyId,
      partnerId: String(env.BANK_PARTNER_ID ?? 'safe-deals'),
      secret: requireSecret('BANK_HMAC_SECRET'),
    });
  }
  return keys;
}

@Injectable()
export class BankKeyRegistryService {
  private readonly logger = new Logger(BankKeyRegistryService.name);
  private readonly keys: Map<string, BankSigningKey>;

  constructor(private readonly prisma: PrismaService) {
    this.keys = new Map(parseConfiguredKeys(process.env).map((key) => [key.keyId, key]));
  }

  /**
   * Resolve the signing secret for (partnerId, keyId) or reject fail-closed.
   * Revocation is checked against PostgreSQL on every call so it takes effect
   * immediately on every instance — no cache window for a compromised key.
   */
  async resolveActiveKey(partnerId: string, keyId: string, now = new Date()): Promise<BankSigningKey> {
    const key = this.keys.get(keyId);
    if (!key) throw new BankKeyError('UNKNOWN_KEY', keyId);
    if (key.partnerId !== partnerId) throw new BankKeyError('PARTNER_MISMATCH', keyId);
    if (key.notBefore && now < key.notBefore) throw new BankKeyError('KEY_NOT_YET_VALID', keyId);
    if (key.notAfter && now > key.notAfter) throw new BankKeyError('KEY_EXPIRED', keyId);

    const revocation = await this.prisma.bankKeyRevocation.findUnique({ where: { keyId } });
    if (revocation) throw new BankKeyError('KEY_REVOKED', keyId);

    return key;
  }

  /** Permanently revoke a key. Append-only at the database level. */
  async revoke(keyId: string, revokedByUserId: string, reason: string): Promise<{ keyId: string; revokedAt: Date }> {
    const key = this.keys.get(keyId);
    const revocation = await this.prisma.bankKeyRevocation.upsert({
      where: { keyId },
      update: {}, // append-only: an existing revocation is never rewritten
      create: {
        keyId,
        partnerId: key?.partnerId ?? 'unknown',
        revokedByUserId,
        reason,
      },
    });
    this.logger.warn(`Bank signing key revoked: ${keyId} by ${revokedByUserId} (${reason})`);
    return { keyId: revocation.keyId, revokedAt: revocation.revokedAt };
  }

  listConfigured(): Array<Omit<BankSigningKey, 'secret'>> {
    return [...this.keys.values()].map(({ secret: _secret, ...rest }) => rest);
  }
}
