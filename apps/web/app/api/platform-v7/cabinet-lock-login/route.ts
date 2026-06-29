import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { signCabinetSession } from '@/lib/platform-v7/verified-session';

const CABINET_SESSION_COOKIE = 'pc_v7_cabinet';
const TTL_SECONDS = 8 * 3600;

const ALLOWED_ROLES = new Set([
  'operator',
  'buyer',
  'seller',
  'logistics',
  'driver',
  'surveyor',
  'elevator',
  'lab',
  'bank',
  'arbitrator',
  'compliance',
  'executive',
]);

function readEnv(name: string): string {
  return String(process.env[name] || '').trim();
}

function safeEqual(a: string, b: string): boolean {
  if (!a || !b) return false;
  let diff = a.length ^ b.length;
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i += 1) {
    diff |= a.charCodeAt(i % a.length) ^ b.charCodeAt(i % b.length);
  }
  return diff === 0;
}

function cabinetSessionSecret(): string {
  return readEnv('JWT_SECRET') || readEnv('PC_CABINET_LOCK_PASSWORD');
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const login = typeof body?.login === 'string' ? body.login.trim() : '';
  const password = typeof body?.password === 'string' ? body.password.trim() : '';
  const role = typeof body?.role === 'string' ? body.role.trim() : '';

  const configuredUser = readEnv('PC_CABINET_LOCK_USER') || 'owner';
  const configuredPassword = readEnv('PC_CABINET_LOCK_PASSWORD');

  if (!configuredPassword) {
    return NextResponse.json({ ok: false, reason: 'cabinet lock credentials missing' }, { status: 503 });
  }

  if (!ALLOWED_ROLES.has(role)) {
    return NextResponse.json({ ok: false, reason: 'unknown role' }, { status: 400 });
  }

  if (!safeEqual(login, configuredUser) || !safeEqual(password, configuredPassword)) {
    return NextResponse.json({ ok: false, reason: 'invalid credentials' }, { status: 401 });
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const token = await signCabinetSession(role, cabinetSessionSecret(), { nowSeconds, ttlSeconds: TTL_SECONDS });

  if (!token) {
    return NextResponse.json({ ok: false, reason: 'cabinet session unavailable' }, { status: 503 });
  }

  cookies().set(CABINET_SESSION_COOKIE, token, {
    path: '/',
    maxAge: TTL_SECONDS,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });

  return NextResponse.json({ ok: true });
}
