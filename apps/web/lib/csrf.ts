'use client';

import { CSRF_COOKIE } from './auth-cookies';

function readCookie(name: string) {
  if (typeof document === 'undefined') return '';
  const prefix = `${name}=`;
  const part = document.cookie.split(';').map((item) => item.trim()).find((item) => item.startsWith(prefix));
  return part ? decodeURIComponent(part.slice(prefix.length)) : '';
}

export function getCsrfToken() {
  return readCookie(CSRF_COOKIE);
}

export function applyCsrfHeader(headers?: HeadersInit) {
  const merged = new Headers(headers || {});
  const token = getCsrfToken();
  if (token) merged.set('x-csrf-token', token);
  return merged;
}
