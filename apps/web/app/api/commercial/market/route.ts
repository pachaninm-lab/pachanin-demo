import { NextResponse } from 'next/server';
import { commercialFetch } from '../../../../lib/commercial-api';

export async function GET() {
  try {
    const payload = await commercialFetch('/market');
    return NextResponse.json(payload);
  } catch {
    // Отказ backend'а должен быть видимым (503), а не маскироваться под успех.
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
