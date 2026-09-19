export const ACCESS_COOKIE = 'pc_access_token';
export const REFRESH_COOKIE = 'pc_refresh_token';
export const SESSION_COOKIE = 'pc_session_present';
export const CSRF_COOKIE = 'pc_csrf_token';

export function cookieSecurity() {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax' as const,
    path: '/'
  };
}

export function sessionMarkerCookie() {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: false,
    secure: isProd,
    sameSite: 'lax' as const,
    path: '/'
  };
}

export function csrfCookieSecurity() {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: false,
    secure: isProd,
    sameSite: 'lax' as const,
    path: '/'
  };
}
