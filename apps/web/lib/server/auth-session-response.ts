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
import { signCabinetSession } from '../platform-v7/verified-session';

export const CABINET_SESSION_COOKIE = 'pc_v7_cabinet';

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

export async function applyAuthenticatedSession(
  response: NextResponse,
  payload: AuthenticatedSessionPayload,
): Promise<{ role: SurfaceRole; redirectTo: string } | null> {
  const role = normalizeSurfaceRole(payload.user.role, payload.user.surfaceRole);
  const expiresIn = Math.max(60, Math.min(Number(payload.expiresIn || 900), 24 * 60 * 60));
  const exp = Math.floor(Date.now() / 1000) + expiresIn;
  const secret = String(process.env.JWT_SECRET || process.env.PC_CABINET_SESSION_SECRET || '').trim();
  const cabinetToken = await signCabinetSession(role, secret, {
    nowSeconds: Math.floor(Date.now() / 1000),
    ttlSeconds: expiresIn,
  });
  if (!cabinetToken) return null;

  response.cookies.set(ACCESS_COOKIE, payload.accessToken, cookieSecurity());
  response.cookies.set(REFRESH_COOKIE, payload.refreshToken, cookieSecurity());
  response.cookies.set(
    SESSION_COOKIE,
    encodeURIComponent(JSON.stringify({ role, exp, email: payload.user.email })),
    sessionMarkerCookie(),
  );
  response.cookies.set(CSRF_COOKIE, generateCsrfToken(), csrfCookieSecurity());
  response.cookies.set(CABINET_SESSION_COOKIE, cabinetToken, {
    path: '/',
    maxAge: expiresIn,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });

  return { role, redirectTo: platformHome(role) };
}

export function clearAuthenticatedSession(response: NextResponse) {
  for (const name of [ACCESS_COOKIE, REFRESH_COOKIE, SESSION_COOKIE, CSRF_COOKIE, CABINET_SESSION_COOKIE]) {
    response.cookies.set(name, '', { path: '/', expires: new Date(0), maxAge: 0 });
  }
}
