import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ACCESS_COOKIE, REFRESH_COOKIE, SESSION_COOKIE, CSRF_COOKIE, cookieSecurity, sessionMarkerCookie, csrfCookieSecurity } from '../../../../../lib/auth-cookies';
import { generateCsrfToken } from '../../../../../lib/server-request-security';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export async function GET(request: Request) {
  const url = new URL(request.url);
  try {
    const response = await fetch(`${API_URL}/auth/sber-business/callback?${url.searchParams.toString()}`, { cache: 'no-store' });
    const payload = await response.json().catch(() => ({}));
    const jar = cookies();
    if (payload?.accessToken) jar.set(ACCESS_COOKIE, payload.accessToken, cookieSecurity());
    if (payload?.refreshToken) jar.set(REFRESH_COOKIE, payload.refreshToken, cookieSecurity());
    if (payload?.accessToken || payload?.refreshToken) {
      jar.set(SESSION_COOKIE, '1', sessionMarkerCookie());
      jar.set(CSRF_COOKIE, generateCsrfToken(), csrfCookieSecurity());
    }
    return NextResponse.redirect(new URL('/cabinet', request.url));
  } catch {
    return NextResponse.redirect(new URL('/login', request.url));
  }
}
