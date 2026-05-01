import { NextResponse } from 'next/server';
import { CSRF_COOKIE, csrfCookieSecurity } from '@/lib/auth-cookies';
import { generateCsrfToken } from '@/lib/server-request-security';
import { getBidRuntimeView, resetBidRuntimeScope } from '@/lib/platform-v7/bid-runtime-store';
import type { PlatformRole } from '@/lib/platform-v7/execution-contour';

function roleOf(value: string | null): PlatformRole {
  const allowed: PlatformRole[] = ['seller', 'buyer', 'operator', 'bank', 'logistics', 'driver', 'elevator', 'lab', 'surveyor', 'arbitrator', 'investor'];
  return allowed.includes(value as PlatformRole) ? value as PlatformRole : 'seller';
}

function readCookie(request: Request, name: string): string {
  const raw = request.headers.get('cookie') || '';
  const prefix = `${name}=`;
  const part = raw.split(';').map((item) => item.trim()).find((item) => item.startsWith(prefix));
  return part ? decodeURIComponent(part.slice(prefix.length)) : '';
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const scopeId = url.searchParams.get('scopeId') || 'default';
  const lotId = url.searchParams.get('lotId') || 'LOT-2403';
  const role = roleOf(url.searchParams.get('role'));
  const viewerCounterpartyId = url.searchParams.get('viewerCounterpartyId') || undefined;
  const reset = url.searchParams.get('reset') === '1';

  const view = reset
    ? resetBidRuntimeScope(scopeId)
    : getBidRuntimeView({ scopeId, lotId, role, viewerCounterpartyId });

  const response = NextResponse.json(view, { status: 200 });
  const existingToken = readCookie(request, CSRF_COOKIE);
  response.cookies.set(CSRF_COOKIE, existingToken || generateCsrfToken(), csrfCookieSecurity());
  return response;
}
