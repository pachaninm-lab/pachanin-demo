import { describe, it, expect, afterEach } from 'vitest';
import { integrationRegistry } from '../registry';
import { configureIntegrationsFromEnv, QUARANTINED_ADAPTERS } from '../live/live-registry';
import { MockFgisZernoAdapter } from '../adapters/fgis-zerno.adapter';
import {
  FgisTestBindingRefusedError,
  registerMockFgisZernoAdapterForTests,
  restoreQuarantinedFgisZernoAdapter,
} from '../testing/fgis-zerno-test-binding';
import {
  LEGACY_FGIS_QUARANTINE_CODE,
  LegacyFgisQuarantineError,
  isQuarantinedFgisAdapter,
} from './fgis-zerno-legacy';

const deps = {
  fetchImpl: async () => ({ ok: true, status: 200, text: async () => '{}' }),
  sleep: async () => {},
  logger: { info() {}, warn() {}, error() {} },
};

const fullyConfigured = (mode: string) => ({
  FGIS_ZERNO_MODE: mode,
  FGIS_ZERNO_BASE_URL: 'https://api.fgis.example/v1',
  FGIS_ZERNO_AUTH: 'api_key',
  FGIS_ZERNO_API_KEY: 'k',
});

afterEach(() => {
  restoreQuarantinedFgisZernoAdapter();
});

describe('ФГИС «Зерно» legacy quarantine — default registry binding', () => {
  it('binds a fail-closed adapter, not a mock, at import time', async () => {
    const adapter = integrationRegistry.get('FGIS_ZERNO');
    expect(isQuarantinedFgisAdapter(adapter)).toBe(true);
    expect(adapter).not.toBeInstanceOf(MockFgisZernoAdapter);
    await expect(adapter.execute(undefined as never)).rejects.toThrow(
      LegacyFgisQuarantineError,
    );
  });

  it('lists FGIS_ZERNO as quarantined rather than stubbed', () => {
    const res = configureIntegrationsFromEnv({}, deps);
    expect(res.quarantined).toContain('FGIS_ZERNO');
    expect(res.stub).not.toContain('FGIS_ZERNO');
    expect(res.live).not.toContain('FGIS_ZERNO');
    expect(QUARANTINED_ADAPTERS).toContain('FGIS_ZERNO');
  });
});

describe('ФГИС «Зерно» legacy quarantine — no env value can promote it', () => {
  for (const mode of ['live', 'production', 'prod', 'sandbox', 'test'] as const) {
    it(`refuses FGIS_ZERNO_MODE=${mode} even with complete credentials`, () => {
      expect(() => configureIntegrationsFromEnv(fullyConfigured(mode), deps)).toThrow(
        LegacyFgisQuarantineError,
      );
      // The failed attempt must not have left anything callable behind.
      expect(isQuarantinedFgisAdapter(integrationRegistry.get('FGIS_ZERNO'))).toBe(true);
    });
  }

  for (const mode of ['stub', 'disabled', ''] as const) {
    it(`keeps FGIS_ZERNO fail-closed for FGIS_ZERNO_MODE=${mode || '(unset)'}`, async () => {
      configureIntegrationsFromEnv({ FGIS_ZERNO_MODE: mode }, deps);
      const adapter = integrationRegistry.get('FGIS_ZERNO');
      expect(isQuarantinedFgisAdapter(adapter)).toBe(true);
      await expect(adapter.execute(undefined as never)).rejects.toThrow(
        LegacyFgisQuarantineError,
      );
      expect((await adapter.healthCheck()).detail).toBe(LEGACY_FGIS_QUARANTINE_CODE);
    });
  }

  it('leaves the other integrations untouched while refusing FGIS_ZERNO', () => {
    // BANK is configured for live and must still be reachable; the quarantine is
    // scoped to one integration, not a blanket kill switch.
    const res = configureIntegrationsFromEnv(
      { BANK_MODE: 'live', BANK_BASE_URL: 'https://bank.example', BANK_AUTH: 'bearer', BANK_BEARER_TOKEN: 't' },
      deps,
    );
    expect(res.live).toContain('BANK');
    expect(res.quarantined).toEqual(['FGIS_ZERNO']);
  });
});

describe('ФГИС «Зерно» mock — explicit test-only binding', () => {
  it('binds the mock only when a test asks for it by name, and restores after', async () => {
    expect(isQuarantinedFgisAdapter(integrationRegistry.get('FGIS_ZERNO'))).toBe(true);

    const dispose = registerMockFgisZernoAdapterForTests();
    expect(integrationRegistry.get('FGIS_ZERNO')).toBeInstanceOf(MockFgisZernoAdapter);

    dispose();
    expect(isQuarantinedFgisAdapter(integrationRegistry.get('FGIS_ZERNO'))).toBe(true);
    await expect(
      integrationRegistry.get('FGIS_ZERNO').execute(undefined as never),
    ).rejects.toThrow(LegacyFgisQuarantineError);
  });

  it('refuses to bind the mock under NODE_ENV=production', () => {
    const saved = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      expect(() => registerMockFgisZernoAdapterForTests()).toThrow(
        FgisTestBindingRefusedError,
      );
      expect(isQuarantinedFgisAdapter(integrationRegistry.get('FGIS_ZERNO'))).toBe(true);
    } finally {
      process.env.NODE_ENV = saved;
    }
  });
});
