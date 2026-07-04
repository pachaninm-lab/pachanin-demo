import { describe, it, expect } from 'vitest';
import { HttpIntegrationClient, type FetchLike } from './http-integration-client';
import { LiveBankAdapter } from './live-bank.adapter';
import { LiveFgisZernoAdapter } from './live-fgis-zerno.adapter';

interface Recorded {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: unknown;
}

function recordingClient(name: string, responder: (r: Recorded) => unknown) {
  const calls: Recorded[] = [];
  const fetchImpl: FetchLike = async (url, init) => {
    const rec: Recorded = {
      url,
      method: init.method,
      headers: init.headers,
      body: init.body ? JSON.parse(init.body) : undefined,
    };
    calls.push(rec);
    return { ok: true, status: 200, text: async () => JSON.stringify(responder(rec) ?? {}) };
  };
  const http = new HttpIntegrationClient({
    name,
    baseUrl: `https://api.${name.toLowerCase()}.example/v1`,
    auth: async () => ({ authorization: 'Bearer T' }),
    fetchImpl,
    sleep: async () => {},
    logger: { info() {}, warn() {}, error() {} },
  });
  return { http, calls };
}

describe('LiveBankAdapter', () => {
  it('opens escrow with an idempotency key and maps the response', async () => {
    const { http, calls } = recordingClient('BANK', () => ({
      accountNumber: '40702810XXXX',
      dealId: 'DL-9106',
      sellerInn: '1',
      buyerInn: '2',
      amountKopecks: 9648000_00,
      currency: 'RUB',
      conditions: ['docs_complete'],
      createdAt: '2026-01-01T00:00:00Z',
      status: 'OPEN',
    }));
    const bank = new LiveBankAdapter(http);
    const escrow = await bank.createEscrow({
      dealId: 'DL-9106',
      sellerInn: '1',
      buyerInn: '2',
      amountKopecks: 9648000_00,
      currency: 'RUB',
      conditions: ['docs_complete'],
    });
    expect(escrow.accountNumber).toBe('40702810XXXX');
    expect(escrow.status).toBe('OPEN');
    expect(calls[0].url).toBe('https://api.bank.example/v1/escrow');
    expect(calls[0].method).toBe('POST');
    expect(calls[0].headers['idempotency-key']).toBe('escrow:DL-9106');
    expect(calls[0].headers['authorization']).toBe('Bearer T');
  });

  it('sends a payment with a deterministic deal+reference idempotency key', async () => {
    const { http, calls } = recordingClient('BANK', () => ({ paymentId: 'PAY-9', status: 'ACCEPTED' }));
    const bank = new LiveBankAdapter(http);
    const res = await bank.sendPayment({
      dealId: 'DL-9106',
      fromAccount: 'A',
      toAccount: 'B',
      amountKopecks: 100,
      currency: 'RUB',
      purpose: 'Оплата по сделке DL-9106',
      reference: 'REF-1',
    });
    expect(res).toEqual({ paymentId: 'PAY-9', status: 'ACCEPTED' });
    expect(calls[0].headers['idempotency-key']).toBe('payment:DL-9106:REF-1');
  });

  it('release/refund hit the right escrow sub-paths', async () => {
    const { http, calls } = recordingClient('BANK', () => ({}));
    const bank = new LiveBankAdapter(http);
    await bank.releaseEscrow('ACC1', ['quality_ok']);
    await bank.refundEscrow('ACC1', 'dispute');
    expect(calls[0].url).toBe('https://api.bank.example/v1/escrow/ACC1/release');
    expect(calls[1].url).toBe('https://api.bank.example/v1/escrow/ACC1/refund');
  });
});

describe('LiveFgisZernoAdapter', () => {
  it('registers a lot and reads status via the client', async () => {
    const { http, calls } = recordingClient('FGIS', (r) =>
      r.method === 'POST' ? { fgisLotId: 'FGIS-1' } : { fgisLotId: 'FGIS-1', status: 'REGISTERED', updatedAt: 'now' },
    );
    const fgis = new LiveFgisZernoAdapter(http);
    const reg = await fgis.registerLot({
      id: 'LOT-2403',
      culture: 'wheat',
      cropClass: '4',
      volumeTons: 600,
      producerInn: '7707083893',
      regionCode: '61',
      gost: 'ГОСТ 9353-2016',
    });
    expect(reg.fgisLotId).toBe('FGIS-1');
    expect(calls[0].headers['idempotency-key']).toBe('fgis-lot:LOT-2403');

    const status = await fgis.getLotStatus('FGIS-1');
    expect(status.status).toBe('REGISTERED');
    expect(calls[1].url).toBe('https://api.fgis.example/v1/lots/FGIS-1/status');
    expect(calls[1].method).toBe('GET');
  });
});
