import { NextResponse } from 'next/server';
import { runtimeApiUrl, runtimeAuthHeaders } from '../runtime-auth-helpers';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limit = url.searchParams.get('limit') || '100';
  try {
    const response = await fetch(runtimeApiUrl(`/runtime/outbox/dead?limit=${limit}`), { cache: 'no-store', headers: runtimeAuthHeaders() });
    const payload = await response.json().catch(() => ({}));
    return NextResponse.json(payload, { status: response.ok ? 200 : response.status });
  } catch {
    return NextResponse.json({ ok: false, items: [] }, { status: 200 });
  }
}
