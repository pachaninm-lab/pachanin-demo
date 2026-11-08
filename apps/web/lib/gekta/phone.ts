import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Телефон как обязательный атрибут аккаунта Гекты.
 *
 * Номер обязателен при регистрации, но он не является доказательством владения
 * до тех пор, пока владение фактически не подтверждено внешним каналом.
 * Поэтому состояние объявленного номера и состояние подтверждённого номера —
 * разные вещи, и продукт никогда не называет `DECLARED` подтверждённым.
 *
 * Хранение: канонический номер шифруется (AES-256-GCM), а поиск идёт по
 * отдельному HMAC-индексу с собственным перцем. Компрометация индекса не
 * раскрывает номера, а компрометация шифротекста не даёт искать по нему.
 * Простой несолёный SHA не используется: телефонное пространство мало и
 * перебирается по словарю за минуты.
 */

export type PhoneState = 'DECLARED' | 'VERIFIED' | 'CONFLICTED' | 'REVOKED';

export type NormalizedPhone = Readonly<{ e164: string; country: 'RU' | 'OTHER' }>;

const RU_LENGTH = 11;

/**
 * Приводит ввод к каноническому E.164. Для России принимает 8XXXXXXXXXX,
 * 7XXXXXXXXXX и +7XXXXXXXXXX — все три дают один и тот же канонический номер,
 * иначе один человек выглядел бы как три разных аккаунта.
 */
export function normalizePhone(raw: string): NormalizedPhone | null {
  const input = raw.trim();
  if (!input) return null;
  const hasPlus = input.startsWith('+');
  const digits = input.replace(/\D/gu, '');
  if (!digits) return null;

  if (!hasPlus && digits.length === RU_LENGTH && (digits.startsWith('8') || digits.startsWith('7'))) {
    return { e164: `+7${digits.slice(1)}`, country: 'RU' };
  }
  if (digits.length === 10 && !hasPlus) {
    // Российский номер без кода страны.
    return { e164: `+7${digits}`, country: 'RU' };
  }
  if (digits.startsWith('7') && digits.length === RU_LENGTH) {
    return { e164: `+7${digits.slice(1)}`, country: 'RU' };
  }
  // Прочие страны: 8–15 значащих цифр по E.164.
  if (digits.length >= 8 && digits.length <= 15) {
    return { e164: `+${digits}`, country: 'OTHER' };
  }
  return null;
}

export function isValidPhone(raw: string): boolean {
  return normalizePhone(raw) !== null;
}

/** Маска для интерфейса оператора и писем: последние две цифры и код страны. */
export function maskPhone(e164: string): string {
  if (e164.length < 6) return '***';
  return `${e164.slice(0, 2)}${'*'.repeat(Math.max(0, e164.length - 4))}${e164.slice(-2)}`;
}

function keyFrom(value: string | undefined, name: string): Buffer | null {
  if (!value) return null;
  const trimmedValue = value.trim();
  const buffer = /^[0-9a-f]{64}$/iu.test(trimmedValue)
    ? Buffer.from(trimmedValue, 'hex')
    : Buffer.from(trimmedValue, 'base64');
  if (buffer.length !== 32) {
    throw new Error(`${name} must decode to exactly 32 bytes`);
  }
  return buffer;
}

export function phoneStorageAvailable(env: NodeJS.ProcessEnv = process.env): boolean {
  try {
    return Boolean(keyFrom(env.GEKTA_PHONE_ENCRYPTION_KEY, 'GEKTA_PHONE_ENCRYPTION_KEY')) && Boolean(env.GEKTA_PHONE_LOOKUP_PEPPER?.trim());
  } catch {
    return false;
  }
}

export function encryptPhone(e164: string, env: NodeJS.ProcessEnv = process.env): string {
  const key = keyFrom(env.GEKTA_PHONE_ENCRYPTION_KEY, 'GEKTA_PHONE_ENCRYPTION_KEY');
  if (!key) throw new Error('phone encryption key is not configured');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(e164, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString('base64url')}.${ciphertext.toString('base64url')}.${tag.toString('base64url')}`;
}

export function decryptPhone(stored: string, env: NodeJS.ProcessEnv = process.env): string | null {
  const key = keyFrom(env.GEKTA_PHONE_ENCRYPTION_KEY, 'GEKTA_PHONE_ENCRYPTION_KEY');
  if (!key) return null;
  const parts = stored.split('.');
  if (parts.length !== 4 || parts[0] !== 'v1') return null;
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(parts[1], 'base64url'));
    decipher.setAuthTag(Buffer.from(parts[3], 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(parts[2], 'base64url')), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

/**
 * Детерминированный индекс поиска. Только точное совпадение: частичный поиск
 * по номеру невозможен по построению, поэтому перебор по частям исключён.
 */
export function phoneLookupHash(e164: string, env: NodeJS.ProcessEnv = process.env): string | null {
  const pepper = env.GEKTA_PHONE_LOOKUP_PEPPER?.trim();
  if (!pepper) return null;
  return createHmac('sha256', pepper).update(`gekta-phone-v1:${e164}`).digest('base64url');
}

export function phoneLookupMatches(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export type PhoneClaim = Readonly<{ accountId: string; state: PhoneState }>;

/**
 * Решение о состоянии заявленного номера при коллизии.
 *
 * Номер нельзя «занять» навсегда: пока владение не подтверждено, повторное
 * заявление того же номера другим аккаунтом не блокирует ни одну из сторон —
 * обе попадают в `CONFLICTED`, и владелец разбирает коллизию по account ID.
 * Подтверждённый номер уникален и вытесняет только неподтверждённые заявки.
 */
export function resolvePhoneClaim(existing: readonly PhoneClaim[], newAccountId: string): {
  state: PhoneState;
  conflicts: readonly string[];
} {
  const verified = existing.filter((claim) => claim.state === 'VERIFIED' && claim.accountId !== newAccountId);
  if (verified.length > 0) {
    return { state: 'CONFLICTED', conflicts: verified.map((claim) => claim.accountId) };
  }
  const declared = existing.filter((claim) => claim.state === 'DECLARED' && claim.accountId !== newAccountId);
  if (declared.length > 0) {
    return { state: 'CONFLICTED', conflicts: declared.map((claim) => claim.accountId) };
  }
  return { state: 'DECLARED', conflicts: [] };
}

/**
 * Ответ публичной ручки никогда не различает «номер занят» и «номер свободен»:
 * иначе форма регистрации превращается в справочник зарегистрированных номеров.
 */
export function publicPhoneAvailabilityResponse(): { status: 'accepted' } {
  return { status: 'accepted' };
}
