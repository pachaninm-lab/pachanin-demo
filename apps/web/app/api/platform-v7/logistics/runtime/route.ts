import { NextResponse } from 'next/server';
import { CSRF_COOKIE, csrfCookieSecurity } from '@/lib/auth-cookies';
import { generateCsrfToken } from '@/lib/server-request-security';
import { getLogisticsRuntimeView } from '@/lib/platform-v7/logistics-runtime-store';
import type { PlatformRole } from '@/lib/platform-v7/execution-contour';

const roles: PlatformRole[] = ['seller', 'buyer', 'operator', 'bank', 'logistics', 'driver', 'elevator', 'lab', 'surveyor', 'arbitrator', 'investor'];

function roleOf(value: string | null): PlatformRole {
  return roles.includes(value as PlatformRole) ? value as PlatformRole : 'logistics';
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
  const actorRole = roleOf(url.searchParams.get('actorRole'));
  const response = NextResponse.json(getLogisticsRuntimeView({ scopeId, actorRole }), { status: 200 });
  response.cookies.set(CSRF_COOKIE, readCookie(request, CSRF_COOKIE) || generateCsrfToken(), csrfCookieSecurity());
  return response;
}
