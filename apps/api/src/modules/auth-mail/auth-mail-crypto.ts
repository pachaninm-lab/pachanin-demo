import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  hkdfSync,
  randomBytes,
} from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const KEY_BYTES = 32;
const IV_BYTES = 12;
const MAX_ENVELOPE_BYTES = 48 * 1024;
const MAX_KEY_VERSION = 999;
const HKDF_SALT = Buffer.from('pc-auth-mail-keyring-v1', 'utf8');

export type AuthMailEnvelope = {
  to: string;
  subject: string;
  text: string;
};

export type EncryptedAuthMailEnvelope = {
  ciphertext: string;
  iv: string;
  tag: string;
  keyVersion: number;
};

function production(): boolean {
  return String(process.env.NODE_ENV ?? '').trim().toLowerCase() === 'production';
}

function positiveKeyVersion(value: string | number | undefined): number {
  const parsed = Number(value ?? 1);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_KEY_VERSION) {
    throw new Error(`Auth-mail key version must be an integer between 1 and ${MAX_KEY_VERSION}`);
  }
  return parsed;
}

function decodeKey(rawInput: string): Buffer {
  const raw = String(rawInput ?? '').trim();
  if (!/^[a-fA-F0-9]{64}$/.test(raw)) {
    throw new Error('Auth-mail key must be exactly 32 bytes encoded as 64 hexadecimal characters');
  }
  const key = Buffer.from(raw, 'hex');
  if (key.length !== KEY_BYTES) throw new Error('Auth-mail key has an invalid decoded length');
  return key;
}

const cachedMasterKeys = new Map<number, Buffer>();
let cachedCurrentVersion: number | null = null;

function keyFileForVersion(version: number): string {
  const directory = String(process.env.AUTH_MAIL_OUTBOX_KEYRING_DIR ?? '').trim();
  if (!directory || !path.isAbsolute(directory)) {
    throw new Error('AUTH_MAIL_OUTBOX_KEYRING_DIR must be an absolute path in production');
  }
  return path.join(directory, `v${version}.key`);
}

export function resolveCurrentAuthMailKeyVersion(): number {
  if (cachedCurrentVersion !== null) return cachedCurrentVersion;
  const versionFile = String(process.env.AUTH_MAIL_OUTBOX_CURRENT_KEY_VERSION_FILE ?? '').trim();
  if (versionFile) {
    cachedCurrentVersion = positiveKeyVersion(readFileSync(versionFile, 'utf8').trim());
    return cachedCurrentVersion;
  }
  if (production()) {
    throw new Error('AUTH_MAIL_OUTBOX_CURRENT_KEY_VERSION_FILE is required in production');
  }
  cachedCurrentVersion = positiveKeyVersion(process.env.AUTH_MAIL_OUTBOX_CURRENT_KEY_VERSION || '1');
  return cachedCurrentVersion;
}

export function resolveAuthMailOutboxKey(version = resolveCurrentAuthMailKeyVersion()): Buffer {
  const normalizedVersion = positiveKeyVersion(version);
  const existing = cachedMasterKeys.get(normalizedVersion);
  if (existing) return existing;

  let raw: string;
  if (production()) {
    raw = readFileSync(keyFileForVersion(normalizedVersion), 'utf8');
  } else {
    raw = String(
      process.env[`AUTH_MAIL_OUTBOX_KEY_V${normalizedVersion}`]
      || (normalizedVersion === 1 ? process.env.AUTH_MAIL_OUTBOX_KEY : '')
      || '',
    );
    if (!raw.trim()) {
      throw new Error(`AUTH_MAIL_OUTBOX_KEY_V${normalizedVersion} is required outside production`);
    }
  }

  const decoded = decodeKey(raw);
  cachedMasterKeys.set(normalizedVersion, decoded);
  return decoded;
}

function derivedKey(version: number, purpose: 'encryption' | 'replay-digest'): Buffer {
  return Buffer.from(hkdfSync(
    'sha256',
    resolveAuthMailOutboxKey(version),
    HKDF_SALT,
    Buffer.from(`pc-auth-mail:${purpose}:v1`, 'utf8'),
    KEY_BYTES,
  ));
}

function canonicalAad(input: {
  kind: string;
  idempotencyKey: string;
  correlationId: string;
  keyVersion: number;
}): Buffer {
  return Buffer.from([
    'pc-auth-mail-outbox',
    String(input.keyVersion),
    input.kind,
    input.idempotencyKey,
    input.correlationId,
  ].join('\u001f'), 'utf8');
}

