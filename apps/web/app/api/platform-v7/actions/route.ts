import { NextResponse } from 'next/server';
import { assertCsrf } from '../../../../lib/server-request-security';
import { handlePlatformV7ServerActionRouteBody } from '../../../../lib/platform-v7/server-action-route-handler';

export async function POST(request: Request) {
  const trusted = assertCsrf(request);
  if (trusted.ok === false) {
    return NextResponse.json(
      {
        ok: false,
        status: 'not_accepted',
        message: trusted.reason,
        canClaimExecuted: false,
        persisted: false,
        attemptedRuntimeWrite: false,
      },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const result = handlePlatformV7ServerActionRouteBody(body || {});

  return NextResponse.json(result.body, { status: result.status });
}
