import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { readVerifiedCabinetRole, signCabinetSession } from '@/lib/platform-v7/verified-session';

/**
 * Phase 4D-pre — dedicated platform-v7 cabinet session issuance.
 *
 * Controlled-pilot boundary:
 * - A verified backend access token is the preferred source of the cabinet role.
 * - Direct body.role issuance is allowed only under an explicit controlled-pilot/demo
 *   flag or a local dev/test boundary. It is not an unconditional trusted source.
 * - Production-like mode must not mint a bank/arbitrator/compliance/etc cabinet just
 *   because the browser posted `{ role }`.
 */

export const CABINET_SESSION_COOKIE = 'pc_v7_cabinet';
const ACCESS_TOKEN_COOKIE = 'pc_access_token';
const TTL_SECONDS = 8 * 3600;

export const BODY_ROLE_SESSION_FLAG = 'PLATFORM_V7_ALLOW_BODY_ROLE_CABINET_SESSION';
export const CONTROLLED_PILOT_BODY_ROLE_SESSION_FLAG = 'PLATFORM_V7_CONTROLLED_PILOT_BODY_ROLE_SESSION';
export const PRODUCTION_LIKE_SESSION_FLAG = 'PLATFORM_V7_PRODUCTION_LIKE';
export const CABINET_SESSION_MODE = 'PLATFORM_V7_CABINET_SESSION_MODE';

const ALLOWED_ROLES = new Set([
  'operator', 'buyer', 'seller', 'logistics', 'driver', 'surveyor',
  'elevator', 'lab', 'bank', 'arbitrator', 'compliance', 'executive',
]);

function envValue(env: NodeJS.ProcessEnv, name: string): string {
  return String(env[name] || '').trim().toLowerCase();
}

function truthyEnv(env: NodeJS.ProcessEnv, name: string): boolean {
  return ['1', 'true', 'yes', 'on'].includes(envValue(env, name));
}

export function isProductionLikeCabinetSessionMode(env: NodeJS.ProcessEnv = process.env): boolean {
  return (
    envValue(env, 'NODE_ENV') === 'production'
    || truthyEnv(env, PRODUCTION_LIKE_SESSION_FLAG)
    || envValue(env, CABINET_SESSION_MODE) === 'production-like'
  );
}

export function isDirectBodyRoleCabinetSessionAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
  if (truthyEnv(env, BODY_ROLE_SESSION_FLAG)) return true;
  if (truthyEnv(env, CONTROLLED_PILOT_BODY_ROLE_SESSION_FLAG)) return true;
  if (isProductionLikeCabinetSessionMode(env)) return false;
  return envValue(env, 'NODE_ENV') === 'development' || envValue(env, 'NODE_ENV') === 'test';
}

function readBearerToken(request: Request): string | null {
  const header = request.headers.get('authorization') || '';
  return header.toLowerCase().startsWith('bearer ') ? header.slice('bearer '.length).trim() : null;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const bodyRole = typeof body?.role === 'string' ? body.role : '';
  const nowSeconds = Math.floor(Date.now() / 1000);
  const secret = process.env.JWT_SECRET ?? '';
  const cookieStore = cookies();
  const directBodyRoleAllowed = isDirectBodyRoleCabinetSessionAllowed();

  const verifiedRole = await readVerifiedCabinetRole(
    readBearerToken(request) ?? cookieStore.get(ACCESS_TOKEN_COOKIE)?.value ?? null,
    secret,
    nowSeconds,
  );

  const role = verifiedRole ?? (directBodyRoleAllowed ? bodyRole : '');

  if (!ALLOWED_ROLES.has(role)) {
    const reason = bodyRole && !directBodyRoleAllowed && !verifiedRole
      ? 'verified backend role required'
      : 'unknown role';
    return NextResponse.json({ ok: false, reason }, { status: bodyRole ? 403 : 400 });
  }

  const token = await signCabinetSession(role, secret, { nowSeconds, ttlSeconds: TTL_SECONDS });
  if (!token) {
    // No secret / signing unavailable — stay safe: no cookie, no false session.
    return NextResponse.json({ ok: true, issued: false });
  }

  cookieStore.set(CABINET_SESSION_COOKIE, token, {
    path: '/',
    maxAge: TTL_SECONDS,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
  return NextResponse.json({ ok: true, issued: true, source: verifiedRole ? 'verified-backend-role' : 'controlled-pilot-body-role' });
}