function validateEmail(value: string): string {
  const email = String(value ?? '').trim().toLowerCase();
  if (!/^[^\s@]{1,64}@[^\s@]{1,189}$/.test(email) || /[\r\n\0]/.test(email)) {
    throw new Error('Auth mail recipient is invalid');
  }
  return email;
}

export function normalizeAuthMailEnvelope(input: AuthMailEnvelope): AuthMailEnvelope {
  const to = validateEmail(input.to);
  const subject = String(input.subject ?? '').trim();
  const text = String(input.text ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (!subject || subject.length > 240 || /[\r\n\0]/.test(subject)) {
    throw new Error('Auth mail subject is invalid');
  }
  if (!text || Buffer.byteLength(text, 'utf8') > 32 * 1024 || text.includes('\0')) {
    throw new Error('Auth mail text is invalid');
  }
  return { to, subject, text };
}

function canonicalEnvelopeBytes(envelopeInput: AuthMailEnvelope): Buffer {
  const envelope = normalizeAuthMailEnvelope(envelopeInput);
  const plaintext = Buffer.from(JSON.stringify(envelope), 'utf8');
  if (plaintext.length > MAX_ENVELOPE_BYTES) {
    plaintext.fill(0);
    throw new Error('Auth mail envelope exceeds the encrypted payload limit');
  }
  return plaintext;
}

export function authMailReplayDigest(
  envelopeInput: AuthMailEnvelope,
  context: { kind: string; idempotencyKey: string },
  keyVersion = resolveCurrentAuthMailKeyVersion(),
): string {
  const plaintext = canonicalEnvelopeBytes(envelopeInput);
  try {
    return createHmac('sha256', derivedKey(keyVersion, 'replay-digest'))
      .update('pc-auth-mail-replay-v1\u001f', 'utf8')
      .update(context.kind, 'utf8')
      .update('\u001f', 'utf8')
      .update(context.idempotencyKey, 'utf8')
      .update('\u001f', 'utf8')
      .update(plaintext)
      .digest('hex');
  } finally {
    plaintext.fill(0);
  }
}

export function encryptAuthMailEnvelope(
  envelopeInput: AuthMailEnvelope,
  context: { kind: string; idempotencyKey: string; correlationId: string },
): EncryptedAuthMailEnvelope {
  const keyVersion = resolveCurrentAuthMailKeyVersion();
  const plaintext = canonicalEnvelopeBytes(envelopeInput);
  const iv = randomBytes(IV_BYTES);
  const encryptionKey = derivedKey(keyVersion, 'encryption');
  try {
    const cipher = createCipheriv('aes-256-gcm', encryptionKey, iv);
    cipher.setAAD(canonicalAad({ ...context, keyVersion }));
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
      ciphertext: ciphertext.toString('base64url'),
      iv: iv.toString('base64url'),
      tag: tag.toString('base64url'),
      keyVersion,
    };
  } finally {
    plaintext.fill(0);
    encryptionKey.fill(0);
  }
}

export function decryptAuthMailEnvelope(
  encrypted: EncryptedAuthMailEnvelope,
  context: { kind: string; idempotencyKey: string; correlationId: string },
): AuthMailEnvelope {
  const keyVersion = positiveKeyVersion(encrypted.keyVersion);
  const iv = Buffer.from(encrypted.iv, 'base64url');
  const tag = Buffer.from(encrypted.tag, 'base64url');
  const ciphertext = Buffer.from(encrypted.ciphertext, 'base64url');
  if (iv.length !== IV_BYTES || tag.length !== 16 || ciphertext.length < 1 || ciphertext.length > MAX_ENVELOPE_BYTES) {
    throw new Error('Encrypted auth-mail payload shape is invalid');
  }

  const encryptionKey = derivedKey(keyVersion, 'encryption');
  try {
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey, iv);
    decipher.setAAD(canonicalAad({ ...context, keyVersion }));
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    try {
      const parsed = JSON.parse(plaintext.toString('utf8')) as Partial<AuthMailEnvelope>;
      return normalizeAuthMailEnvelope({
        to: String(parsed.to ?? ''),
        subject: String(parsed.subject ?? ''),
        text: String(parsed.text ?? ''),
      });
    } finally {
      plaintext.fill(0);
    }
  } finally {
    encryptionKey.fill(0);
  }
}

export function authMailEnvelopeDigest(encrypted: EncryptedAuthMailEnvelope): string {
  return createHash('sha256')
    .update(`${encrypted.keyVersion}.${encrypted.iv}.${encrypted.tag}.${encrypted.ciphertext}`, 'utf8')
    .digest('hex');
}

export function resetAuthMailKeyCacheForTests(): void {
  for (const key of cachedMasterKeys.values()) key.fill(0);
  cachedMasterKeys.clear();
  cachedCurrentVersion = null;
}
