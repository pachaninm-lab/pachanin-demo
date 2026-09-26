import { runtimeApiUrl, runtimeAuthHeaders } from '../runtime-auth-helpers';
import { jsonNoStore } from '../../../lib/http/no-store';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const response = await fetch(runtimeApiUrl('/runtime/me/feed'), { cache: 'no-store', headers: await runtimeAuthHeaders() });
    const payload = await response.json().catch(() => ({}));
    return jsonNoStore(payload, { status: response.ok ? 200 : response.status });
  } catch {
    return jsonNoStore({ ok: false }, { status: 200 });
  }
}
