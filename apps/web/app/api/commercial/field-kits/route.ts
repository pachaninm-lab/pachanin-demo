import { commercialFetch } from '../../../../lib/commercial-api';
import { jsonNoStore } from '../../../../lib/http/no-store';

export async function GET() {
  try {
    const payload = await commercialFetch('/field-kits');
    return jsonNoStore(payload);
  } catch {
    return jsonNoStore({ ok: false, kits: [] }, { status: 200 });
  }
}
