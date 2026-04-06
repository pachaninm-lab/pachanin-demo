import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ACCESS_COOKIE, REFRESH_COOKIE, SESSION_COOKIE, CSRF_COOKIE, cookieSecurity, sessionMarkerCookie, csrfCookieSecurity } from '../../../../lib/auth-cookies';
import { generateCsrfToken } from '../../../../lib/server-request-security';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

// Demo role detection by email prefix — works when backend is unavailable
function detectDemoRole(email: string): string {
  const local = email.toLowerCase().split('@')[0] ?? '';
  if (local.startsWith('admin')) return 'ADMIN';
  if (local.startsWith('operator') || local.startsWith('ops') || local.startsWith('support')) return 'SUPPORT_MANAGER';
  if (local.startsWith('executive') || local.startsWith('ceo') || local.startsWith('director')) return 'EXECUTIVE';
  if (local.startsWith('accounting') || local.startsWith('finance') || local.startsWith('buh')) return 'ACCOUNTING';
  if (local.startsWith('lab') || local.startsWith('quality')) return 'LAB';
  if (local.startsWith('elevator') || local.startsWith('receiving') || local.startsWith('elev')) return 'ELEVATOR';
  if (local.startsWith('driver') || local.startsWith('водитель')) return 'DRIVER';
  if (local.startsWith('logistic') || local.startsWith('logistics') || local.startsWith('dispatch')) return 'LOGISTICIAN';
  if (local.startsWith('buyer') || local.startsWith('покупатель')) return 'BUYER';
  return 'FARMER';
}

function setDemoSession(jar: ReturnType<typeof cookies>, role: string, email: string) {
  const exp = Math.floor(Date.now() / 1000) + 8 * 3600; // 8h
  const sessionValue = encodeURIComponent(JSON.stringify({ role, exp, email }));
  // Fake tokens for demo — not cryptographically meaningful
  jar.set(ACCESS_COOKIE, `demo.${Buffer.from(JSON.stringify({ role, exp })).toString('base64')}`, cookieSecurity());
  jar.set(REFRESH_COOKIE, `demo-refresh.${role}`, cookieSecurity());
  jar.set(SESSION_COOKIE, sessionValue, sessionMarkerCookie());
  jar.set(CSRF_COOKIE, generateCsrfToken(), csrfCookieSecurity());
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { email = '', password = '' } = body;

  // Try real backend first (if configured)
  if (API_URL) {
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        cache: 'no-store',
        signal: AbortSignal.timeout(4000),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) return NextResponse.json(payload, { status: response.status });
      const jar = cookies();
      const role = payload.user?.role || payload.role || 'FARMER';
      jar.set(ACCESS_COOKIE, payload.accessToken || '', cookieSecurity());
      jar.set(REFRESH_COOKIE, payload.refreshToken || '', cookieSecurity());
      const exp = Math.floor(Date.now() / 1000) + 8 * 3600;
      jar.set(SESSION_COOKIE, encodeURIComponent(JSON.stringify({ role, exp, email: payload.user?.email || email })), sessionMarkerCookie());
      jar.set(CSRF_COOKIE, generateCsrfToken(), csrfCookieSecurity());
      return NextResponse.json({ ok: true, user: payload.user || null });
    } catch {
      // Fall through to demo mode
    }
  }

  // Demo mode: email required, password not required
  if (!email) {
    return NextResponse.json({ ok: false, message: 'Введите email.' }, { status: 401 });
  }
  const role = detectDemoRole(email);
  const jar = cookies();
  setDemoSession(jar, role, email);
  return NextResponse.json({
    ok: true,
    demo: true,
    user: { email, role, orgName: 'Demo Org', fullName: email.split('@')[0] },
  });
}
