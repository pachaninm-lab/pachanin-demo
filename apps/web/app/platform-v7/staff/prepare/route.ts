import { NextRequest, NextResponse } from 'next/server';
import { ACCESS_COOKIE, CSRF_COOKIE, csrfCookieSecurity } from '@/lib/auth-cookies';
import { generateCsrfToken } from '@/lib/server-request-security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value || '';
  const target = new URL('/platform-v7/staff', request.url);

  if (!accessToken) {
    target.pathname = '/platform-v7/login';
    target.searchParams.set('next', '/platform-v7/staff');
    return NextResponse.redirect(target, 303);
  }

  const response = NextResponse.redirect(target, 303);
  response.cookies.set(CSRF_COOKIE, generateCsrfToken(), {
    ...csrfCookieSecurity(),
    maxAge: 8 * 60 * 60,
    priority: 'high',
  });
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  response.headers.set('Pragma', 'no-cache');
  return response;
}
