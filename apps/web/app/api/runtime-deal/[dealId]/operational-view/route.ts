import { runtimeApiUrl, runtimeAuthHeaders } from '../../../runtime-auth-helpers';
import { jsonNoStore } from '../../../../../lib/http/no-store';

export async function GET(_: Request, props: { params: Promise<{ dealId: string }> }) {
  const params = await props.params;
  try {
    const response = await fetch(runtimeApiUrl(`/runtime/deals/${params.dealId}/operational-view`), { cache: 'no-store', headers: await runtimeAuthHeaders() });
    const payload = await response.json().catch(() => ({}));
    return jsonNoStore(payload, { status: response.ok ? 200 : response.status });
  } catch {
    return jsonNoStore({ ok: false, view: null }, { status: 200 });
  }
}
