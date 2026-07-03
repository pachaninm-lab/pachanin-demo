import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Public liveness probe (whitelisted in middleware PUBLIC_API_EXACT).
// Answers "is the web tier up" only — no auth, no DB, no downstream calls,
// so balancers and uptime monitors can poll it cheaply and it never cascades
// a backend outage into a false "web is down".
export async function GET() {
  return NextResponse.json(
    { ok: true, service: 'web', ts: new Date().toISOString() },
    { headers: { 'cache-control': 'no-store' } },
  );
}
