import { NextResponse } from 'next/server';
import { runtimeApiUrl, runtimeAuthHeaders } from '../../../../runtime-auth-helpers';

/**
 * Proxies the final-payment release to the backend settlement engine, which is
 * the ONLY authority allowed to move money: it enforces role, per-deal object
 * scope, the deal state machine, blockers, and MFA. This route never fabricates
 * a "money released" result — it returns exactly what the backend decides.
 */
export async function POST(_request: Request, props: { params: Promise<{ dealId: string }> }) {
  const params = await props.params;
  try {
    const response = await fetch(runtimeApiUrl(`/settlement-engine/deal/${params.dealId}/release`), {
      method: 'POST',
      cache: 'no-store',
      headers: runtimeAuthHeaders({ 'content-type': 'application/json' }),
    });
    const payload = await response.json().catch(() => ({ ok: false }));
    return NextResponse.json(payload, { status: response.status });
  } catch {
    return NextResponse.json({ ok: false, message: 'settlement backend unavailable' }, { status: 502 });
  }
}
