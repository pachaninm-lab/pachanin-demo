import { NextResponse } from 'next/server';
import { commercialFetch } from '../../../../lib/commercial-api';

export async function GET() {
  try {
    const payload = await commercialFetch('/knowledge');
    return NextResponse.json(payload);
  } catch {
    return NextResponse.json({ ok: false, items: [] }, { status: 200 });
  }
}
