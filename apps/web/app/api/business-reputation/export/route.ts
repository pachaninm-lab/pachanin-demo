import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ACCESS_COOKIE } from '../../../../lib/auth-cookies';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export async function GET() {
  const token = cookies().get(ACCESS_COOKIE)?.value;
  try {
    const response = await fetch(`${API_URL}/business-reputation/organizations/export`, { headers: token ? { Authorization: `Bearer ${token}` } : {}, cache: 'no-store' });
    const text = await response.text();
    return new NextResponse(text, { status: response.ok ? 200 : response.status, headers: { 'content-type': 'text/csv; charset=utf-8' } });
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
