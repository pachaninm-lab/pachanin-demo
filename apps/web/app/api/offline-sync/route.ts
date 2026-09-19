import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  // Accept and acknowledge any queued offline action
  return NextResponse.json({
    ok: true,
    id: body.id,
    type: body.type,
    synced: true,
    processedAt: new Date().toISOString(),
  });
}
