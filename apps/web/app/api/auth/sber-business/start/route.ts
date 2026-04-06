import { NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export async function GET(request: Request) {
  const url = new URL(request.url);
  try {
    const response = await fetch(`${API_URL}/auth/sber-business/start?${url.searchParams.toString()}`, { cache: 'no-store' });
    const payload = await response.json().catch(() => ({}));
    return NextResponse.json(payload, { status: response.ok ? 200 : response.status });
  } catch {
    return NextResponse.json({ ok: false, message: 'sber_start_unavailable' }, { status: 200 });
  }
}
