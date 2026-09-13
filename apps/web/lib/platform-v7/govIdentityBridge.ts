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
  /** Hosts this application may hand a user to. ASVS 5.0 V3.7.2. */
  allowedHosts: readonly string[];
};

export function readGovIdentityBridgeConfig(): GovIdentityBridgeConfig {
  return {
    enabled: process.env.PLATFORM_V7_GOV_ID_ENABLED === 'true',
    authorizationUrl: process.env.PLATFORM_V7_GOV_ID_AUTHORIZATION_URL || null,
    clientId: process.env.PLATFORM_V7_GOV_ID_CLIENT_ID || null,
    redirectUri: process.env.PLATFORM_V7_GOV_ID_REDIRECT_URI || null,
    scope: process.env.PLATFORM_V7_GOV_ID_SCOPE || 'openid profile email',
    allowedHosts: parseAllowedHosts(process.env.PLATFORM_V7_GOV_ID_ALLOWED_HOSTS),
  };
}

/**
 * ASVS 5.0 V3.7.2: a redirect to a hostname this application does not control is
 * permitted only to an allowlisted destination.
 *
 * The authorization endpoint is read from the environment and was handed straight
 * to NextResponse.redirect - whatever it said, whatever its scheme. An operator
 * typo, a mis-set variable or an environment-injection then sends a user leaving
 * a login screen to an arbitrary host, which is the redirect this requirement is
 * about.
 *
 * The allowlist is configuration rather than a hard-coded provider, because this
 * repository does not name the intended one and guessing would be worse than
 * asking. It is enforced rather than advisory: with no allowlist there is no
 * external destination, so the requirement holds by construction whatever the
 * environment says. That is a refusal, not a crash - the route already has a
 * fallback for an unusable bridge and this reuses it.
 */
export function parseAllowedHosts(raw: string | undefined): readonly string[] {
  return String(raw ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * True when the URL is somewhere this application is permitted to send a user:
 * https, and a host named on the allowlist. Host comparison is exact - a suffix
 * match would accept `esia.gosuslugi.ru.evil.example`.
 */
export function isAllowedGovIdentityDestination(url: URL, allowedHosts: readonly string[]): boolean {
  if (url.protocol !== 'https:') return false;
  return allowedHosts.includes(url.hostname.toLowerCase());
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
  let url: URL;
  try {
    url = new URL(config.authorizationUrl as string);
  } catch {
    return null;
  }
  if (!isAllowedGovIdentityDestination(url, config.allowedHosts)) return null;
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
