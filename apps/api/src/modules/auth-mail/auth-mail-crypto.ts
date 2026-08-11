import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';

export const AUTH_MAIL_KEY_VERSION = 1 as const;
const KEY_BYTES = 32;
const IV_BYTES = 12;
const MAX_ENVELOPE_BYTES = 48 * 1024;

export type AuthMailEnvelope = {
  to: string;
  subject: string;
  text: string;
};

export type EncryptedAuthMailEnvelope = {
  ciphertext: string;
  iv: string;
  tag: string;
  keyVersion: typeof AUTH_MAIL_KEY_VERSION;
};

function production(): boolean {
  return String(process.env.NODE_ENV ?? '').trim().toLowerCase() === 'production';
}

function decodeKey(rawInput: string): Buffer {
  const raw = String(rawInput ?? '').trim();
  if (!/^[a-fA-F0-9]{64}$/.test(raw)) {
    throw new Error('AUTH_MAIL_OUTBOX_KEY must be exactly 32 bytes encoded as 64 hexadecimal characters');
  }
  const key = Buffer.from(raw, 'hex');
  if (key.length !== KEY_BYTES) throw new Error('AUTH_MAIL_OUTBOX_KEY has an invalid decoded length');
  return key;
}

let cachedKey: Buffer | null = null;

export function resolveAuthMailOutboxKey(): Buffer {
  if (cachedKey) return cachedKey;

  const file = String(process.env.AUTH_MAIL_OUTBOX_KEY_FILE ?? '').trim();
  if (file) {
    cachedKey = decodeKey(readFileSync(file, 'utf8'));
    return cachedKey;
  }

  if (production()) {
    throw new Error('AUTH_MAIL_OUTBOX_KEY_FILE is required in production; environment-carried auth-mail keys are forbidden');
  }

  const testValue = String(process.env.AUTH_MAIL_OUTBOX_KEY ?? '').trim();
  if (!testValue) {
    throw new Error('AUTH_MAIL_OUTBOX_KEY is required outside production when AUTH_MAIL_OUTBOX_KEY_FILE is not configured');
  }
  cachedKey = decodeKey(testValue);
  return cachedKey;
}

function canonicalAad(input: {
  kind: string;
  idempotencyKey: string;
  correlationId: string;
  keyVersion?: number;
}): Buffer {
  return Buffer.from([
    'pc-auth-mail-outbox',
    String(input.keyVersion ?? AUTH_MAIL_KEY_VERSION),
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

export function encryptAuthMailEnvelope(
  envelopeInput: AuthMailEnvelope,
  context: { kind: string; idempotencyKey: string; correlationId: string },
): EncryptedAuthMailEnvelope {
  const envelope = normalizeAuthMailEnvelope(envelopeInput);
  const plaintext = Buffer.from(JSON.stringify(envelope), 'utf8');
  if (plaintext.length > MAX_ENVELOPE_BYTES) throw new Error('Auth mail envelope exceeds the encrypted payload limit');

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', resolveAuthMailOutboxKey(), iv);
  cipher.setAAD(canonicalAad(context));
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  plaintext.fill(0);

  return {
    ciphertext: ciphertext.toString('base64url'),
    iv: iv.toString('base64url'),
    tag: tag.toString('base64url'),
    keyVersion: AUTH_MAIL_KEY_VERSION,
  };
}

export function decryptAuthMailEnvelope(
  encrypted: EncryptedAuthMailEnvelope,
  context: { kind: string; idempotencyKey: string; correlationId: string },
): AuthMailEnvelope {
  if (encrypted.keyVersion !== AUTH_MAIL_KEY_VERSION) {
    throw new Error(`Unsupported auth-mail key version: ${encrypted.keyVersion}`);
  }
  const iv = Buffer.from(encrypted.iv, 'base64url');
  const tag = Buffer.from(encrypted.tag, 'base64url');
  const ciphertext = Buffer.from(encrypted.ciphertext, 'base64url');
  if (iv.length !== IV_BYTES || tag.length !== 16 || ciphertext.length < 1 || ciphertext.length > MAX_ENVELOPE_BYTES) {
    throw new Error('Encrypted auth-mail payload shape is invalid');
  }

  const decipher = createDecipheriv('aes-256-gcm', resolveAuthMailOutboxKey(), iv);
  decipher.setAAD(canonicalAad({ ...context, keyVersion: encrypted.keyVersion }));
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
}

export function authMailEnvelopeDigest(encrypted: EncryptedAuthMailEnvelope): string {
  return createHash('sha256')
    .update(`${encrypted.keyVersion}.${encrypted.iv}.${encrypted.tag}.${encrypted.ciphertext}`, 'utf8')
    .digest('hex');
}

export function resetAuthMailKeyCacheForTests(): void {
  if (cachedKey) cachedKey.fill(0);
  cachedKey = null;
}
