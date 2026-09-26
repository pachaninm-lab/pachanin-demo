import { commercialFetch } from '../../../../../../lib/commercial-api';
import { jsonNoStore } from '../../../../../../lib/http/no-store';

export async function GET(_: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const payload = await commercialFetch(`/finance/applications/${params.id}`);
    return jsonNoStore(payload);
  } catch {
    return jsonNoStore({ ok: false, item: null }, { status: 200 });
  }
}
