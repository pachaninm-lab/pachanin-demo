import { NextResponse } from 'next/server';

// Exact-SHA REG.RU release trigger for the single-authority iOS public-AI keyboard layout.
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

export function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      service: 'web',
      releaseAuthority: 'exact-sha',
      revision: process.env.APP_REVISION ?? 'unknown',
      checkedAt: new Date().toISOString(),
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'X-Robots-Tag': 'noindex, nofollow, noarchive',
      },
    },
  );
}
