import { NextResponse } from 'next/server';
import { commercialFetch } from '../../../../../../lib/commercial-api';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const payload = await commercialFetch(`/finance/applications/${params.id}`);
    return NextResponse.json(payload);
  } catch {
    return NextResponse.json({ ok: false, item: null }, { status: 200 });
  }
}
