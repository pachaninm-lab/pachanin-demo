import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'crypto';
import { requireSecret } from '../../common/config/secrets';
import { issueMfaBackupCodeCredential } from './opaque-token-authority';

const JWT_SECRET = requireSecret('JWT_SECRET');
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const MFA_KEY_VERSION = 'v1';

function production(): boolean {
  return String(process.env.NODE_ENV ?? '').toLowerCase() === 'production';
}

function secretOrFallback(name: string): string {
  const configured = String(process.env[name] ?? '').trim();
  if (configured) return configured;
  if (production()) {
    throw new Error(`${name} is required in production`);
  }
  return JWT_SECRET;
}

function keyFrom(name: string): Buffer {
  return createHash('sha256').update(secretOrFallback(name), 'utf8').digest();
}

export function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function stableJson(value: unknown): string {
  const normalize = (item: unknown): unknown => {
    if (Array.isArray(item)) return item.map(normalize);
    if (item && typeof item === 'object') {
      return Object.fromEntries(
        Object.entries(item as Record<string, unknown>)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, entry]) => [key, normalize(entry)]),
      );
    }
    return item;
  };
  return JSON.stringify(normalize(value));
}

export function hashAuthMaterial(value: string): string {
  return createHmac('sha256', keyFrom('AUTH_TOKEN_PEPPER')).update(value, 'utf8').digest('hex');
}

export function hashClientValue(value?: string | null): string | null {
  const normalized = String(value ?? '').trim();
  return normalized ? hashAuthMaterial(normalized) : null;
}

/**
 * There is deliberately no password fingerprint helper here.
 *
 * A password belongs to the credential contour and nowhere else: bcrypt when
 * it is stored, bcrypt when it is verified. It is never an input to an
 * idempotency, audit or correlation fingerprint, is never returned from a
 * helper, and is never written to an event or a log. A short-lived KDF-based
 * fingerprint used to exist here so an idempotent retry could notice a swapped
 * credential; it was removed with its call site, because any password-derived
 * value inside a stored request hash makes that hash an offline oracle for the
 * password no matter how the derivation is tuned. Idempotency is decided by
 * non-secret canonical payload plus a server-issued key.
 *
 * There is no opaque token helper here either. A one-time token *is* a bearer
 * credential and its digest is what admits the bearer, so it belongs to
 * `opaque-token-authority.ts`: its own HKDF-derived key, its own purpose
 * binding and its own version. What is left in this module is the generic
 * keyed hash for material that is neither a password nor a credential —
 * request fingerprints, account hashes, client IP and user-agent hashes.
 *
 * `authCredentialBoundary.spec.ts` fails the build if either rule is broken:
 * a password reaching a fast or keyed hash, or an opaque token reaching
 * `hashAuthMaterial` instead of the authority.
 */

export function secureEqual(left: string, right: string): boolean {
  const a = Buffer.from(left, 'utf8');
  const b = Buffer.from(right, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

export function encryptMfaSecret(secret: string): { ciphertext: string; keyVersion: string } {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyFrom('MFA_ENCRYPTION_KEY'), iv);
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    keyVersion: MFA_KEY_VERSION,
    ciphertext: [MFA_KEY_VERSION, iv.toString('base64url'), tag.toString('base64url'), encrypted.toString('base64url')].join(':'),
  };
}

