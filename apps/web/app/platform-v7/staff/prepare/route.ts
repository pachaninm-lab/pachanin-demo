import { NextRequest, NextResponse } from 'next/server';
import { ACCESS_COOKIE, CSRF_COOKIE, csrfCookieSecurity } from '@/lib/auth-cookies';
import { generateCsrfToken } from '@/lib/server-request-security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function noStore(response: NextResponse): NextResponse {
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
}

function setCsrfCookie(response: NextResponse, token: string): NextResponse {
  response.cookies.set(CSRF_COOKIE, token, {
    ...csrfCookieSecurity(),
    maxAge: 8 * 60 * 60,
    priority: 'high',
  });
  return noStore(response);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value || '';
  const wantsJson = request.nextUrl.searchParams.get('format') === 'json'
    || String(request.headers.get('accept') || '').includes('application/json');
  const target = new URL('/platform-v7/staff', request.url);

  if (!accessToken) {
    if (wantsJson) {
      return noStore(NextResponse.json({ ok: false, code: 'OWNER_ACCESS_UNAVAILABLE' }, { status: 401 }));
    }
    target.pathname = '/platform-v7/login';
    target.searchParams.set('next', '/platform-v7/staff');
    return noStore(NextResponse.redirect(target, 303));
  }

  const token = generateCsrfToken();
  if (wantsJson) {
    return setCsrfCookie(NextResponse.json({ ok: true, csrfToken: token }), token);
  }
  return setCsrfCookie(NextResponse.redirect(target, 303), token);
}
