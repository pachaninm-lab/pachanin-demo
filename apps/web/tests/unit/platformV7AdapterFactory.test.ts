import { afterEach, describe, expect, it } from 'vitest';
import {
  PLATFORM_V7_MISSING_REAL_REGISTRY_MESSAGE,
  platformV7ClearRealAdapterRegistry,
  platformV7CreateAdapterRegistry,
  platformV7HasRealAdapterRegistry,
  platformV7RegisterRealAdapterRegistry,
  platformV7ResolveAdapterMode,
} from '@/lib/platform-v7/adapter-factory';
import { platformV7CreateMockAdapterRegistry, type PlatformV7ExternalSystem } from '@/lib/platform-v7/external-adapters';
import { createRealAdapterRegistryFromConfig, type RealAdapterEndpointConfig } from '@/lib/platform-v7/adapters/real-adapter-template';

const systems: PlatformV7ExternalSystem[] = ['bank', 'fgis', 'edo', 'epd', 'logistics', 'lab', 'oneC', 'notification'];

const endpoint: RealAdapterEndpointConfig = { baseUrl: 'https://example.invalid', apiKey: 'test-key' };
const fullConfig = {
  bank: endpoint,
  fgis: endpoint,
  edo: endpoint,
  epd: endpoint,
  logistics: endpoint,
  lab: endpoint,
  oneC: endpoint,
  notification: endpoint,
};

afterEach(() => {
  platformV7ClearRealAdapterRegistry();
});

describe('platform-v7 adapter factory', () => {
  it('maps only production to the real adapter mode', () => {
    expect(platformV7ResolveAdapterMode('production')).toBe('real');
    expect(platformV7ResolveAdapterMode('pilot')).toBe('mock');
    expect(platformV7ResolveAdapterMode('sandbox')).toBe('mock');
    expect(platformV7ResolveAdapterMode('demo')).toBe('mock');
  });

  it('returns a complete mock registry for non-production environments', () => {
    const registry = platformV7CreateAdapterRegistry({ environment: 'pilot' });
    expect(Object.keys(registry).sort()).toEqual([...systems].sort());
    for (const system of systems) {
      expect(registry[system].provider).toBe('mock');
    }
  });

  it('throws a clear, actionable error in real mode before the real registry is registered', () => {
    expect(platformV7HasRealAdapterRegistry()).toBe(false);
    expect(() => platformV7CreateAdapterRegistry({ mode: 'real' })).toThrowError(
      PLATFORM_V7_MISSING_REAL_REGISTRY_MESSAGE,
    );
  });

  it('uses the registered real registry in real mode and reports every system as real', () => {
    platformV7RegisterRealAdapterRegistry(() => createRealAdapterRegistryFromConfig(fullConfig));
    expect(platformV7HasRealAdapterRegistry()).toBe(true);

    const registry = platformV7CreateAdapterRegistry({ mode: 'real' });
    expect(Object.keys(registry).sort()).toEqual([...systems].sort());
    for (const system of systems) {
      expect(registry[system].provider).toBe('real');
      expect(registry[system].system).toBe(system);
    }
  });

  it('keeps the real bank adapter from silently confirming before it is implemented', async () => {
    const registry = createRealAdapterRegistryFromConfig(fullConfig);
    const health = await registry.bank.healthCheck();
    expect(health.provider).toBe('real');
    expect(health.status).toBe('unavailable');
    await expect(
      registry.bank.call({ operation: 'requestReserve', dealId: 'DL-9106', amount: 1, currency: 'RUB', context: {
        correlationId: 'c', auditId: 'a', actorId: 'u', organizationId: 'o', role: 'bank',
      } }),
    ).rejects.toThrow(/не реализован/);
  });

  it('clearing the real registry falls back to the missing-registry error', () => {
    platformV7RegisterRealAdapterRegistry(() => platformV7CreateMockAdapterRegistry());
    expect(platformV7HasRealAdapterRegistry()).toBe(true);
    platformV7ClearRealAdapterRegistry();
    expect(platformV7HasRealAdapterRegistry()).toBe(false);
    expect(() => platformV7CreateAdapterRegistry({ mode: 'real' })).toThrow();
  });
});
