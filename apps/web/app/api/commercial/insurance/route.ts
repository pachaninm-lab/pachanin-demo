import { commercialFetch } from '../../../../lib/commercial-api';
import { jsonNoStore } from '../../../../lib/http/no-store';

export async function GET() {
  try {
    const payload = await commercialFetch('/insurance');
    return jsonNoStore(payload);
  } catch {
    return jsonNoStore({ ok: false }, { status: 200 });
  }
}
