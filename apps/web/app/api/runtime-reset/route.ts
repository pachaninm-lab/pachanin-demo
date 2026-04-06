import { NextResponse } from 'next/server';
import { runtimeApiUrl, runtimeAuthHeaders } from '../runtime-auth-helpers';
import { assertCsrf } from '../../../lib/server-request-security';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const trusted = assertCsrf(request);
  if (trusted.ok === false) {
    return NextResponse.json({ ok: false, message: trusted.reason }, { status: 403 });
  }

  try {
    const response = await fetch(runtimeApiUrl('/runtime/reset'), { method: 'POST', headers: runtimeAuthHeaders(), cache: 'no-store' });
    const payload = await response.json().catch(() => ({}));
    return NextResponse.json({ ok: response.ok, message: 'Runtime reset to seed snapshot', payload }, { status: response.ok ? 200 : response.status });
  } catch {
    return NextResponse.json({ ok: false, message: 'Runtime reset unavailable' }, { status: 200 });
  }
}
