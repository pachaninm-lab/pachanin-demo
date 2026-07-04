/**
 * Auth strategies for live integration adapters. Each returns an `AuthProvider`
 * (a function producing request headers), so the HTTP client stays auth-agnostic.
 *
 * Covers the auth shapes the platform actually needs:
 *  - no auth
 *  - static API key header (ФГИС / ряд гос-сервисов)
 *  - static bearer token
 *  - OAuth2 client_credentials with token caching (Сбер Бизнес API и т.п.)
 *
 * mTLS (КриптоПро / банковский mTLS) is configured at the transport/agent level
 * on deploy, not here; this module covers the header-based auth.
 */

import type { AuthProvider, FetchLike } from './http-integration-client';

export function noAuth(): AuthProvider {
  return async () => ({});
}

export function apiKeyAuth(header: string, value: string): AuthProvider {
  if (!value) throw new Error(`apiKeyAuth: empty value for header "${header}"`);
  return async () => ({ [header.toLowerCase()]: value });
}

export function bearerAuth(token: string | (() => Promise<string>)): AuthProvider {
  return async () => {
    const t = typeof token === 'string' ? token : await token();
    if (!t) throw new Error('bearerAuth: empty token');
    return { authorization: `Bearer ${t}` };
  };
}

export interface OAuth2ClientCredentialsConfig {
  readonly tokenUrl: string;
  readonly clientId: string;
  readonly clientSecret: string;
  readonly scope?: string;
  /** Seconds subtracted from expiry to refresh early. Default 30. */
  readonly refreshSkewSec?: number;
  readonly fetchImpl?: FetchLike;
  readonly now?: () => number;
}

interface TokenResponse {
  access_token: string;
  token_type?: string;
  expires_in?: number;
}

/**
 * OAuth2 client_credentials grant with in-memory token caching + early refresh.
 * The returned provider yields `Authorization: Bearer <token>` and only hits the
 * token endpoint when the cached token is missing or about to expire.
 */
export function oauth2ClientCredentials(config: OAuth2ClientCredentialsConfig): AuthProvider {
  if (!config.tokenUrl) throw new Error('oauth2ClientCredentials: tokenUrl is required');
  if (!config.clientId || !config.clientSecret) throw new Error('oauth2ClientCredentials: clientId/clientSecret are required');
  const now = config.now ?? (() => Date.now());
  const skewMs = (config.refreshSkewSec ?? 30) * 1000;
  const doFetch = config.fetchImpl ?? (globalThis.fetch as unknown as FetchLike | undefined);
  if (!doFetch) throw new Error('oauth2ClientCredentials: no fetch implementation available');

  let cached: { token: string; expiresAt: number } | null = null;
  let inflight: Promise<string> | null = null;

  async function fetchToken(): Promise<string> {
    const params = new URLSearchParams({ grant_type: 'client_credentials' });
    if (config.scope) params.set('scope', config.scope);
    const basic = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');
    const res = await doFetch!(config.tokenUrl, {
      method: 'POST',
      headers: {
        authorization: `Basic ${basic}`,
        'content-type': 'application/x-www-form-urlencoded',
        accept: 'application/json',
      },
      body: params.toString(),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`oauth2 token endpoint ${res.status}: ${text.slice(0, 300)}`);
    const parsed = JSON.parse(text) as TokenResponse;
    if (!parsed.access_token) throw new Error('oauth2 token endpoint returned no access_token');
    const ttlMs = (parsed.expires_in ?? 3600) * 1000;
    cached = { token: parsed.access_token, expiresAt: now() + ttlMs };
    return parsed.access_token;
  }

  return async () => {
    if (cached && cached.expiresAt - skewMs > now()) return { authorization: `Bearer ${cached.token}` };
    if (!inflight) {
      inflight = fetchToken().finally(() => {
        inflight = null;
      });
    }
    const token = await inflight;
    return { authorization: `Bearer ${token}` };
  };
}
