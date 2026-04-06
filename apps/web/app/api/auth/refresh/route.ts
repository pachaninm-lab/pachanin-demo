import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ACCESS_COOKIE, REFRESH_COOKIE, SESSION_COOKIE, cookieSecurity, sessionMarkerCookie } from '../../../../lib/auth-cookies';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export async function POST() {
  const jar = cookies();
  const refreshToken = jar.get(REFRESH_COOKIE)?.value || '';

  if (API_URL && refreshToken && !refreshToken.startsWith('demo-refresh.')) {
    try {
      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
        cache: 'no-store',
        signal: AbortSignal.timeout(4000),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) return NextResponse.json(payload, { status: response.status });
      jar.set(ACCESS_COOKIE, payload.accessToken || '', cookieSecurity());
      if (payload.refreshToken) jar.set(REFRESH_COOKIE, payload.refreshToken, cookieSecurity());
      return NextResponse.json({ ok: true });
    } catch {
      // Fall through to demo refresh
    }
  }

  // Demo refresh: extend session by 8h
  const role = refreshToken.replace('demo-refresh.', '') || 'FARMER';
  const exp = Math.floor(Date.now() / 1000) + 8 * 3600;
  const currentSession = jar.get(SESSION_COOKIE)?.value;
  let email = 'demo@demo.ru';
  try {
    const parsed = JSON.parse(decodeURIComponent(currentSession || '{}'));
    if (parsed.email) email = parsed.email;
  } catch { /* ignore */ }

  jar.set(ACCESS_COOKIE, `demo.${Buffer.from(JSON.stringify({ role, exp })).toString('base64')}`, cookieSecurity());
  jar.set(SESSION_COOKIE, encodeURIComponent(JSON.stringify({ role, exp, email })), sessionMarkerCookie());
  return NextResponse.json({ ok: true, demo: true });
}
