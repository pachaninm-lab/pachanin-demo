import { NextResponse } from 'next/server';
import { buildMarketIntentApiResult } from '@/lib/platform-v7/market-entry-api';

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ status: 'rejected', draft: null, message: 'Некорректный JSON.', durableStatus: 'not_attempted' }, { status: 400 });
  }

  const result = buildMarketIntentApiResult(payload);
  return NextResponse.json(result, { status: result.status === 'accepted_preintegration' ? 202 : 400 });
}

export async function GET() {
  return NextResponse.json({
    status: 'preintegration_contract_only',
    entity: 'market_intent',
    durableStorage: false,
    requiresOwner: true,
    requiresAudit: true,
    requiresIdempotency: true,
  });
}
