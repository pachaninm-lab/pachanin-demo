import { NextResponse } from 'next/server';
import { runtimeApiUrl, runtimeAuthHeaders } from '../runtime-auth-helpers';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const response = await fetch(runtimeApiUrl('/runtime/feed'), { cache: 'no-store', headers: runtimeAuthHeaders() });
    const payload = await response.json().catch(() => ({}));
    return NextResponse.json(payload, { status: response.ok ? 200 : response.status });
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
