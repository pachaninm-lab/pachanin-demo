import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { signCabinetSession } from '@/lib/platform-v7/verified-session';

const CABINET_SESSION_COOKIE = 'pc_v7_cabinet';
const TTL_SECONDS = 8 * 3600;

const ALLOWED_ROLES = new Set([
  'operator',
  'buyer',
  'seller',
  'logistics',
  'driver',
  'surveyor',
  'elevator',
  'lab',
  'bank',
  'arbitrator',
  'compliance',
  'executive',
]);

function readEnv(name: string): string {
  return String(process.env[name] || '').trim();
}

function safeEqual(a: string, b: string): boolean {
  if (!a || !b) return false;
  let diff = a.length ^ b.length;
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i += 1) {
    diff |= a.charCodeAt(i % a.length) ^ b.charCodeAt(i % b.length);
  }
  return diff === 0;
}

function compact(value: string): string {
  return value.replace(/\s+/g, '');
}

/**
 * Constant-time credential comparison. Accepts only an exact match, or an exact
 * match after collapsing surrounding/duplicated whitespace (a pure UX
 * tolerance). Deliberately NO digit-only, suffix, or partial matching — those
 * silently reduced the password to a handful of trailing digits.
 */
function passwordMatches(input: string, configured: string): boolean {
  if (!input || !configured) return false;
  if (safeEqual(input, configured)) return true;
  return safeEqual(compact(input), compact(configured));
}

function passwordCandidates(): string[] {
  return [
    readEnv('PC_CABINET_LOCK_PASSWORD'),
    readEnv('PC_PRIVATE_PASSWORD'),
    readEnv('PC_OWNER_KEY'),
  ].filter(Boolean);
}

/**
 * Secret used to sign the cabinet session JWT. Must come from real configured
 * secrets only — never a hard-coded PIN hash. If none is configured the gate is
 * treated as unavailable (fail closed) rather than signing with a guessable key.
 */
function cabinetSessionSecret(): string {
  return readEnv('JWT_SECRET') || readEnv('PC_CABINET_SESSION_SECRET');
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const login = typeof body?.login === 'string' ? body.login.trim().toLowerCase() : '';
  const password = typeof body?.password === 'string' ? body.password.trim() : '';
  const role = typeof body?.role === 'string' ? body.role.trim() : '';

  if (!ALLOWED_ROLES.has(role)) {
    return NextResponse.json({ ok: false, reason: 'unknown_role' }, { status: 400 });
  }

  const configuredUser = readEnv('PC_CABINET_LOCK_USER').toLowerCase();
  const passwords = passwordCandidates();
  const sessionSecret = cabinetSessionSecret();

  // Fail closed when the gate is not fully configured — no hard-coded owner
  // login, no default password, no fallback signing secret.
  if (!configuredUser || passwords.length === 0 || !sessionSecret) {
    return NextResponse.json({ ok: false, reason: 'cabinet_not_configured' }, { status: 503 });
  }

  const loginAllowed = safeEqual(login, configuredUser);
  const passwordAllowed = passwords.some((configured) => passwordMatches(password, configured));

  if (!loginAllowed || !passwordAllowed) {
    return NextResponse.json(
      { ok: false, reason: !loginAllowed ? 'login_mismatch' : 'password_mismatch' },
      { status: 401 },
    );
  }

  const token = await signCabinetSession(role, sessionSecret, {
    nowSeconds: Math.floor(Date.now() / 1000),
    ttlSeconds: TTL_SECONDS,
  });

  if (!token) {
    return NextResponse.json({ ok: false, reason: 'cabinet_session_unavailable' }, { status: 503 });
  }

  cookies().set(CABINET_SESSION_COOKIE, token, {
    path: '/',
    maxAge: TTL_SECONDS,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });

  return NextResponse.json({ ok: true, marker: 'cabinet-gate-hard-v2' });
}
