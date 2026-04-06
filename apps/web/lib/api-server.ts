import { serverApiUrl, serverAuthHeaders } from './server-api';

/**
 * Server-side API helper for Next.js server components.
 * Falls back gracefully when the API is unavailable.
 */
export async function apiServer<T = any>(
  path: string,
  options?: { method?: string; body?: any },
): Promise<T> {
  const url = serverApiUrl(path);
  const headers = serverAuthHeaders({ 'Content-Type': 'application/json' });

  const res = await fetch(url, {
    method: options?.method || 'GET',
    headers,
    body: options?.body ? JSON.stringify(options.body) : undefined,
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`API ${options?.method || 'GET'} ${path} failed: ${res.status}`);
  }

  return res.json();
}
