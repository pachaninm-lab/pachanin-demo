import { NextResponse } from 'next/server';
import { assertCsrf } from '@/lib/server-request-security';
import { runtimeApiUrl, runtimeAuthHeaders } from '../../../../runtime-auth-helpers';

/**
 * Proxies the final-payment release to the backend settlement engine, which is
 * the ONLY authority allowed to move money: it enforces role, per-deal object
 * scope, the deal state machine, blockers, and MFA. This route never fabricates
 * a "money released" result — it returns exactly what the backend decides.
 *
 * The anti-forgery gate is this route's own responsibility, not the backend's.
 * runtimeAuthHeaders() reads the pc_access_token cookie the browser attaches by
 * itself and turns it into an Authorization: Bearer header, so without a check
 * here a cross-site page could make this proxy spend the visitor's credential
 * on a money release — the backend would see a perfectly valid token.
 */
export async function POST(request: Request, props: { params: Promise<{ dealId: string }> }) {
  const csrf = assertCsrf(request);
  if (!csrf.ok) {
    const reason = 'reason' in csrf ? csrf.reason : 'csrf_invalid';
    return NextResponse.json({ ok: false, code: 'CSRF_REQUIRED', reason }, { status: 403 });
  }
  const params = await props.params;
  try {
    const response = await fetch(runtimeApiUrl(`/settlement-engine/deal/${params.dealId}/release`), {
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
