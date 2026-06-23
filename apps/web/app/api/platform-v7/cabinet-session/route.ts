import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { signCabinetSession } from '@/lib/platform-v7/verified-session';

/**
 * Phase 4D-pre — dedicated platform-v7 cabinet session issuance (report-only).
 *
 * Mints a cryptographically signed (HS256) `pc_v7_cabinet` cookie carrying the cabinet
 * role, so the report-only server cabinet RBAC observation can resolve a *verified*
 * role instead of `unknown`. This is intentionally separate from `pc_access_token`
 * (which is Bearer-forwarded to the API and uses a `demo.` routing prefix).
 *
 * Hard rules:
 *  - The role is validated server-side against a fixed allowlist; an unknown role is
 *    rejected (no cookie). The resolver later trusts ONLY the signature — never the URL,
 *    query, `pc-role` cookie, or client guards.
 *  - This issues a session; it does NOT block, redirect, or enforce anything. Report-only.
 *  - httpOnly so the signed token cannot be read or forged by client JS.
 */

const CABINET_SESSION_COOKIE = 'pc_v7_cabinet';
const TTL_SECONDS = 8 * 3600;

const ALLOWED_ROLES = new Set([
  'operator', 'buyer', 'seller', 'logistics', 'driver', 'surveyor',
  'elevator', 'lab', 'bank', 'arbitrator', 'compliance', 'executive',
]);

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const role = typeof body?.role === 'string' ? body.role : '';
  if (!ALLOWED_ROLES.has(role)) {
    return NextResponse.json({ ok: false, reason: 'unknown role' }, { status: 400 });
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const token = await signCabinetSession(role, process.env.JWT_SECRET ?? '', { nowSeconds, ttlSeconds: TTL_SECONDS });
  if (!token) {
    // No secret / signing unavailable — stay report-only-safe: no cookie, no error surface.
    return NextResponse.json({ ok: true, issued: false });
  }

  cookies().set(CABINET_SESSION_COOKIE, token, {
    path: '/',
    maxAge: TTL_SECONDS,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
  return NextResponse.json({ ok: true, issued: true });
}
