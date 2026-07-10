import { NextResponse } from 'next/server';
import { MFA_PENDING_COOKIE, clearMfaPendingCookieOptions } from '../../../../../lib/server/mfa-login-ticket';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  const response = NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' } });
  response.cookies.set(MFA_PENDING_COOKIE, '', clearMfaPendingCookieOptions());
  return response;
}
