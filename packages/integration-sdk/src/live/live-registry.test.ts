import { describe, it, expect, beforeEach } from 'vitest';
import { configureIntegrationsFromEnv, LIVE_ADAPTER_FACTORIES } from './live-registry';
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

  it('swaps every adapter to live when fully configured', () => {
    const names = [
      'FGIS_ZERNO', 'FNS', 'DIADOK', 'CRYPTOPRO_DSS', 'BANK', 'GPS', 'FTS', 'RSHN',
      'AML_ROSFINMONITORING', 'RZD_ETRAN', 'GIS_EPD', 'BKI_NBKI', 'TAKSKOM', 'MARINE_TRAFFIC', 'SMEV',
    ] as const;
    const env: Record<string, string> = {};
    for (const n of names) {
      env[`${n}_MODE`] = 'live';
      env[`${n}_BASE_URL`] = `https://api.${n.toLowerCase()}.example/v1`;
      env[`${n}_AUTH`] = 'api_key';
      env[`${n}_API_KEY`] = 'k';
    }
    const res = configureIntegrationsFromEnv(env, deps);
    expect(res.live).toHaveLength(names.length);
    for (const n of names) {
      expect(integrationRegistry.get(n).mode).toBe('live');
      expect(integrationRegistry.get(n).name).toBe(n);
    }
  });

  it('fail-loud: live mode for an adapter without a live class throws a clear message', () => {
    // All real names have factories, so remove one to exercise the guard branch.
    const saved = LIVE_ADAPTER_FACTORIES.GPS;
    delete LIVE_ADAPTER_FACTORIES.GPS;
    try {
      const env = { GPS_MODE: 'live', GPS_BASE_URL: 'https://gps.example', GPS_AUTH: 'api_key', GPS_API_KEY: 'k' };
      expect(() => configureIntegrationsFromEnv(env, deps)).toThrow(/no LiveGps.*Adapter is implemented/);
    } finally {
      LIVE_ADAPTER_FACTORIES.GPS = saved;
    }
  });

  it('disabled mode replaces the mock with a hard-stop adapter', async () => {
    const res = configureIntegrationsFromEnv({ RSHN_MODE: 'disabled' }, deps);
    expect(res.disabled).toContain('RSHN');
    const rshn = integrationRegistry.get('RSHN');
    await expect(rshn.execute(undefined as never)).rejects.toThrow(/disabled/i);
    const health = await rshn.healthCheck();
    expect(health.status).toBe('down');
    expect(health.detail).toBe('disabled');
  });
});
