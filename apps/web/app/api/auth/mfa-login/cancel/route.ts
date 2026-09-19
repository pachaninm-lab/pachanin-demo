import { NextResponse } from 'next/server';
import {
  MFA_PENDING_COOKIE,
  clearMfaPendingCookieOptions,
} from '../../../../../lib/server/mfa-login-ticket';
import { assertCsrf } from '../../../../../lib/server-request-security';
import {
  MEMBERSHIP_SELECTION_COOKIE,
  clearMembershipSelectionCookieOptions,
} from '../../../../../lib/server/membership-selection-cookie';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const csrf = assertCsrf(request);
  if (!csrf.ok) {
    return NextResponse.json({ ok: false, code: 'CSRF_REJECTED' }, { status: 403, headers: { 'Cache-Control': 'no-store' } });
  }
  const response = NextResponse.json(
    { ok: true },
    { headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' } },
  );
  response.cookies.set(MFA_PENDING_COOKIE, '', clearMfaPendingCookieOptions());
  response.cookies.set(MEMBERSHIP_SELECTION_COOKIE, '', clearMembershipSelectionCookieOptions());
  return response;
}
