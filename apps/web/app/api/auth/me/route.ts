import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { SESSION_COOKIE } from '../../../../lib/auth-cookies';

export const dynamic = 'force-dynamic';

export async function GET() {
  const jar = cookies();
  const raw = jar.get(SESSION_COOKIE)?.value;
  if (!raw) {
    return NextResponse.json({ role: 'GUEST', authenticated: false });
  }
  try {
    const session = JSON.parse(decodeURIComponent(raw));
    const now = Math.floor(Date.now() / 1000);
    if (session.exp && session.exp < now) {
      return NextResponse.json({ role: 'GUEST', authenticated: false, reason: 'expired' });
    }
    return NextResponse.json({
      role: session.role || 'GUEST',
      email: session.email || null,
      surfaceRole: session.role || 'GUEST',
      authenticated: true,
      expiresAt: session.exp ? session.exp * 1000 : null,
    });
  } catch {
    return NextResponse.json({ role: 'GUEST', authenticated: false });
  }
}