export function decryptMfaSecret(ciphertext: string): string {
  const [version, ivRaw, tagRaw, encryptedRaw] = String(ciphertext ?? '').split(':');
  if (version !== MFA_KEY_VERSION || !ivRaw || !tagRaw || !encryptedRaw) {
    throw new Error('Unsupported MFA ciphertext');
  }
  const decipher = createDecipheriv(
    'aes-256-gcm',
    keyFrom('MFA_ENCRYPTION_KEY'),
    Buffer.from(ivRaw, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

export function base32Encode(input: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of input) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

function base32Decode(input: string): Buffer {
  const normalized = input.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of normalized) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index < 0) continue;
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

export const TOTP_STEP_SECONDS = 30;
const TOTP_STEP_MS = TOTP_STEP_SECONDS * 1_000;

/**
 * Which time steps a submitted code is checked against, relative to the step
 * the server is in when it arrives.
 *
 * Only the current one. A step is 30 seconds, so this is the longest a single
 * code value can stay acceptable, and ASVS 5.0 V6.5.5 caps a TOTP's lifetime
 * at exactly that. Accepting the neighbouring steps as well - the usual
 * clock-drift allowance, and what this function used to do - keeps one code
 * value usable for close to ninety seconds from an attacker's side, which is
 * over the cap however reasonable the intent.
 *
 * This is a deliberate divergence from RFC 6238 s5.2, which recommends
 * allowing at most one step of drift. The two documents disagree; neither is
 * wrong, and this codebase follows the stricter bound. The practical cost is
 * that a device whose clock is off by more than a step stops being able to log
 * in by TOTP, which NTP-synchronised phones are not, and the practical gain is
 * that a code shoulder-surfed or captured in transit stops working within the
 * step rather than a minute later.
 *
 * Narrowing the window is not replay protection. The same code presented twice
 * inside its own step still verifies twice; that is V6.5.1, it needs durable
 * per-user state, and it is tracked separately in #4682.
 */
export const TOTP_ACCEPTED_STEP_OFFSETS: readonly number[] = Object.freeze([0]);

export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

function totpAt(secret: string, unixMs: number): string {
  const counter = BigInt(Math.floor(unixMs / TOTP_STEP_MS));
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(counter);
  const hmac = createHmac('sha1', base32Decode(secret)).update(buffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary = ((hmac[offset] & 0x7f) << 24)
    | ((hmac[offset + 1] & 0xff) << 16)
    | ((hmac[offset + 2] & 0xff) << 8)
    | (hmac[offset + 3] & 0xff);
  return String(binary % 1_000_000).padStart(6, '0');
}

export function verifyTotp(secret: string, code: string, unixMs = Date.now()): boolean {
  const normalized = String(code ?? '').replace(/\s+/g, '');
  if (!/^\d{6}$/.test(normalized)) return false;
  return TOTP_ACCEPTED_STEP_OFFSETS.some(
    (offset) => secureEqual(totpAt(secret, unixMs + offset * TOTP_STEP_MS), normalized),
  );
}

export function buildOtpAuthUri(email: string, secret: string): string {
  const issuer = 'Transparent Price';
  const label = `${issuer}:${email}`;
  return `otpauth://totp/${encodeURIComponent(label)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=${TOTP_STEP_SECONDS}`;
}

/**
 * 15 bytes is 120 bits, which clears the 112-bit safe harbour in 24 base32
 * characters with nothing left over to pad.
 */
export const BACKUP_CODE_ENTROPY_BYTES = 15;
const BACKUP_CODE_GROUP = 6;

/**
 * Mint one backup code.
 *
 * ASVS 5.0 V6.5.2 lets a lookup secret be kept under a standard hash only when
 * it carries 112 bits of entropy or more; below that it wants an approved
 * password-storage hash with a random salt. These were drawn from six bytes -
 * 48 bits - so the keyed HMAC they are stored under was not the option the
 * requirement allows, and of the two ways out, raising the secret is the one
 * that costs nothing at verification time.
 *
 * Salting would have cost more than it bought. A salted hash cannot be looked
 * up by value, so verification would have to try each of a user's stored codes
 * in turn; at password-hash cost that is seconds of work per attempt, and an
 * attacker submitting garbage would pay for none of it. Raising entropy keeps
 * verification a single deterministic digest and one index lookup.
 *
 * base32 rather than hex: RFC 4648 leaves out 0, 1, 8 and 9, so there is no
 * O/0 or I/1 to mistype, and 24 characters carry what 30 hex characters would.
 */
function mintBackupCode(): string {
  const raw = base32Encode(randomBytes(BACKUP_CODE_ENTROPY_BYTES));
  const groups: string[] = [];
  for (let index = 0; index < raw.length; index += BACKUP_CODE_GROUP) {
    groups.push(raw.slice(index, index + BACKUP_CODE_GROUP));
  }
  return groups.join('-');
}

/**
 * Backup codes are one-time bearer credentials, so their stored form comes from
 * the opaque token authority rather than the generic keyed hash: a backup code
 * cannot be presented as any other kind of token. Minting goes through the
 * authority's typed issuer for the same reason, so the purpose binding and the
 * digest version are structural here rather than restated at this call site.
 */
export function generateBackupCodes(count = 8): { codes: string[]; hashes: string[] } {
  const issued = Array.from({ length: count }, () =>
    issueMfaBackupCodeCredential(mintBackupCode()),
  );
  return {
    codes: issued.map((credential) => credential.rawToken),
    hashes: issued.map((credential) => credential.storedDigest),
  };
}
