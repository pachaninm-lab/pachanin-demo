import { runtimeApiUrl, runtimeAuthHeaders } from '../runtime-auth-helpers';
import { assertCsrf } from '../../../lib/server-request-security';
import { jsonNoStore } from '../../../lib/http/no-store';

export async function POST(request: Request) {
  const trusted = assertCsrf(request);
  if (trusted.ok === false) {
    return jsonNoStore({ ok: false, error: trusted.reason, message: 'CSRF rejected' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  try {
    const response = await fetch(runtimeApiUrl('/runtime/simulate'), {
      method: 'POST',
      headers: await runtimeAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
      cache: 'no-store',
    });
    const payload = await response.json().catch(() => ({}));
    return jsonNoStore({ ok: response.ok, message: payload?.meta?.eventFeed?.[0]?.message || 'Runtime simulation applied', payload }, { status: response.ok ? 200 : response.status });
  } catch {
    return jsonNoStore({ ok: false, message: 'Runtime API unavailable, local simulation only' }, { status: 200 });
  }
}
