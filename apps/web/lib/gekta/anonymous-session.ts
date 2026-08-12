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

export type GektaAnonymousSession = Readonly<{
  /** Opaque session id. Never derived from anything about the device or person. */
  sid: string;
  /** Completed assistant responses charged to this session. */
  used: number;
  /** An issued-but-unsettled answer, so an abandoned stream still costs one. */
  pending: string | null;
  issuedAt: number;
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
export function parseAnonymousSession(raw: string | undefined | null): GektaAnonymousSession | null {
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
    if (typeof value.sid !== 'string' || !value.sid) return null;
    if (typeof value.used !== 'number' || !Number.isFinite(value.used) || value.used < 0) return null;
    if (typeof value.issuedAt !== 'number' || !Number.isFinite(value.issuedAt)) return null;
    const pending = typeof value.pending === 'string' && value.pending ? value.pending : null;
    return { sid: value.sid, used: Math.floor(value.used), pending, issuedAt: value.issuedAt };
  } catch {
    return null;
  }
}

export function issueTicket(): string {
  return randomBytes(12).toString('base64url');
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
