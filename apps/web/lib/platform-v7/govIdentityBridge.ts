import { randomBytes } from 'node:crypto';
import type { NextRequest } from 'next/server';

export const GOV_ID_STATE_COOKIE = 'pc_v7_gov_id_state';
export const GOV_ID_NONCE_COOKIE = 'pc_v7_gov_id_nonce';
export const GOV_ID_FLOW_COOKIE = 'pc_v7_gov_id_flow';

export type GovIdentityFlow = 'login' | 'register' | 'fgis';

export type GovIdentityBridgeConfig = {
  enabled: boolean;
  authorizationUrl: string | null;
  clientId: string | null;
  redirectUri: string | null;
  scope: string;
};

export function readGovIdentityBridgeConfig(): GovIdentityBridgeConfig {
  return {
    enabled: process.env.PLATFORM_V7_GOV_ID_ENABLED === 'true',
    authorizationUrl: process.env.PLATFORM_V7_GOV_ID_AUTHORIZATION_URL || null,
    clientId: process.env.PLATFORM_V7_GOV_ID_CLIENT_ID || null,
    redirectUri: process.env.PLATFORM_V7_GOV_ID_REDIRECT_URI || null,
    scope: process.env.PLATFORM_V7_GOV_ID_SCOPE || 'openid profile email',
  };
}

export function isGovIdentityConfigured(config = readGovIdentityBridgeConfig()) {
  return Boolean(config.enabled && config.authorizationUrl && config.clientId && config.redirectUri);
}

export function randomBridgeValue(bytes = 24) {
  return randomBytes(bytes).toString('base64url');
}

export function normalizeGovIdentityFlow(value: string | null): GovIdentityFlow {
  if (value === 'register' || value === 'fgis') return value;
  return 'login';
}

export function buildGovIdentityStartUrl(config: GovIdentityBridgeConfig, state: string, nonce: string) {
  if (!isGovIdentityConfigured(config)) return null;
  const url = new URL(config.authorizationUrl as string);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', config.clientId as string);
  url.searchParams.set('redirect_uri', config.redirectUri as string);
  url.searchParams.set('scope', config.scope);
  url.searchParams.set('state', state);
  url.searchParams.set('nonce', nonce);
  return url;
}

export function bridgeCookieOptions(request: NextRequest, maxAge = 600) {
  return { httpOnly: true, sameSite: 'lax' as const, secure: request.nextUrl.protocol === 'https:', path: '/', maxAge };
}

export function bridgeFallbackTarget(request: NextRequest, flow: GovIdentityFlow, reason: string) {
  const target = new URL(flow === 'register' ? '/platform-v7/register' : flow === 'fgis' ? '/platform-v7/fgis-access' : '/platform-v7/login', request.url);
  target.searchParams.set('gov_id', reason);
  return target;
}
