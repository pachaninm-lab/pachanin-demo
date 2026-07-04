/**
 * Env-driven configuration for integration adapters, resolved per adapter name.
 *
 * Convention (per adapter NAME, e.g. BANK, FGIS_ZERNO):
 *   <NAME>_MODE            disabled | stub | sandbox | live   (default: stub)
 *   <NAME>_BASE_URL        base URL of the external system (required for live/sandbox)
 *   <NAME>_AUTH            none | api_key | bearer | oauth2    (default: none)
 *   <NAME>_API_KEY_HEADER  header name for api_key auth        (default: X-API-Key)
 *   <NAME>_API_KEY         api key value
 *   <NAME>_BEARER_TOKEN    static bearer token
 *   <NAME>_OAUTH_TOKEN_URL / _OAUTH_CLIENT_ID / _OAUTH_CLIENT_SECRET / _OAUTH_SCOPE
 *   <NAME>_TIMEOUT_MS      per-request timeout (default 15000)
 *   <NAME>_MAX_RETRIES     retry attempts (default 3)
 *
 * `assertLiveReady` is fail-closed: if mode is `live` but required fields are
 * missing, it throws at startup instead of silently degrading.
 */

export type IntegrationMode = 'disabled' | 'stub' | 'sandbox' | 'live';
export type AuthKind = 'none' | 'api_key' | 'bearer' | 'oauth2';

export interface IntegrationConfig {
  readonly name: string;
  readonly mode: IntegrationMode;
  readonly baseUrl?: string;
  readonly auth: AuthKind;
  readonly apiKeyHeader: string;
  readonly apiKey?: string;
  readonly bearerToken?: string;
  readonly oauth?: {
    readonly tokenUrl?: string;
    readonly clientId?: string;
    readonly clientSecret?: string;
    readonly scope?: string;
  };
  readonly timeoutMs: number;
  readonly maxRetries: number;
}

export type Env = Record<string, string | undefined>;

function normalizeMode(raw?: string): IntegrationMode {
  const v = String(raw || '').trim().toLowerCase();
  if (v === 'disabled' || v === 'off' || v === 'false') return 'disabled';
  if (v === 'sandbox' || v === 'test') return 'sandbox';
  if (v === 'live' || v === 'prod' || v === 'production') return 'live';
  return 'stub';
}

function normalizeAuth(raw?: string): AuthKind {
  const v = String(raw || '').trim().toLowerCase();
  if (v === 'api_key' || v === 'apikey') return 'api_key';
  if (v === 'bearer') return 'bearer';
  if (v === 'oauth2' || v === 'oauth') return 'oauth2';
  return 'none';
}

export function resolveIntegrationConfig(name: string, env: Env = process.env): IntegrationConfig {
  const p = (suffix: string) => env[`${name}_${suffix}`];
  return {
    name,
    mode: normalizeMode(p('MODE')),
    baseUrl: p('BASE_URL')?.replace(/\/+$/, ''),
    auth: normalizeAuth(p('AUTH')),
    apiKeyHeader: p('API_KEY_HEADER') || 'X-API-Key',
    apiKey: p('API_KEY'),
    bearerToken: p('BEARER_TOKEN'),
    oauth: {
      tokenUrl: p('OAUTH_TOKEN_URL'),
      clientId: p('OAUTH_CLIENT_ID'),
      clientSecret: p('OAUTH_CLIENT_SECRET'),
      scope: p('OAUTH_SCOPE'),
    },
    timeoutMs: Number(p('TIMEOUT_MS') || 15000),
    maxRetries: Number(p('MAX_RETRIES') || 3),
  };
}

/** Fail-closed validation: for live/sandbox, required transport+auth fields must be present. */
export function assertLiveReady(config: IntegrationConfig): void {
  if (config.mode !== 'live' && config.mode !== 'sandbox') return;
  const missing: string[] = [];
  if (!config.baseUrl) missing.push(`${config.name}_BASE_URL`);
  if (config.auth === 'api_key' && !config.apiKey) missing.push(`${config.name}_API_KEY`);
  if (config.auth === 'bearer' && !config.bearerToken) missing.push(`${config.name}_BEARER_TOKEN`);
  if (config.auth === 'oauth2') {
    if (!config.oauth?.tokenUrl) missing.push(`${config.name}_OAUTH_TOKEN_URL`);
    if (!config.oauth?.clientId) missing.push(`${config.name}_OAUTH_CLIENT_ID`);
    if (!config.oauth?.clientSecret) missing.push(`${config.name}_OAUTH_CLIENT_SECRET`);
  }
  if (missing.length) {
    throw new Error(
      `Integration "${config.name}" is set to mode="${config.mode}" but is missing required config: ${missing.join(', ')}. ` +
        `Set them or switch ${config.name}_MODE to "stub".`,
    );
  }
}
