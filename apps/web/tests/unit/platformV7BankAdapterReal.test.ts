import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createRealBankAdapter,
  platformV7RegisterRealBankAdapter,
  resolveBankAdapterRealConfig,
} from '@/lib/platform-v7/adapters/bank-adapter-real';
import {
  platformV7ClearRealAdapterRegistry,
  platformV7CreateAdapterRegistry,
  platformV7HasRealAdapterRegistry,
} from '@/lib/platform-v7/adapter-factory';
import type { PlatformV7ExternalCallContext } from '@/lib/platform-v7/external-adapters';

const context: PlatformV7ExternalCallContext = {
  correlationId: 'corr-bank-1',
  auditId: 'audit-bank-1',
  actorId: 'bank-officer-1',
  organizationId: 'bank-org-1',
  role: 'bank',
  idempotencyKey: 'idem-bank-1',
};

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as unknown as Response;
}

afterEach(() => {
  platformV7ClearRealAdapterRegistry();
  vi.restoreAllMocks();
});

describe('real bank adapter', () => {
  it('resolves config only when both base url and api key are present', () => {
    expect(resolveBankAdapterRealConfig({} as unknown as NodeJS.ProcessEnv)).toBeNull();
    expect(resolveBankAdapterRealConfig({ BANK_API_BASE_URL: 'https://b' } as unknown as NodeJS.ProcessEnv)).toBeNull();
    const cfg = resolveBankAdapterRealConfig({ BANK_API_BASE_URL: 'https://b', BANK_API_KEY: 'k' } as unknown as NodeJS.ProcessEnv);
    expect(cfg).toMatchObject({ baseUrl: 'https://b', apiKey: 'k' });
  });

  it('maps a reserve request to a POST with auth + idempotency headers and returns pending', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ id: 'ext-77' }));
    const adapter = createRealBankAdapter({ baseUrl: 'https://bank.example/', apiKey: 'secret', fetchImpl: fetchImpl as unknown as typeof fetch });

    const result = await adapter.call({ operation: 'requestReserve', dealId: 'DL-9106', amount: 9_648_000, currency: 'RUB', context });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://bank.example/escrow/reserve');
    expect(init.method).toBe('POST');
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer secret');
    expect(headers['Idempotency-Key']).toBe('idem-bank-1');
    expect(JSON.parse(String(init.body))).toMatchObject({ operation: 'requestReserve', dealId: 'DL-9106', amount: 9_648_000, currency: 'RUB' });

    expect(result.provider).toBe('real');
    expect(result.system).toBe('bank');
    expect(result.status).toBe('pending');
    expect(result.externalCallId).toBe('ext-77');
    expect(result.doesNotConfirmExternally).toBe(true);
  });

  it('routes a 4xx bank error to manual review, never to a confirmed movement', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ error: 'invalid' }, false, 422));
    const adapter = createRealBankAdapter({ baseUrl: 'https://bank.example', apiKey: 'k', fetchImpl: fetchImpl as unknown as typeof fetch });
    const result = await adapter.call({ operation: 'requestRelease', dealId: 'DL-9106', amount: 1, currency: 'RUB', context });
    expect(result.status).toBe('manual_review');
    expect(result.doesNotConfirmExternally).toBe(true);
  });

  it('routes a 5xx and a thrown network error to failed', async () => {
    const adapter5xx = createRealBankAdapter({ baseUrl: 'https://bank.example', apiKey: 'k', fetchImpl: (async () => jsonResponse({}, false, 503)) as unknown as typeof fetch });
    expect((await adapter5xx.call({ operation: 'requestRelease', dealId: 'D', context })).status).toBe('failed');

    const adapterThrow = createRealBankAdapter({ baseUrl: 'https://bank.example', apiKey: 'k', fetchImpl: (async () => { throw new Error('network down'); }) as unknown as typeof fetch });
    const thrown = await adapterThrow.call({ operation: 'requestRelease', dealId: 'D', context });
    expect(thrown.status).toBe('failed');
    expect(thrown.doesNotConfirmExternally).toBe(true);
  });

  it('does not register a real registry without credentials', () => {
    expect(platformV7RegisterRealBankAdapter({} as unknown as NodeJS.ProcessEnv)).toBe(false);
    expect(platformV7HasRealAdapterRegistry()).toBe(false);
  });

  it('registers a real registry with a real bank when credentials are present', () => {
    expect(platformV7RegisterRealBankAdapter({ BANK_API_BASE_URL: 'https://bank.example', BANK_API_KEY: 'k' } as unknown as NodeJS.ProcessEnv)).toBe(true);
    expect(platformV7HasRealAdapterRegistry()).toBe(true);

    const registry = platformV7CreateAdapterRegistry({ mode: 'real' });
    expect(registry.bank.provider).toBe('real');
    expect(registry.bank.system).toBe('bank');
  });
});
