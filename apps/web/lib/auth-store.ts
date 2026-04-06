'use client';

export type SessionSnapshot = {
  accessToken: string | null;
  refreshToken: string | null;
};

const SESSION_COOKIE = 'pc_session_present';
const CSRF_COOKIE = 'pc_csrf_token';

function hasCookie(name: string, value?: string) {
  if (typeof document === 'undefined') return false;
  return document.cookie.split(';').some((part) => {
    const trimmed = part.trim();
    return value == null ? trimmed.startsWith(`${name}=`) : trimmed === `${name}=${value}`;
  });
}

function hasSessionMarker() {
  return hasCookie(SESSION_COOKIE, '1');
}

export function getSession(): SessionSnapshot {
  return {
    accessToken: hasSessionMarker() ? 'cookie-session' : null,
    refreshToken: null
  };
}

export function setSession() {
  return;
}

export function clearSession() {
  if (typeof document === 'undefined') return;
  document.cookie = `${SESSION_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
  if (hasCookie(CSRF_COOKIE)) {
    document.cookie = `${CSRF_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
  }
}
