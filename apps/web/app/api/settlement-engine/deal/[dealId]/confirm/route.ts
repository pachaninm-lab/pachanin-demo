import { NextResponse } from 'next/server';
import { assertCsrf } from '@/lib/server-request-security';
import { runtimeApiUrl, runtimeAuthHeaders } from '../../../../runtime-auth-helpers';

/**
 * Proxies the reserve/worksheet confirmation to the backend settlement engine,
 * which enforces role, per-deal object scope and state gates. This route never
 * fabricates a "confirmed" result — it returns exactly what the backend decides.
 *
 * The anti-forgery gate is this route's own responsibility, not the backend's:
 * runtimeAuthHeaders() turns the browser's own pc_access_token cookie into an
 * Authorization: Bearer header, so an unguarded proxy would spend a visitor's
 * credential on behalf of whatever page triggered the request.
 */
export async function POST(request: Request, props: { params: Promise<{ dealId: string }> }) {
  const csrf = assertCsrf(request);
  if (!csrf.ok) {
    const reason = 'reason' in csrf ? csrf.reason : 'csrf_invalid';
    return NextResponse.json({ ok: false, code: 'CSRF_REQUIRED', reason }, { status: 403 });
  }
  const params = await props.params;
  try {
    const response = await fetch(runtimeApiUrl(`/settlement-engine/deal/${params.dealId}/confirm`), {
      method: 'POST',
      cache: 'no-store',
      headers: await runtimeAuthHeaders({ 'content-type': 'application/json' }),
    });
    const payload = await response.json().catch(() => ({ ok: false }));
    return NextResponse.json(payload, { status: response.status });
  } catch {
    return NextResponse.json({ ok: false, message: 'settlement backend unavailable' }, { status: 502 });
  }
}
