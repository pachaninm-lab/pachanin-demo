import { NextResponse } from 'next/server';
import { runtimeApiUrl, runtimeAuthHeaders } from '../../../runtime-auth-helpers';

export async function GET(_: Request, props: { params: Promise<{ type: string; id: string }> }) {
  const params = await props.params;
  try {
    const response = await fetch(runtimeApiUrl(`/runtime/object/${params.type}/${params.id}`), { cache: 'no-store', headers: await runtimeAuthHeaders() });
    const payload = await response.json().catch(() => ({}));
    return NextResponse.json(payload, { status: response.ok ? 200 : response.status });
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
