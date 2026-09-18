import { runtimeApiUrl, runtimeAuthHeaders } from '../runtime-auth-helpers';
import { jsonNoStore } from '../../../lib/http/no-store';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limit = url.searchParams.get('limit') || '100';
  try {
    const response = await fetch(runtimeApiUrl(`/runtime/outbox?limit=${limit}`), { cache: 'no-store', headers: await runtimeAuthHeaders() });
    const payload = await response.json().catch(() => ({}));
    return jsonNoStore(payload, { status: response.ok ? 200 : response.status });
  } catch {
    return jsonNoStore({ ok: false, items: [] }, { status: 200 });
  }
}
