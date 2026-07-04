import { describe, it, expect } from 'vitest';
import { assertLiveReady, resolveIntegrationConfig } from './integration-config';

describe('integration-config', () => {
  it('defaults to stub mode and none auth', () => {
    const c = resolveIntegrationConfig('BANK', {});
    expect(c.mode).toBe('stub');
    expect(c.auth).toBe('none');
    expect(c.timeoutMs).toBe(15000);
  });

  it('resolves live oauth2 config from env', () => {
    const c = resolveIntegrationConfig('BANK', {
      BANK_MODE: 'live',
      BANK_BASE_URL: 'https://api.bank.example/v1/',
      BANK_AUTH: 'oauth2',
      BANK_OAUTH_TOKEN_URL: 'https://auth.bank.example/token',
      BANK_OAUTH_CLIENT_ID: 'cid',
      BANK_OAUTH_CLIENT_SECRET: 'sec',
      BANK_OAUTH_SCOPE: 'escrow',
      BANK_TIMEOUT_MS: '9000',
    });
    expect(c.mode).toBe('live');
    expect(c.baseUrl).toBe('https://api.bank.example/v1');
    expect(c.auth).toBe('oauth2');
    expect(c.oauth?.clientId).toBe('cid');
    expect(c.timeoutMs).toBe(9000);
    expect(() => assertLiveReady(c)).not.toThrow();
  });

  it('stub mode never requires live config', () => {
    expect(() => assertLiveReady(resolveIntegrationConfig('FGIS_ZERNO', {}))).not.toThrow();
  });

  it('fail-closed: live without base url or creds throws with the exact missing env names', () => {
    const c = resolveIntegrationConfig('FGIS_ZERNO', { FGIS_ZERNO_MODE: 'live', FGIS_ZERNO_AUTH: 'api_key' });
    expect(() => assertLiveReady(c)).toThrow(/FGIS_ZERNO_BASE_URL/);
    expect(() => assertLiveReady(c)).toThrow(/FGIS_ZERNO_API_KEY/);
  });

  it('fail-closed: live oauth2 missing token url/client throws', () => {
    const c = resolveIntegrationConfig('DIADOK', {
      DIADOK_MODE: 'live',
      DIADOK_BASE_URL: 'https://diadoc.example',
      DIADOK_AUTH: 'oauth2',
    });
    expect(() => assertLiveReady(c)).toThrow(/DIADOK_OAUTH_TOKEN_URL/);
  });
});
