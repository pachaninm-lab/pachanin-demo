import { NextResponse } from 'next/server';
import { runtimeApiUrl, runtimeAuthHeaders } from '../../../runtime-auth-helpers';

export async function GET(_: Request, { params }: { params: { dealId: string } }) {
  try {
    const response = await fetch(runtimeApiUrl(`/runtime/deals/${params.dealId}/operational-view`), { cache: 'no-store', headers: runtimeAuthHeaders() });
    const payload = await response.json().catch(() => ({}));
    return NextResponse.json(payload, { status: response.ok ? 200 : response.status });
  } catch {
    return NextResponse.json({ ok: false, view: null }, { status: 200 });
  }
}
