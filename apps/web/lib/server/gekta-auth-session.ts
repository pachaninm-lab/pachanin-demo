import { NextResponse } from 'next/server';
import {
  ACCESS_COOKIE,
  CSRF_COOKIE,
  REFRESH_COOKIE,
  SESSION_COOKIE,
  cookieSecurity,
  csrfCookieSecurity,
} from '@/lib/auth-cookies';
import { generateCsrfToken } from '@/lib/server-request-security';
import { CABINET_SESSION_COOKIE } from '@/lib/server/auth-session-response';

export type GektaAuthenticatedSessionPayload = {
  accessToken: string;
  refreshToken: string;
  expiresIn?: number;
  backupCodes?: string[];
  user: {
    id: string;
    email: string;
    fullName: string;
  };
};

export function isGektaSessionPayload(value: unknown): value is GektaAuthenticatedSessionPayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const payload = value as Record<string, unknown>;
  const user = payload.user;
  return typeof payload.accessToken === 'string'
    && payload.accessToken.length > 20
    && typeof payload.refreshToken === 'string'
    && payload.refreshToken.length > 20
    && Boolean(user)
    && typeof user === 'object'
    && !Array.isArray(user)
    && typeof (user as Record<string, unknown>).id === 'string'
    && typeof (user as Record<string, unknown>).email === 'string'
    && typeof (user as Record<string, unknown>).fullName === 'string';
}

/**
 * Product credentials deliberately do not create the generic platform session
 * marker or the signed cabinet cookie. The Gekta BFF is public at middleware
 * level and authenticates each request with the httpOnly access token; private
 * platform pages still require their independently signed cabinet context.
 */
export function applyGektaSession(
  response: NextResponse,
  payload: GektaAuthenticatedSessionPayload,
) {
  const accessMaxAge = Math.max(60, Math.min(Number(payload.expiresIn || 900), 24 * 60 * 60));
  response.cookies.set(ACCESS_COOKIE, payload.accessToken, {
    ...cookieSecurity(),
    maxAge: accessMaxAge,
  });
  response.cookies.set(REFRESH_COOKIE, payload.refreshToken, {
    ...cookieSecurity(),
    maxAge: 30 * 24 * 60 * 60,
  });
  response.cookies.set(CSRF_COOKIE, generateCsrfToken(), {
    ...csrfCookieSecurity(),
    maxAge: 8 * 60 * 60,
  });
  // Entering Gekta ends any stale platform presentation context. A product
  // token must never inherit a cabinet marker from an earlier login.
  for (const name of [SESSION_COOKIE, CABINET_SESSION_COOKIE]) {
    response.cookies.set(name, '', { path: '/', expires: new Date(0), maxAge: 0 });
  }
}

export function clearGektaSession(response: NextResponse) {
  for (const name of [ACCESS_COOKIE, REFRESH_COOKIE, SESSION_COOKIE, CSRF_COOKIE, CABINET_SESSION_COOKIE]) {
    response.cookies.set(name, '', { path: '/', expires: new Date(0), maxAge: 0 });
  }
}
