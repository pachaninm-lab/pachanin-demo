import { randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ACCESS_COOKIE, CSRF_COOKIE, SESSION_COOKIE } from '@/lib/auth-cookies';
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

const ROLE_TEST_ACCOUNTS: Readonly<Record<string, string>> = {
  'operator.test': 'operator',
  'buyer.test': 'buyer',
  'seller.test': 'seller',
  'logistics.test': 'logistics',
  'driver.test': 'driver',
  'surveyor.test': 'surveyor',
  'elevator.test': 'elevator',
  'lab.test': 'lab',
  'bank.test': 'bank',
  'arbitrator.test': 'arbitrator',
  'compliance.test': 'compliance',
  'executive.test': 'executive',
};

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
 * tolerance). Deliberately NO digit-only, suffix, or partial matching.
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

function cabinetSessionSecret(): string {
  return readEnv('JWT_SECRET') || readEnv('PC_CABINET_SESSION_SECRET');
}

function controlledTestAccessEnabled(): boolean {
  if (readEnv('PC_CABINET_TEST_ACCESS').toLowerCase() !== 'true') return false;
  const expiresAt = readEnv('PC_CABINET_TEST_ACCESS_EXPIRES_AT');
  if (!expiresAt) return true;
  const expiresAtMs = Date.parse(expiresAt);
  return Number.isFinite(expiresAtMs) && expiresAtMs > Date.now();
}

function secureCookie(httpOnly: boolean) {
  return {
    path: '/',
    maxAge: TTL_SECONDS,
    httpOnly,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
  };
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const login = typeof body?.login === 'string' ? body.login.trim().toLowerCase() : '';
  const password = typeof body?.password === 'string' ? body.password.trim() : '';
  const requestedRole = typeof body?.role === 'string' ? body.role.trim() : '';

  if (!ALLOWED_ROLES.has(requestedRole)) {
    return NextResponse.json({ ok: false, reason: 'unknown_role' }, { status: 400 });
  }

  const configuredOwner = readEnv('PC_CABINET_LOCK_USER').toLowerCase();
  const ownerPasswords = passwordCandidates();
  const rolePassword = readEnv('PC_CABINET_ROLE_PASSWORD');
  const sessionSecret = cabinetSessionSecret();
  const testAccessEnabled = controlledTestAccessEnabled();
  const fixedRole = testAccessEnabled ? ROLE_TEST_ACCOUNTS[login] : undefined;
  const ownerLogin = Boolean(configuredOwner && safeEqual(login, configuredOwner));

  if (!sessionSecret || (!ownerLogin && !fixedRole)) {
    return NextResponse.json(
      { ok: false, reason: !sessionSecret ? 'cabinet_not_configured' : 'login_mismatch' },
      { status: !sessionSecret ? 503 : 401 },
    );
  }

  let effectiveRole = requestedRole;
  let passwordAllowed = false;
  let accountType: 'owner_test' | 'role_test';

  if (ownerLogin) {
    if (ownerPasswords.length === 0) {
      return NextResponse.json({ ok: false, reason: 'cabinet_not_configured' }, { status: 503 });
    }
    passwordAllowed = ownerPasswords.some((configured) => passwordMatches(password, configured));
    accountType = 'owner_test';
  } else {
    if (!rolePassword) {
      return NextResponse.json({ ok: false, reason: 'cabinet_not_configured' }, { status: 503 });
    }
    effectiveRole = fixedRole as string;
    if (requestedRole !== effectiveRole) {
      return NextResponse.json(
        { ok: false, reason: 'role_mismatch', expectedRole: effectiveRole },
        { status: 400 },
      );
    }
    passwordAllowed = passwordMatches(password, rolePassword);
    accountType = 'role_test';
  }

  if (!passwordAllowed) {
    return NextResponse.json({ ok: false, reason: 'password_mismatch' }, { status: 401 });
  }

  const token = await signCabinetSession(effectiveRole, sessionSecret, {
    nowSeconds: Math.floor(Date.now() / 1000),
    ttlSeconds: TTL_SECONDS,
  });

  if (!token) {
    return NextResponse.json({ ok: false, reason: 'cabinet_session_unavailable' }, { status: 503 });
  }

  const cookieStore = cookies();
  cookieStore.set(CABINET_SESSION_COOKIE, token, secureCookie(true));

  if (accountType === 'owner_test' && testAccessEnabled) {
    const csrfToken = randomUUID();
    cookieStore.set(ACCESS_COOKIE, token, secureCookie(true));
    cookieStore.set(SESSION_COOKIE, 'true', secureCookie(false));
    cookieStore.set(CSRF_COOKIE, csrfToken, secureCookie(false));
  } else {
    for (const name of [ACCESS_COOKIE, SESSION_COOKIE, CSRF_COOKIE]) {
      cookieStore.set(name, '', {
        path: '/',
        maxAge: 0,
        expires: new Date(0),
        httpOnly: name === ACCESS_COOKIE,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      });
    }
  }

  return NextResponse.json(
    { ok: true, role: effectiveRole, accountType, staffAccess: accountType === 'owner_test' && testAccessEnabled, marker: 'cabinet-gate-controlled-test-v1' },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
