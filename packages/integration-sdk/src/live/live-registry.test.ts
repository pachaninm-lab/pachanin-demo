import { describe, it, expect, beforeEach } from 'vitest';
import { configureIntegrationsFromEnv } from './live-registry';
import { integrationRegistry } from '../registry';
import type { FetchLike } from './http-integration-client';
import type { BankAdapter } from '../adapters/bank.adapter';

const okFetch: FetchLike = async () => ({ ok: true, status: 200, text: async () => '{}' });
const deps = { fetchImpl: okFetch, sleep: async () => {}, logger: { info() {}, warn() {}, error() {} } };

describe('configureIntegrationsFromEnv', () => {
  beforeEach(() => {
    // restore defaults (mock adapters) between tests by re-registering not needed:
    // we only assert types/modes via fresh env.
  });

  it('keeps mocks in stub mode by default', () => {
    const res = configureIntegrationsFromEnv({}, deps);
    expect(res.stub).toContain('BANK');
    expect(res.live).toHaveLength(0);
    expect(integrationRegistry.get('BANK').mode).toBe('mock');
  });

  it('swaps BANK to a live adapter when configured', () => {
    const env = {
      BANK_MODE: 'live',
      BANK_BASE_URL: 'https://api.bank.example/v1',
      BANK_AUTH: 'bearer',
      BANK_BEARER_TOKEN: 'tok',
    };
    const res = configureIntegrationsFromEnv(env, deps);
    expect(res.live).toContain('BANK');
    const bank = integrationRegistry.get<BankAdapter & { mode: string }>('BANK');
    expect(bank.mode).toBe('live');
  });

  it('fail-closed: live mode with a known adapter but missing creds throws the exact env name', () => {
    // BANK has a live factory, so we reach assertLiveReady → missing BANK_BASE_URL.
    expect(() => configureIntegrationsFromEnv({ BANK_MODE: 'live', BANK_AUTH: 'bearer' }, deps)).toThrow(/BANK_BASE_URL/);
  });

  it('fail-loud: live mode for an adapter without a live class throws a clear message', () => {
    const env = {
      GPS_MODE: 'live',
      GPS_BASE_URL: 'https://gps.example',
      GPS_AUTH: 'api_key',
      GPS_API_KEY: 'k',
    };
    expect(() => configureIntegrationsFromEnv(env, deps)).toThrow(/no LiveGps.*Adapter is implemented/);
  });
});
