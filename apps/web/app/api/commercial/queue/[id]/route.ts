import { NextResponse } from 'next/server';
import { commercialFetch } from '../../../../../lib/commercial-api';

export async function GET(_: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const payload = await commercialFetch(`/queue/${params.id}`);
    return NextResponse.json(payload);
  } catch {
    return NextResponse.json({ ok: false, item: null }, { status: 200 });
  }
}
