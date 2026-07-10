import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'crypto';
import { requireSecret } from '../../common/config/secrets';

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

export function makeOpaqueToken(prefix: 'rt' | 'mc'): {
  id: string;
  secret: string;
  token: string;
  hash: string;
} {
  const id = `${prefix}_${randomBytes(18).toString('base64url')}`;
  const secret = randomBytes(32).toString('base64url');
  const token = `${id}.${secret}`;
  return { id, secret, token, hash: hashAuthMaterial(token) };
}

export function parseOpaqueToken(token: string, prefix: 'rt' | 'mc'): {
  id: string;
  hash: string;
} | null {
  const [id, secret, extra] = String(token ?? '').split('.');
  if (extra || !id || !secret || !id.startsWith(`${prefix}_`) || secret.length < 32) return null;
  return { id, hash: hashAuthMaterial(`${id}.${secret}`) };
}

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

export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

function totpAt(secret: string, unixMs: number): string {
  const counter = BigInt(Math.floor(unixMs / 30_000));
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
  return [-1, 0, 1].some((offset) => secureEqual(totpAt(secret, unixMs + offset * 30_000), normalized));
}

export function buildOtpAuthUri(email: string, secret: string): string {
  const issuer = 'Transparent Price';
  const label = `${issuer}:${email}`;
  return `otpauth://totp/${encodeURIComponent(label)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

export function generateBackupCodes(count = 8): { codes: string[]; hashes: string[] } {
  const codes = Array.from({ length: count }, () => {
    const raw = randomBytes(6).toString('hex').toUpperCase();
    return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
  });
  return { codes, hashes: codes.map(hashAuthMaterial) };
}
