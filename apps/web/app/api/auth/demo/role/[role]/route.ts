import { NextRequest, NextResponse } from 'next/server';
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  SESSION_COOKIE,
  CSRF_COOKIE,
  cookieSecurity,
  sessionMarkerCookie,
  csrfCookieSecurity,
} from '../../../../../../lib/auth-cookies';
import { generateCsrfToken } from '../../../../../../lib/server-request-security';

type DemoTarget = {
  role: string;
  email: string;
  firstPage: string;
};

const ROLE_TARGETS: Record<string, DemoTarget> = {
  farmer: { role: 'FARMER', email: 'farmer@demo.ru', firstPage: '/lots' },
  seller: { role: 'FARMER', email: 'farmer@demo.ru', firstPage: '/lots' },
  buyer: { role: 'BUYER', email: 'buyer@demo.ru', firstPage: '/deals' },
  logistician: { role: 'LOGISTICIAN', email: 'logistics@demo.ru', firstPage: '/dispatch' },
  logistics: { role: 'LOGISTICIAN', email: 'logistics@demo.ru', firstPage: '/dispatch' },
  dispatcher: { role: 'LOGISTICIAN', email: 'logistics@demo.ru', firstPage: '/dispatch' },
  driver: { role: 'DRIVER', email: 'driver@demo.ru', firstPage: '/driver-mobile' },
  lab: { role: 'LAB', email: 'lab@demo.ru', firstPage: '/lab' },
  laboratory: { role: 'LAB', email: 'lab@demo.ru', firstPage: '/lab' },
  elevator: { role: 'ELEVATOR', email: 'elevator@demo.ru', firstPage: '/receiving' },
  accounting: { role: 'ACCOUNTING', email: 'accounting@demo.ru', firstPage: '/payments' },
  finance: { role: 'ACCOUNTING', email: 'accounting@demo.ru', firstPage: '/payments' },
  executive: { role: 'EXECUTIVE', email: 'executive@demo.ru', firstPage: '/analytics' },
  ceo: { role: 'EXECUTIVE', email: 'executive@demo.ru', firstPage: '/analytics' },
  operator: { role: 'SUPPORT_MANAGER', email: 'operator@demo.ru', firstPage: '/operator-cockpit' },
  support: { role: 'SUPPORT_MANAGER', email: 'operator@demo.ru', firstPage: '/operator-cockpit' },
  admin: { role: 'ADMIN', email: 'admin@demo.ru', firstPage: '/cabinet' },
};

function sanitizeDestination(raw: string | null | undefined, fallback: string): string {
  if (!raw) return fallback;
  return raw.startsWith('/') ? raw : fallback;
}

export async function GET(
  request: NextRequest,
  context: { params: { role: string } },
) {
  const slug = (context.params.role || 'farmer').toLowerCase();
  const target = ROLE_TARGETS[slug] ?? ROLE_TARGETS.farmer;
  const to = sanitizeDestination(request.nextUrl.searchParams.get('to'), target.firstPage);

  const exp = Math.floor(Date.now() / 1000) + 8 * 3600;
  const sessionValue = encodeURIComponent(
    JSON.stringify({ role: target.role, exp, email: target.email }),
  );

  const url = new URL(to, request.url);
  const res = NextResponse.redirect(url);

  res.cookies.set(SESSION_COOKIE, sessionValue, sessionMarkerCookie());
  res.cookies.set(
    ACCESS_COOKIE,
    `demo.${Buffer.from(JSON.stringify({ role: target.role, exp })).toString('base64')}`,
    cookieSecurity(),
  );
  res.cookies.set(REFRESH_COOKIE, `demo-refresh.${target.role}`, cookieSecurity());
  res.cookies.set(CSRF_COOKIE, generateCsrfToken(), csrfCookieSecurity());
  res.headers.set('Cache-Control', 'no-store');

  return res;
}
