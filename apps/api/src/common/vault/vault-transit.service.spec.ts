import { VaultTransitService } from './vault-transit.service';

/**
 * Каждый вызов Transit должен быть ограничен по времени.
 *
 * Проверяется поведение, а не наличие строки в исходнике: тест подменяет fetch,
 * читает переданный AbortSignal и убеждается, что он действительно прерывается,
 * а не просто присутствует в объекте параметров.
 */
describe('VaultTransitService outbound bounding', () => {
  const originalFetch = global.fetch;
  const originalAddr = process.env.VAULT_ADDR;

  beforeEach(() => {
    process.env.VAULT_ADDR = 'http://vault.test:8200';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalAddr === undefined) delete process.env.VAULT_ADDR;
    else process.env.VAULT_ADDR = originalAddr;
    jest.useRealTimers();
  });

  function captureSignal(payload: unknown) {
    const seen: { signal?: AbortSignal } = {};
    global.fetch = jest.fn(async (_input: unknown, init?: RequestInit) => {
      seen.signal = init?.signal ?? undefined;
      return { ok: true, status: 200, json: async () => payload } as unknown as Response;
    }) as unknown as typeof fetch;
    return seen;
  }

  it('bounds the encrypt call with a signal that actually aborts', async () => {
    const seen = captureSignal({ data: { ciphertext: 'vault:v1:abc' } });

    const service = new VaultTransitService();
    await expect(service.encrypt('персональные данные')).resolves.toBe('vault:v1:abc');

    expect(seen.signal).toBeInstanceOf(AbortSignal);
    expect(seen.signal!.aborted).toBe(false);

    // A signal that never fires is not a bound. Wait for the real timeout to elapse.
    await new Promise<void>((resolve) => {
      if (seen.signal!.aborted) {
        resolve();
        return;
      }
      seen.signal!.addEventListener('abort', () => resolve(), { once: true });
    });
    expect(seen.signal!.aborted).toBe(true);
  }, 15_000);

  it('bounds the decrypt call as well, so neither direction can hang', async () => {
    const plaintext = Buffer.from('персональные данные', 'utf-8').toString('base64');
    const seen = captureSignal({ data: { plaintext } });

    const service = new VaultTransitService();
    await expect(service.decrypt('vault:v1:abc')).resolves.toBe('персональные данные');

    expect(seen.signal).toBeInstanceOf(AbortSignal);
  });

  it('propagates an aborted request as a failure instead of resolving', async () => {
    global.fetch = jest.fn(async () => {
      throw Object.assign(new Error('The operation was aborted'), { name: 'TimeoutError' });
    }) as unknown as typeof fetch;

    const service = new VaultTransitService();
    await expect(service.encrypt('персональные данные')).rejects.toThrow(/aborted/iu);
  });

  it('keeps the development stub path free of any outbound call', async () => {
    delete process.env.VAULT_ADDR;
    global.fetch = jest.fn(() => {
      throw new Error('development stub must not call Vault');
    }) as unknown as typeof fetch;

    const service = new VaultTransitService();
    const sealed = await service.encrypt('персональные данные');
    expect(sealed.startsWith('stub:')).toBe(true);
    expect(await service.decrypt(sealed)).toBe('персональные данные');
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
