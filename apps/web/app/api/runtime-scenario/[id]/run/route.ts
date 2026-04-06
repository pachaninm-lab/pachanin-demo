import { NextResponse } from 'next/server';
import { runtimeApiUrl, runtimeAuthHeaders } from '../../../runtime-auth-helpers';
import { assertCsrf } from '../../../../../lib/server-request-security';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const trusted = assertCsrf(request);
  if (trusted.ok === false) {
    return NextResponse.json({ ok: false, error: trusted.reason }, { status: 403 });
  }

  try {
    const response = await fetch(runtimeApiUrl(`/runtime/scenarios/${params.id}/run`), { method: 'POST', headers: runtimeAuthHeaders(), cache: 'no-store' });
    const payload = await response.json().catch(() => ({}));
    return NextResponse.json(payload, { status: response.ok ? 200 : response.status });
  } catch {
    return NextResponse.json({ ok: false, error: 'runtime_scenario_unavailable' }, { status: 200 });
  }
}
