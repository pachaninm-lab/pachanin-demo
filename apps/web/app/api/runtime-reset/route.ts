import { runtimeApiUrl, runtimeAuthHeaders } from '../runtime-auth-helpers';
import { assertCsrf } from '../../../lib/server-request-security';
import { jsonNoStore } from '../../../lib/http/no-store';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const trusted = assertCsrf(request);
  if (trusted.ok === false) {
    return jsonNoStore({ ok: false, message: trusted.reason }, { status: 403 });
  }

  try {
    const response = await fetch(runtimeApiUrl('/runtime/reset'), { method: 'POST', headers: await runtimeAuthHeaders(), cache: 'no-store' });
    const payload = await response.json().catch(() => ({}));
    return jsonNoStore({ ok: response.ok, message: 'Runtime reset to seed snapshot', payload }, { status: response.ok ? 200 : response.status });
  } catch {
    return jsonNoStore({ ok: false, message: 'Runtime reset unavailable' }, { status: 200 });
  }
}
