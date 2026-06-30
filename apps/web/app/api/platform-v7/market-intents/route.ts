import { buildMarketIntentApiResult } from '@/lib/platform-v7/market-entry-api';

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ status: 'rejected', draft: null, message: 'Некорректный JSON.' }, { status: 400 });
  }

  const result = buildMarketIntentApiResult(payload);
  return Response.json(result, { status: result.status === 'accepted_preintegration' ? 202 : 400 });
}

export async function GET() {
  return Response.json({
    status: 'preintegration_contract_only',
    entity: 'market_intent',
    durableStorage: false,
    requiresOwner: true,
    requiresAudit: true,
    requiresIdempotency: true,
  });
}
