import { NextResponse } from 'next/server';
import {
  ACCESS_COOKIE,
  CSRF_COOKIE,
  REFRESH_COOKIE,
  SESSION_COOKIE,
  cookieSecurity,
  csrfCookieSecurity,
  sessionMarkerCookie,
} from '../auth-cookies';
import { generateCsrfToken } from '../server-request-security';

export type AuthenticatedSessionPayload = {
  accessToken: string;
  refreshToken: string;
  expiresIn?: number;
  user: {
    email: string;
    role: string;
    surfaceRole?: string;
  };
};

export type SurfaceRole =
  | 'operator'
  | 'buyer'
  | 'seller'
  | 'logistics'
  | 'driver'
  | 'elevator'
  | 'lab'
  | 'surveyor'
  | 'bank'
  | 'arbitrator'
  | 'compliance'
  | 'executive';

export function normalizeSurfaceRole(apiRole: string | undefined, explicit?: string): SurfaceRole {
  const normalized = String(explicit || apiRole || '').toUpperCase();
  if (normalized === 'BUYER') return 'buyer';
  if (normalized === 'FARMER' || normalized === 'SELLER') return 'seller';
  if (normalized === 'LOGISTICIAN' || normalized === 'LOGISTICS') return 'logistics';
  if (normalized === 'DRIVER') return 'driver';
  if (normalized === 'ELEVATOR') return 'elevator';
  if (normalized === 'LAB') return 'lab';
  if (normalized === 'SURVEYOR') return 'surveyor';
  if (normalized === 'ACCOUNTING' || normalized === 'BANK') return 'bank';
  if (normalized === 'ARBITRATOR') return 'arbitrator';
  if (normalized === 'COMPLIANCE_OFFICER' || normalized === 'COMPLIANCE') return 'compliance';
  if (normalized === 'EXECUTIVE') return 'executive';
  return 'operator';
}

export function platformHome(role: SurfaceRole) {
  const routes: Record<SurfaceRole, string> = {
    operator: '/platform-v7/control-tower',
    buyer: '/platform-v7/buyer',
    seller: '/platform-v7/seller',
    logistics: '/platform-v7/logistics',
    driver: '/platform-v7/driver',
    elevator: '/platform-v7/elevator',
    lab: '/platform-v7/lab',
    surveyor: '/platform-v7/surveyor',
    bank: '/platform-v7/bank',
    arbitrator: '/platform-v7/arbitrator',
    compliance: '/platform-v7/compliance',
    executive: '/platform-v7/executive',
  };
  return routes[role];
}

export function applyAuthenticatedSession(response: NextResponse, payload: AuthenticatedSessionPayload) {
  const role = normalizeSurfaceRole(payload.user.role, payload.user.surfaceRole);
  const expiresIn = Math.max(60, Math.min(Number(payload.expiresIn || 900), 24 * 60 * 60));
  const exp = Math.floor(Date.now() / 1000) + expiresIn;

  response.cookies.set(ACCESS_COOKIE, payload.accessToken, cookieSecurity());
  response.cookies.set(REFRESH_COOKIE, payload.refreshToken, cookieSecurity());
  response.cookies.set(
    SESSION_COOKIE,
    encodeURIComponent(JSON.stringify({ role, exp, email: payload.user.email })),
    sessionMarkerCookie(),
  );
  response.cookies.set(CSRF_COOKIE, generateCsrfToken(), csrfCookieSecurity());

  return { role, redirectTo: platformHome(role) };
}

export function clearAuthenticatedSession(response: NextResponse) {
  for (const name of [ACCESS_COOKIE, REFRESH_COOKIE, SESSION_COOKIE, CSRF_COOKIE]) {
    response.cookies.set(name, '', { path: '/', expires: new Date(0), maxAge: 0 });
  }
}
