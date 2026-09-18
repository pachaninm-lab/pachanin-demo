import { runtimeApiUrl, runtimeAuthHeaders } from '../../../runtime-auth-helpers';
import { assertCsrf } from '../../../../../lib/server-request-security';
import { jsonNoStore } from '../../../../../lib/http/no-store';

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const trusted = assertCsrf(request);
  if (trusted.ok === false) {
    return jsonNoStore({ ok: false, error: trusted.reason }, { status: 403 });
  }

  try {
    const response = await fetch(runtimeApiUrl(`/runtime/scenarios/${params.id}/run`), { method: 'POST', headers: await runtimeAuthHeaders(), cache: 'no-store' });
    const payload = await response.json().catch(() => ({}));
    return jsonNoStore(payload, { status: response.ok ? 200 : response.status });
  } catch {
    return jsonNoStore({ ok: false, error: 'runtime_scenario_unavailable' }, { status: 200 });
  }
}
