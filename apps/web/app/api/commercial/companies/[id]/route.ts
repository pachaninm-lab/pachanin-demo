import { NextResponse } from 'next/server';
import { commercialFetch } from '../../../../../lib/commercial-api';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const payload = await commercialFetch(`/companies/${params.id}`);
    return NextResponse.json(payload);
  } catch {
    return NextResponse.json({ ok: false, company: null }, { status: 200 });
  }
}
