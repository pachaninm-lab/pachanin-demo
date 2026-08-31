import { cookies } from 'next/headers';
import { ACCESS_COOKIE } from './auth-cookies';

const API_URL = String(
  process.env.API_URL
  || process.env.NEXT_PUBLIC_API_URL
  || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:4000/api'),
).replace(/\/$/, '');

export function serverApiUrl(path: string) {
  if (!API_URL) throw new Error('Server API URL is not configured');
  return `${API_URL}${path}`;
}

export async function serverAuthHeaders(extra?: HeadersInit): Promise<Headers> {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  const headers = new Headers(extra || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return headers;
}
