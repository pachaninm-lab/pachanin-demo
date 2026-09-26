import { NextRequest, NextResponse } from 'next/server';
import { GOV_ID_FLOW_COOKIE, GOV_ID_NONCE_COOKIE, GOV_ID_STATE_COOKIE, bridgeCookieOptions, bridgeFallbackTarget, normalizeGovIdentityFlow } from '@/lib/platform-v7/govIdentityBridge';

export async function GET(request: NextRequest) {
  const flow = normalizeGovIdentityFlow(request.cookies.get(GOV_ID_FLOW_COOKIE)?.value ?? null);
  const expectedState = request.cookies.get(GOV_ID_STATE_COOKIE)?.value;
  const receivedState = request.nextUrl.searchParams.get('state');
  const code = request.nextUrl.searchParams.get('code');

  const reason = !expectedState || !receivedState || expectedState !== receivedState
    ? 'state-error'
    : !code
      ? 'code-missing'
      : 'callback-received';

  const target = bridgeFallbackTarget(request, flow, reason);
  const response = NextResponse.redirect(target);
  // Редирект несёт state и nonce в адресе; кэшировать его нельзя (V14.3.2).
  response.headers.set('cache-control', 'no-store');
  response.cookies.set(GOV_ID_STATE_COOKIE, '', bridgeCookieOptions(request, 0));
  response.cookies.set(GOV_ID_NONCE_COOKIE, '', bridgeCookieOptions(request, 0));
  response.cookies.set(GOV_ID_FLOW_COOKIE, '', bridgeCookieOptions(request, 0));
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
