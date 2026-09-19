import { NextRequest, NextResponse } from 'next/server';
import { GOV_ID_FLOW_COOKIE, GOV_ID_NONCE_COOKIE, GOV_ID_STATE_COOKIE, bridgeCookieOptions, bridgeFallbackTarget, buildGovIdentityStartUrl, normalizeGovIdentityFlow, randomBridgeValue, readGovIdentityBridgeConfig } from '@/lib/platform-v7/govIdentityBridge';

export async function GET(request: NextRequest) {
  const flow = normalizeGovIdentityFlow(request.nextUrl.searchParams.get('flow'));
  const config = readGovIdentityBridgeConfig();
  const state = randomBridgeValue();
  const nonce = randomBridgeValue();
  const startUrl = buildGovIdentityStartUrl(config, state, nonce);

  if (!startUrl) {
    const response = NextResponse.redirect(bridgeFallbackTarget(request, flow, 'not-configured'));
    response.headers.set('Cache-Control', 'no-store');
    return response;
  }

  const response = NextResponse.redirect(startUrl);
  response.cookies.set(GOV_ID_STATE_COOKIE, state, bridgeCookieOptions(request));
  response.cookies.set(GOV_ID_NONCE_COOKIE, nonce, bridgeCookieOptions(request));
  response.cookies.set(GOV_ID_FLOW_COOKIE, flow, bridgeCookieOptions(request));
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
