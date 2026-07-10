import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ACCESS_COOKIE, REFRESH_COOKIE, SESSION_COOKIE, CSRF_COOKIE, cookieSecurity, sessionMarkerCookie, csrfCookieSecurity } from '../../../../lib/auth-cookies';
import { generateCsrfToken } from '../../../../lib/server-request-security';
import { demoLoginAllowed } from '../../../../lib/platform-v7/demo-login-policy';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

function detectDemoRole(email: string): string {
  const local = email.toLowerCase().split('@')[0] ?? '';
  if (local.startsWith('admin')) return 'ADMIN';
  if (local.startsWith('operator') || local.startsWith('ops') || local.startsWith('support')) return 'SUPPORT_MANAGER';
  if (local.startsWith('executive') || local.startsWith('ceo') || local.startsWith('director')) return 'EXECUTIVE';
  if (local.startsWith('accounting') || local.startsWith('finance') || local.startsWith('buh') || local.startsWith('bank')) return 'ACCOUNTING';
  if (local.startsWith('compliance')) return 'COMPLIANCE_OFFICER';
  if (local.startsWith('arbitrator')) return 'ARBITRATOR';
  if (local.startsWith('lab') || local.startsWith('quality')) return 'LAB';
  if (local.startsWith('elevator') || local.startsWith('receiving') || local.startsWith('elev')) return 'ELEVATOR';
  if (local.startsWith('driver') || local.startsWith('водитель')) return 'DRIVER';
  if (local.startsWith('logistic') || local.startsWith('logistics') || local.startsWith('dispatch')) return 'LOGISTICIAN';
  if (local.startsWith('buyer') || local.startsWith('покупатель')) return 'BUYER';
  return 'FARMER';
}

function setDemoSession(jar: ReturnType<typeof cookies>, role: string, email: string) {
  const exp = Math.floor(Date.now() / 1000) + 8 * 3600;
  const sessionValue = encodeURIComponent(JSON.stringify({ role, exp, email }));
  jar.set(ACCESS_COOKIE, `demo.${Buffer.from(JSON.stringify({ role, exp })).toString('base64')}`, cookieSecurity());
  jar.set(REFRESH_COOKIE, `demo-refresh.${role}`, cookieSecurity());
  jar.set(SESSION_COOKIE, sessionValue, sessionMarkerCookie());
  jar.set(CSRF_COOKIE, generateCsrfToken(), csrfCookieSecurity());
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { email = '', password = '', redirectTo = '' } = body;

  if (!email || !password) {
    return NextResponse.json({ ok: false, message: 'Введите email и пароль.' }, { status: 400 });
  }

  // The real identity service always has priority, including explicitly seeded
  // test accounts. An email suffix must never force a fake browser session.
  if (API_URL) {
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        cache: 'no-store',
        signal: AbortSignal.timeout(4000),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) return NextResponse.json(payload, { status: response.status });

      const jar = cookies();
      const role = payload.user?.role || payload.role || 'FARMER';
      if (!payload.accessToken || !payload.refreshToken) {
        return NextResponse.json({ ok: false, message: 'Сервис аутентификации вернул неполную сессию.' }, { status: 502 });
      }
      jar.set(ACCESS_COOKIE, payload.accessToken, cookieSecurity());
      jar.set(REFRESH_COOKIE, payload.refreshToken, cookieSecurity());
      const exp = Math.floor(Date.now() / 1000) + 8 * 3600;
      jar.set(SESSION_COOKIE, encodeURIComponent(JSON.stringify({ role, exp, email: payload.user?.email || email })), sessionMarkerCookie());
      jar.set(CSRF_COOKIE, generateCsrfToken(), csrfCookieSecurity());
      return NextResponse.json({ ok: true, user: payload.user || null });
    } catch {
      // Network/timeout only. Demo fallback below remains explicitly gated.
    }
  }

  if (!demoLoginAllowed()) {
    return NextResponse.json(
      { ok: false, message: 'Сервис аутентификации недоступен. Демо-вход отключён.' },
      { status: 503 },
    );
  }

  const role = detectDemoRole(email);
  const jar = cookies();
  setDemoSession(jar, role, email);

  if (redirectTo && redirectTo.startsWith('/')) {
    const res = NextResponse.redirect(new URL(redirectTo, request.url));
    const exp = Math.floor(Date.now() / 1000) + 8 * 3600;
    const sessionValue = encodeURIComponent(JSON.stringify({ role, exp, email }));
    res.cookies.set(SESSION_COOKIE, sessionValue, sessionMarkerCookie());
    res.cookies.set(ACCESS_COOKIE, `demo.${Buffer.from(JSON.stringify({ role, exp })).toString('base64')}`, cookieSecurity());
    res.cookies.set(REFRESH_COOKIE, `demo-refresh.${role}`, cookieSecurity());
    return res;
  }

  return NextResponse.json({
    ok: true,
    demo: true,
    user: { email, role, orgName: 'Demo Org', fullName: email.split('@')[0] },
  });
}
