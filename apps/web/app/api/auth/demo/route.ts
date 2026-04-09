import { NextRequest, NextResponse } from 'next/server';
import { ACCESS_COOKIE, REFRESH_COOKIE, SESSION_COOKIE, CSRF_COOKIE, cookieSecurity, sessionMarkerCookie, csrfCookieSecurity } from '../../../../lib/auth-cookies';
import { generateCsrfToken } from '../../../../lib/server-request-security';

function detectDemoRole(email: string): string {
  const local = email.toLowerCase().split('@')[0] ?? '';
  if (local.startsWith('admin')) return 'ADMIN';
  if (local.startsWith('operator') || local.startsWith('ops') || local.startsWith('support')) return 'SUPPORT_MANAGER';
  if (local.startsWith('executive') || local.startsWith('ceo') || local.startsWith('director')) return 'EXECUTIVE';
  if (local.startsWith('accounting') || local.startsWith('finance')) return 'ACCOUNTING';
  if (local.startsWith('lab') || local.startsWith('quality')) return 'LAB';
  if (local.startsWith('elevator') || local.startsWith('receiving')) return 'ELEVATOR';
  if (local.startsWith('driver')) return 'DRIVER';
  if (local.startsWith('logistic') || local.startsWith('dispatch')) return 'LOGISTICIAN';
  if (local.startsWith('buyer')) return 'BUYER';
  return 'FARMER';
}

// GET /api/auth/demo?email=farmer@demo.ru&to=/lots
// Real browser GET request → sets cookies → redirects → iOS Safari compatible
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const email = searchParams.get('email') || 'farmer@demo.ru';
  const to = searchParams.get('to') || '/';

  const destination = to.startsWith('/') ? to : '/';

  const role = detectDemoRole(email);
  const exp = Math.floor(Date.now() / 1000) + 8 * 3600;
  const sessionValue = JSON.stringify({ role, exp, email });

  const url = new URL(destination, request.url);
  const res = NextResponse.redirect(url);

  res.cookies.set(SESSION_COOKIE, sessionValue, sessionMarkerCookie());
  res.cookies.set(ACCESS_COOKIE, `demo.${Buffer.from(JSON.stringify({ role, exp })).toString('base64')}`, cookieSecurity());
  res.cookies.set(REFRESH_COOKIE, `demo-refresh.${role}`, cookieSecurity());
  res.cookies.set(CSRF_COOKIE, generateCsrfToken(), csrfCookieSecurity());
  res.headers.set('Cache-Control', 'no-store');

  return res;
}
