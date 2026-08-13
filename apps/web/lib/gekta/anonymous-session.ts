import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Signed anonymous session for the Gekta free tier.
 *
 * The counter lives in a signed, HttpOnly cookie: the browser carries it but
 * cannot forge it, and the count is only ever changed by the server. This is
 * deliberately not localStorage.
 *
 * Known and accepted limit: without an identified account, a visitor can always
 * discard the cookie and start a new anonymous session. No amount of
 * fingerprinting would make this absolute, and covert fingerprinting is not
 * something this product does. Registration is what makes the count durable.
 */

export const GEKTA_ANONYMOUS_COOKIE = 'gekta_anon';
export const GEKTA_ANONYMOUS_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;
export const GEKTA_ANSWER_TICKET_MAX_AGE_MS = 10 * 60 * 1_000;

export type GektaAnonymousSession = Readonly<{
  /** Opaque session id. Never derived from anything about the device or person. */
  sid: string;
  /** Completed assistant responses charged to this session. */
  used: number;
  /** An issued-but-unsettled answer, so an abandoned stream still costs one. */
  pending: string | null;
  issuedAt: number;
  /** Recorded acceptance of the legal notice: which version, and when. */
  consent?: Readonly<{ version: string; at: number }> | null;
}>;

let processSecret: string | null = null;

function secret(): string {
  const configured = process.env.GEKTA_ANONYMOUS_SESSION_SECRET;
  if (configured && configured.length >= 16) return configured;
  // No configured secret: stay signed with a per-process key rather than fall
  // back to an unsigned counter. Sessions then reset when the process restarts.
  if (!processSecret) processSecret = randomBytes(32).toString('hex');
  return processSecret;
}

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('base64url');
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function createAnonymousSession(now: Date = new Date()): GektaAnonymousSession {
  return { sid: randomBytes(16).toString('base64url'), used: 0, pending: null, issuedAt: now.getTime() };
}

export function serializeAnonymousSession(session: GektaAnonymousSession): string {
  const payload = Buffer.from(JSON.stringify(session), 'utf8').toString('base64url');
  return `${payload}.${sign(payload)}`;
}

/** Returns null for anything unsigned, tampered with or structurally invalid. */
export function parseAnonymousSession(
  raw: string | undefined | null,
  now: Date = new Date(),
): GektaAnonymousSession | null {
  if (!raw) return null;
  const separator = raw.lastIndexOf('.');
  if (separator <= 0) return null;
  const payload = raw.slice(0, separator);
  const signature = raw.slice(separator + 1);
  if (!safeEqual(signature, sign(payload))) return null;

  try {
    const decoded: unknown = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) return null;
    const value = decoded as Record<string, unknown>;
    if (typeof value.sid !== 'string' || !/^[A-Za-z0-9_-]{20,32}$/u.test(value.sid)) return null;
    if (typeof value.used !== 'number' || !Number.isSafeInteger(value.used) || value.used < 0) return null;
    if (typeof value.issuedAt !== 'number' || !Number.isSafeInteger(value.issuedAt)) return null;
    const age = now.getTime() - value.issuedAt;
    if (age < -60_000 || age > GEKTA_ANONYMOUS_COOKIE_MAX_AGE_SECONDS * 1_000) return null;
    const pending = typeof value.pending === 'string' && value.pending ? value.pending : null;
    const rawConsent = value.consent;
    let consent: { version: string; at: number } | null = null;
    if (rawConsent && typeof rawConsent === 'object' && !Array.isArray(rawConsent)) {
      const record = rawConsent as Record<string, unknown>;
      if (typeof record.version === 'string' && typeof record.at === 'number' && Number.isFinite(record.at)) {
        consent = { version: record.version, at: record.at };
      }
    }
    return { sid: value.sid, used: value.used, pending, issuedAt: value.issuedAt, consent };
  } catch {
    return null;
  }
}

export function recordConsent(session: GektaAnonymousSession, version: string, now: Date): GektaAnonymousSession {
  return { ...session, consent: { version, at: now.getTime() } };
}

export function issueTicket(now: Date = new Date()): string {
  return `${now.getTime().toString(36)}.${randomBytes(12).toString('base64url')}`;
}

export function isFreshAnswerTicket(ticket: string, now: Date = new Date()): boolean {
  const match = /^([0-9a-z]{8,12})\.([A-Za-z0-9_-]{16})$/u.exec(ticket);
  if (!match) return false;
  const issuedAt = Number.parseInt(match[1] || '', 36);
  if (!Number.isSafeInteger(issuedAt)) return false;
  const age = now.getTime() - issuedAt;
  return age >= -60_000 && age <= GEKTA_ANSWER_TICKET_MAX_AGE_MS;
}

/**
 * Settle an outstanding ticket. An answer that was started and never reported as
 * completed is charged here, so dropping the completion call buys nothing.
 */
export function settlePending(session: GektaAnonymousSession): GektaAnonymousSession {
  if (!session.pending) return session;
  return { ...session, used: session.used + 1, pending: null };
}

export function reserveAnswer(session: GektaAnonymousSession, ticket: string): GektaAnonymousSession {
  return { ...session, pending: ticket };
}

export function completeAnswer(session: GektaAnonymousSession, ticket: string): GektaAnonymousSession {
  if (!session.pending || session.pending !== ticket) return session;
  return { ...session, used: session.used + 1, pending: null };
}

/**
 * Admit the reserved generation itself, not a later client-reported callback.
 * The ticket is single-use in the signed session carried by the browser, so a
 * direct chat POST without a reservation cannot bypass the free-answer gate.
 */
export function admitReservedAnswer(
  session: GektaAnonymousSession,
  ticket: string,
  now: Date = new Date(),
): GektaAnonymousSession | null {
  if (!ticket || session.pending !== ticket || !isFreshAnswerTicket(ticket, now)) return null;
  return { ...session, used: session.used + 1, pending: null };
}
