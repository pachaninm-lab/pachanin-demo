import { NextResponse } from 'next/server';
import { runtimeApiUrl, runtimeAuthHeaders } from '../runtime-auth-helpers';
import { assertCsrf } from '../../../lib/server-request-security';

export async function POST(request: Request) {
  const trusted = assertCsrf(request);
  if (trusted.ok === false) {
    return NextResponse.json({ ok: false, error: trusted.reason, command: null }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  try {
    const response = await fetch(runtimeApiUrl('/runtime/commands'), {
      method: 'POST',
      headers: runtimeAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body || {}),
      cache: 'no-store'
    });
    const payload = await response.json().catch(() => ({}));
    return NextResponse.json(payload, { status: response.ok ? 200 : response.status });
  } catch {
    return NextResponse.json({ ok: false, command: null }, { status: 200 });
  }
}
