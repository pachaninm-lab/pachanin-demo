'use client';

import { clearSession } from './auth-store';
import { applyCsrfHeader } from './csrf';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
const PROXY_PREFIX = '/api/proxy';
let refreshPromise: Promise<boolean> | null = null;

export function getApiUrl() {
  return API_URL;
}

function withCsrf(headers?: HeadersInit) {
  return applyCsrfHeader(headers);
}

async function tryRefreshAccessToken(): Promise<boolean> {
  const response = await fetch('/api/auth/refresh', {
    method: 'POST',
    headers: withCsrf(),
    cache: 'no-store'
  });

  if (!response.ok) {
    clearSession();
    return false;
  }

  return true;
}

export async function ensureAccessToken() {
  if (!refreshPromise) {
    refreshPromise = tryRefreshAccessToken().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

function proxyUrl(endpoint: string) {
  return `${PROXY_PREFIX}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
}

export async function fetchJson<T>(endpoint: string, options?: RequestInit & { publicAccess?: boolean; retryOn401?: boolean }): Promise<T> {
  const method = String(options?.method || 'GET').toUpperCase();
  const headers = withCsrf(options?.headers || {});
  if (!headers.has('Content-Type') && !(options?.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(proxyUrl(endpoint), {
    ...options,
    method,
    headers,
    cache: 'no-store'
  });

  if (response.status === 401 && options?.retryOn401 !== false) {
    const refreshed = await ensureAccessToken();
    if (refreshed) {
      return fetchJson<T>(endpoint, {
        ...options,
        retryOn401: false
      });
    }
  }

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(payload || `HTTP ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function postJson<T>(endpoint: string, body: unknown): Promise<T> {
  return fetchJson<T>(endpoint, {
    method: 'POST',
    body: JSON.stringify(body)
  });
}

export async function patchJson<T>(endpoint: string, body: unknown): Promise<T> {
  return fetchJson<T>(endpoint, {
    method: 'PATCH',
    body: JSON.stringify(body)
  });
}

export async function uploadForm<T>(endpoint: string, formData: FormData, options?: { publicAccess?: boolean; retryOn401?: boolean }): Promise<T> {
  const response = await fetch(proxyUrl(endpoint), {
    method: 'POST',
    headers: withCsrf(),
    body: formData,
    cache: 'no-store'
  });

  if (response.status === 401 && options?.retryOn401 !== false) {
    const refreshed = await ensureAccessToken();
    if (refreshed) {
      return uploadForm<T>(endpoint, formData, { ...options, retryOn401: false });
    }
  }

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(payload || `HTTP ${response.status}`);
  }

  return response.json() as Promise<T>;
}
