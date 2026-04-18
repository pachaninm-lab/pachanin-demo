import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const dealId = body?.dealId ?? 'UNKNOWN';
  const amount = body?.amount ?? 0;

  const callbackId = `CB-${Math.floor(Math.random() * 9000) + 1000}`;

  const payload = {
    id: callbackId,
    type: 'Release',
    dealId,
    status: 'ok',
    note: 'Fake-live callback: выпуск средств подтверждён',
    amountRub: amount,
    ts: new Date().toISOString(),
  };

  return NextResponse.json(payload);
}
