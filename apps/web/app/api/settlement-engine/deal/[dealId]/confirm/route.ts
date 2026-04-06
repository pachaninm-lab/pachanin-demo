import { NextResponse } from 'next/server';

export async function POST(_request: Request, { params }: { params: { dealId: string } }) {
  return NextResponse.json({
    ok: true,
    dealId: params.dealId,
    status: 'CONFIRMED',
    message: 'Расчётный лист подтверждён. Перевод в финальный платёж.',
    nextRail: 'payment_release',
  });
}
