import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  return NextResponse.json({
    ok: true,
    sampleId: body.sampleId || 'LAB-DEMO',
    status: 'COMPLETED',
    nextRail: 'settlement',
    message: 'Лабораторный протокол завершён. Сделка переведена в расчёт денег.',
  });
}
