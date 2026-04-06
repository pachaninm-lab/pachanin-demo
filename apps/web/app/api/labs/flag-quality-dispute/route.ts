import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  return NextResponse.json({
    ok: true,
    sampleId: body.sampleId || 'LAB-DEMO',
    status: 'DISPUTED',
    nextRail: 'dispute',
    disputeId: `DISPUTE-${String(Date.now()).slice(-6)}`,
    message: 'Проба переведена в спор. Выплата и settlement заблокированы до решения.',
  });
}
