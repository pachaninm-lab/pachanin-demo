import { cookies } from 'next/headers';
import { ACCESS_COOKIE } from '../../lib/auth-cookies';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export function runtimeApiUrl(path: string) {
  return `${API_URL}${path}`;
}

export async function runtimeAuthHeaders(extra?: HeadersInit): Promise<Headers> {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  const headers = new Headers(extra || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return headers;
}
