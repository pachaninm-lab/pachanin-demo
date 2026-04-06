import { NextResponse } from 'next/server';
import { runtimeApiUrl, runtimeAuthHeaders } from '../../../runtime-auth-helpers';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const response = await fetch(runtimeApiUrl(`/documents/${params.id}/access`), { cache: 'no-store', headers: runtimeAuthHeaders() });
    const payload = await response.json().catch(() => ({}));
    return NextResponse.json(payload, { status: response.ok ? 200 : response.status });
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
