import { randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  MFA_PENDING_COOKIE,
  mfaPendingCookieOptions,
  openMfaLoginTicket,
} from '../../../../../lib/server/mfa-login-ticket';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 8;

const API_URL = String(process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');

function clearPending(response: NextResponse) {
  response.cookies.set(MFA_PENDING_COOKIE, '', {
    ...mfaPendingCookieOptions(),
    expires: new Date(0),
    maxAge: 0,
  });
}

export async function POST(request: Request) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();
  const jar = cookies();
  const ticket = openMfaLoginTicket(jar.get(MFA_PENDING_COOKIE)?.value || '');

  if (ticket && API_URL) {
    try {
      await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${ticket.accessToken}`,
          'Content-Type': 'application/json',
          'x-correlation-id': correlationId,
        },
        body: JSON.stringify({ refreshToken: ticket.refreshToken }),
        cache: 'no-store',
        signal: AbortSignal.timeout(3_000),
      });
    } catch (error) {
      console.error('mfa_login_cancel_revoke_failed', JSON.stringify({
        correlationId,
        reason: error instanceof Error ? error.name : 'unknown',
      }));
    }
  }

  const response = NextResponse.json(
    { ok: true, correlationId },
    { status: 200, headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' } },
  );
  clearPending(response);
  return response;
}
