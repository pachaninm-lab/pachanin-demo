import { jsonNoStore } from '../../../lib/http/no-store';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  // Accept and acknowledge any queued offline action
  return jsonNoStore({
    ok: true,
    id: body.id,
    type: body.type,
    synced: true,
    processedAt: new Date().toISOString(),
  });
}
