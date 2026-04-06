import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ACCESS_COOKIE, REFRESH_COOKIE, SESSION_COOKIE, CSRF_COOKIE, cookieSecurity, sessionMarkerCookie, csrfCookieSecurity } from '../../../../lib/auth-cookies';
import { generateCsrfToken } from '../../../../lib/server-request-security';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

function detectDemoRole(email: string): string {
  const local = email.toLowerCase().split('@')[0] ?? '';
  if (local.startsWith('admin')) return 'ADMIN';
  if (local.startsWith('operator') || local.startsWith('ops') || local.startsWith('support')) return 'SUPPORT_MANAGER';
  if (local.startsWith('executive') || local.startsWith('ceo')) return 'EXECUTIVE';
  if (local.startsWith('accounting') || local.startsWith('finance') || local.startsWith('buh')) return 'ACCOUNTING';
  if (local.startsWith('lab') || local.startsWith('quality')) return 'LAB';
  if (local.startsWith('elevator') || local.startsWith('receiving')) return 'ELEVATOR';
  if (local.startsWith('driver')) return 'DRIVER';
  if (local.startsWith('logistic') || local.startsWith('dispatch')) return 'LOGISTICIAN';
  if (local.startsWith('buyer')) return 'BUYER';
  return 'FARMER';
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { email = '', inn = '', password = '' } = body;

  if (API_URL) {
    try {
      const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        cache: 'no-store',
        signal: AbortSignal.timeout(4000),
      });
      const payload = await response.json().catch(() => ({}));
      return NextResponse.json(payload, { status: response.ok ? 200 : response.status });
    } catch {
      // Fall through to demo mode
    }
  }

  // Demo mode validation
  if (!email || !inn || !password || password.length < 8) {
    return NextResponse.json({ ok: false, message: 'Заполните все поля. Пароль — минимум 8 символов.' }, { status: 400 });
  }
  if (!/^\d{10}$|^\d{12}$/.test(inn.replace(/\s/g, ''))) {
    return NextResponse.json({ ok: false, message: 'ИНН должен содержать 10 или 12 цифр.' }, { status: 400 });
  }

  const role = detectDemoRole(email);
  const exp = Math.floor(Date.now() / 1000) + 8 * 3600;
  const jar = cookies();
  jar.set(ACCESS_COOKIE, `demo.${Buffer.from(JSON.stringify({ role, exp })).toString('base64')}`, cookieSecurity());
  jar.set(REFRESH_COOKIE, `demo-refresh.${role}`, cookieSecurity());
  jar.set(SESSION_COOKIE, encodeURIComponent(JSON.stringify({ role, exp, email })), sessionMarkerCookie());
  jar.set(CSRF_COOKIE, generateCsrfToken(), csrfCookieSecurity());
  return NextResponse.json({
    ok: true,
    demo: true,
    user: { email, role, inn, orgName: body.companyName || 'Новая компания' },
  });
}
