import { describe, it, expect, vi } from 'vitest';
import { HttpIntegrationClient, IntegrationHttpError, maskPii, type FetchLike } from './http-integration-client';

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  };
}

const noSleep = async () => {};

describe('HttpIntegrationClient', () => {
  it('sends auth + idempotency headers and parses JSON', async () => {
    const calls: Array<{ url: string; init: Parameters<FetchLike>[1] }> = [];
    const fetchImpl: FetchLike = async (url, init) => {
      calls.push({ url, init });
      return jsonResponse(200, { paymentId: 'PAY-1', status: 'ACCEPTED' });
    };
    const client = new HttpIntegrationClient({
      name: 'BANK',
      baseUrl: 'https://api.bank.example/v1',
      auth: async () => ({ authorization: 'Bearer tok-123' }),
      fetchImpl,
      sleep: noSleep,
      logger: { info() {}, warn() {}, error() {} },
    });

    const res = await client.request<{ paymentId: string }>({
      method: 'POST',
      path: '/payments',
      body: { amount: 100 },
      idempotencyKey: 'idem-1',
    });

    expect(res.paymentId).toBe('PAY-1');
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://api.bank.example/v1/payments');
    expect(calls[0].init.headers['authorization']).toBe('Bearer tok-123');
    expect(calls[0].init.headers['idempotency-key']).toBe('idem-1');
    expect(calls[0].init.headers['content-type']).toBe('application/json');
  });

  it('retries on 5xx then succeeds', async () => {
    let n = 0;
    const fetchImpl: FetchLike = async () => {
      n += 1;
      return n < 3 ? jsonResponse(503, { error: 'unavailable' }) : jsonResponse(200, { ok: true });
    };
    const client = new HttpIntegrationClient({
      name: 'FGIS',
      baseUrl: 'https://fgis.example',
      maxRetries: 3,
      fetchImpl,
      sleep: noSleep,
      logger: { info() {}, warn() {}, error() {} },
    });
    const res = await client.request<{ ok: boolean }>({ method: 'GET', path: '/status' });
    expect(res.ok).toBe(true);
    expect(n).toBe(3);
  });

  it('does not retry on 4xx and throws IntegrationHttpError', async () => {
    let n = 0;
    const fetchImpl: FetchLike = async () => {
      n += 1;
      return jsonResponse(400, { error: 'bad request' });
    };
    const client = new HttpIntegrationClient({
      name: 'FNS',
      baseUrl: 'https://fns.example',
      fetchImpl,
      sleep: noSleep,
      logger: { info() {}, warn() {}, error() {} },
    });
    await expect(client.request({ method: 'POST', path: '/check', body: {} })).rejects.toBeInstanceOf(IntegrationHttpError);
    expect(n).toBe(1);
  });

  it('gives up after maxRetries on persistent 5xx', async () => {
    const fetchImpl: FetchLike = async () => jsonResponse(500, { error: 'boom' });
    const client = new HttpIntegrationClient({
      name: 'GPS',
      baseUrl: 'https://gps.example',
      maxRetries: 2,
      fetchImpl,
      sleep: noSleep,
      logger: { info() {}, warn() {}, error() {} },
    });
    await expect(client.request({ method: 'GET', path: '/track' })).rejects.toMatchObject({
      options: { status: 500, retryable: true },
    });
  });

  it('reports healthCheck ok / down', async () => {
    const okClient = new HttpIntegrationClient({
      name: 'BANK',
      baseUrl: 'https://api.bank.example',
      fetchImpl: async () => jsonResponse(200, { status: 'ok' }),
      sleep: noSleep,
      logger: { info() {}, warn() {}, error() {} },
    });
    expect((await okClient.healthCheck()).status).toBe('ok');

    const downClient = new HttpIntegrationClient({
      name: 'BANK',
      baseUrl: 'https://api.bank.example',
      maxRetries: 0,
      fetchImpl: async () => jsonResponse(500, {}),
      sleep: noSleep,
      logger: { info() {}, warn() {}, error() {} },
    });
    expect((await downClient.healthCheck()).status).toBe('down');
  });

  it('masks PII in logged payloads', () => {
    const masked = maskPii({ inn: '7707083893', name: 'Иван', nested: { token: 'super-secret-token' } }) as {
      inn: string; name: string; nested: { token: string };
    };
    expect(masked.inn).not.toBe('7707083893');
    expect(masked.nested.token).not.toContain('super-secret-token');
    expect(masked.name).toBe('Иван');
  });
});
