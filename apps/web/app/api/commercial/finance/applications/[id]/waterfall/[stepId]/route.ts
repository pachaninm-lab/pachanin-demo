import { NextResponse } from 'next/server';
import { commercialFetch } from '../../../../../../../../lib/commercial-api';

export async function GET(_: Request, { params }: { params: { id: string; stepId: string } }) {
  try {
    const payload = await commercialFetch(`/finance/applications/${params.id}/waterfall/${params.stepId}`);
    return NextResponse.json(payload);
  } catch {
    return NextResponse.json({ ok: false, waterfall: null }, { status: 200 });
  }
}
