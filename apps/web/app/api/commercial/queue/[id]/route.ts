import { NextResponse } from 'next/server';
import { commercialFetch } from '../../../../../lib/commercial-api';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const payload = await commercialFetch(`/queue/${params.id}`);
    return NextResponse.json(payload);
  } catch {
    // Отказ backend'а должен быть видимым (503), а не маскироваться под успех.
    return NextResponse.json({ ok: false, item: null }, { status: 503 });
  }
}
