import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ACCESS_COOKIE, REFRESH_COOKIE, SESSION_COOKIE, CSRF_COOKIE } from '../../../../lib/auth-cookies';

export async function POST() {
  const jar = cookies();
  jar.set(ACCESS_COOKIE, '', { path: '/', maxAge: 0 });
  jar.set(REFRESH_COOKIE, '', { path: '/', maxAge: 0 });
  jar.set(SESSION_COOKIE, '', { path: '/', maxAge: 0 });
  jar.set(CSRF_COOKIE, '', { path: '/', maxAge: 0 });
  return NextResponse.json({ ok: true });
}
