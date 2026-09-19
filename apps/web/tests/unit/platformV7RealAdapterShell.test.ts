import { describe, expect, it, vi } from 'vitest';
import {
  createRealAdapterShell,
  platformV7BuildAdapterRegistryFromEnv,
  resolveRealAdapterConfig,
} from '@/lib/platform-v7/adapters/real-adapter-shell';
import type { PlatformV7ExternalCallContext } from '@/lib/platform-v7/external-adapters';

const context: PlatformV7ExternalCallContext = {
  correlationId: 'corr-1',
  auditId: 'audit-1',
  actorId: 'user-1',
  organizationId: 'org-1',
  role: 'operator',
  idempotencyKey: 'idem-1',
};

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as unknown as Response;
}

describe('PR-4 real adapter shells', () => {
  it('resolves config per system from prefixed env vars', () => {
    expect(resolveRealAdapterConfig('fgis', {} as unknown as NodeJS.ProcessEnv)).toBeNull();
    const cfg = resolveRealAdapterConfig('fgis', { FGIS_API_BASE_URL: 'https://fgis', FGIS_API_KEY: 'k' } as unknown as NodeJS.ProcessEnv);
    expect(cfg).toMatchObject({ baseUrl: 'https://fgis', apiKey: 'k' });
  });

  it('maps an operation to the system path and returns pending without confirming externally', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ id: 'sdiz-1' }));
    const fgis = createRealAdapterShell('fgis', { baseUrl: 'https://fgis/', apiKey: 'k', fetchImpl: fetchImpl as unknown as typeof fetch });
    const result = await fgis.call({ operation: 'sendSdiz', sdizId: 'S-1', context });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://fgis/sdiz/send');
    expect((init.headers as Record<string, string>)['Idempotency-Key']).toBe('idem-1');
    expect(result.status).toBe('pending');
    expect(result.provider).toBe('real');
    expect(result.doesNotConfirmExternally).toBe(true);
  });

  it('routes 4xx to manual_review and 5xx/throw to failed', async () => {
    const m = createRealAdapterShell('edo', { baseUrl: 'https://edo', apiKey: 'k', fetchImpl: (async () => jsonResponse({}, false, 409)) as unknown as typeof fetch });
    expect((await m.call({ operation: 'sendForSignature', dealId: 'D', documentIds: [], context })).status).toBe('manual_review');
    const f = createRealAdapterShell('edo', { baseUrl: 'https://edo', apiKey: 'k', fetchImpl: (async () => jsonResponse({}, false, 500)) as unknown as typeof fetch });
    expect((await f.call({ operation: 'sendForSignature', dealId: 'D', documentIds: [], context })).status).toBe('failed');
    const t = createRealAdapterShell('edo', { baseUrl: 'https://edo', apiKey: 'k', fetchImpl: (async () => { throw new Error('net'); }) as unknown as typeof fetch });
    expect((await t.call({ operation: 'sendForSignature', dealId: 'D', documentIds: [], context })).status).toBe('failed');
  });

  it('healthCheck reports the real shell as configured', async () => {
    const lab = createRealAdapterShell('lab', { baseUrl: 'https://lab', apiKey: 'k' });
    const health = await lab.healthCheck();
    expect(health.provider).toBe('real');
    expect(health.system).toBe('lab');
  });

  it('builds a registry from env: configured systems real, the rest mock', () => {
    const { registry, realSystems } = platformV7BuildAdapterRegistryFromEnv({
      FGIS_API_BASE_URL: 'https://fgis', FGIS_API_KEY: 'k',
      LAB_API_BASE_URL: 'https://lab', LAB_API_KEY: 'k',
    } as unknown as NodeJS.ProcessEnv);
    expect(realSystems.sort()).toEqual(['fgis', 'lab']);
    expect(registry.fgis.provider).toBe('real');
    expect(registry.lab.provider).toBe('real');
    expect(registry.bank.provider).toBe('mock');
    expect(registry.epd.provider).toBe('mock');
  });
});
