import { describe, it, expect } from 'vitest';
import { HttpIntegrationClient, type FetchLike } from './http-integration-client';
import { LiveBankAdapter } from './live-bank.adapter';
import { LiveFgisZernoAdapter } from './live-fgis-zerno.adapter';
import { LiveDiadokAdapter } from './live-diadok.adapter';
import { LiveCryptoproAdapter } from './live-cryptopro.adapter';
import { LiveFnsAdapter } from './live-fns.adapter';
import { LiveFtsAdapter } from './live-fts.adapter';
import { LiveRshnAdapter } from './live-rshn.adapter';
import { LiveGpsAdapter } from './live-gps.adapter';
import { LiveAmlAdapter } from './live-aml.adapter';
import { LiveGisEpdAdapter } from './live-gis-epd.adapter';
import { LiveRzdEtranAdapter } from './live-rzd-etran.adapter';
import { LiveBkiAdapter } from './live-bki.adapter';
import { LiveTakskomAdapter } from './live-takskom.adapter';
import { LiveMarineAdapter } from './live-marine.adapter';
import { LiveSmevAdapter } from './live-smev.adapter';

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

describe('the remaining live adapters route to the shared client', () => {
  it('DIADOK sends a document with a deterministic idempotency key', async () => {
    const { http, calls } = recordingClient('DIADOK', () => ({ externalId: 'D-1', status: 'DELIVERED', sentAt: 'now' }));
    const res = await new LiveDiadokAdapter(http).sendDocument({
      type: 'UPD', senderInn: '111', receiverInn: '222', documentDate: '2026-01-01',
      documentNumber: 'UPD-7', content: 'base64', filename: 'upd.pdf',
    });
    expect(res.externalId).toBe('D-1');
    expect(calls[0].url).toBe('https://api.diadok.example/v1/documents');
    expect(calls[0].headers['idempotency-key']).toBe('diadok-send:111:222:UPD-7');
  });

  it('CRYPTOPRO signs with an idempotent hash+cert key', async () => {
    const { http, calls } = recordingClient('CRYPTOPRO', () => ({
      documentHash: 'H', signatureBase64: 'S', certificateId: 'C', signedAt: 'now', algorithm: 'GOST',
    }));
    await new LiveCryptoproAdapter(http).signDocument('H', 'C');
    expect(calls[0].url).toBe('https://api.cryptopro.example/v1/sign');
    expect(calls[0].headers['idempotency-key']).toBe('dss-sign:C:H');
  });

  it('FNS looks up an organization (GET, no idempotency)', async () => {
    const { http, calls } = recordingClient('FNS', () => ({ inn: '7707083893', name: 'ООО', status: 'ACTIVE' }));
    const org = await new LiveFnsAdapter(http).getOrganizationByInn('7707083893');
    expect(org?.status).toBe('ACTIVE');
    expect(calls[0].url).toBe('https://api.fns.example/v1/organizations/7707083893');
    expect(calls[0].method).toBe('GET');
    expect(calls[0].headers['idempotency-key']).toBeUndefined();
  });

  it('FTS submits a declaration with an idempotency key', async () => {
    const { http, calls } = recordingClient('FTS', () => ({ dtNumber: 'DT-1' }));
    const res = await new LiveFtsAdapter(http).submitDeclaration({
      goodsDescription: 'Пшеница', tnvedCode: '1001990000', totalValueRub: 5_000_000,
    });
    expect(res.dtNumber).toBe('DT-1');
    expect(calls[0].headers['idempotency-key']).toBe('fts-declare:1001990000:5000000');
  });

  it('RSHN applies for a certificate keyed on producer+culture+destination', async () => {
    const { http, calls } = recordingClient('RSHN', () => ({ id: 'RSHN-1' }));
    await new LiveRshnAdapter(http).applyForCertificate({
      culture: 'Пшеница', volumeTons: 500, producerInn: '7707083893', destinationCountry: 'EG',
    });
    expect(calls[0].headers['idempotency-key']).toBe('rshn-apply:7707083893:Пшеница:EG');
  });

  it('GPS updates a position keyed on vehicle+timestamp', async () => {
    const { http, calls } = recordingClient('GPS', () => ({}));
    await new LiveGpsAdapter(http).updatePosition('V-1', { lat: 1, lng: 2, timestamp: '2026-01-01T00:00:00Z' });
    expect(calls[0].url).toBe('https://api.gps.example/v1/vehicles/V-1/position');
    expect(calls[0].headers['idempotency-key']).toBe('gps-pos:V-1:2026-01-01T00:00:00Z');
  });

  it('AML execute() routes to entity screening', async () => {
    const { http, calls } = recordingClient('AML', () => ({
      cleared: true, riskLevel: 'LOW', matchedLists: [], screenedAt: 'now', referenceId: 'R-1',
    }));
    const res = await new LiveAmlAdapter(http).execute({ inn: '7707083893' });
    expect(res.cleared).toBe(true);
    expect(calls[0].url).toBe('https://api.aml.example/v1/screening/entity');
  });

  it('GIS_EPD creates an ЭТН keyed on deal+vehicle+date', async () => {
    const { http, calls } = recordingClient('GIS', () => ({ id: 'E-1', etnNumber: 'ЭТН-1', status: 'DRAFT' }));
    await new LiveGisEpdAdapter(http).createEtn({
      dealId: 'DL-1', shipper: { name: 'a', inn: '1', address: 'x' }, consignee: { name: 'b', inn: '2', address: 'y' },
      carrier: { name: 'c', inn: '3' }, vehicleNumber: 'A123AA', driverName: 'D', driverLicenseNumber: 'L',
      loadingAddress: 'L1', unloadingAddress: 'L2', cargoDescription: 'wheat', weightTons: 20,
      loadingDate: '2026-01-01', deliveryDatePlan: '2026-01-03',
    });
    expect(calls[0].headers['idempotency-key']).toBe('etn-create:DL-1:A123AA:2026-01-01');
  });

  it('RZD_ETRAN creates a waybill keyed on wagon+date', async () => {
    const { http, calls } = recordingClient('RZD', () => ({ waybillId: 'W-1', gu29Number: 'ГУ29-1', status: 'ACCEPTED', acceptedAt: 'now' }));
    await new LiveRzdEtranAdapter(http).createWaybill({
      wagonNumber: '5401', loadStationCode: '060400', destStationCode: '600000', senderId: '1', receiverId: '2',
      cargoCode: 'C', weightTons: 68, loadDate: '2026-01-01',
    });
    expect(calls[0].headers['idempotency-key']).toBe('etran-waybill:5401:2026-01-01');
  });

  it('BKI pulls a credit report (GET)', async () => {
    const { http, calls } = recordingClient('BKI', () => ({ inn: '7707083893', rating: 'B+', creditScore: 720 }));
    await new LiveBkiAdapter(http).getCreditReport('7707083893');
    expect(calls[0].url).toBe('https://api.bki.example/v1/credit-reports/7707083893');
    expect(calls[0].method).toBe('GET');
  });

  it('TAKSKOM sends a document carrying its operator', async () => {
    const { http, calls } = recordingClient('TAKSKOM', () => ({ id: 'T-1', externalId: 'T-1', status: 'SENT' }));
    await new LiveTakskomAdapter(http).sendDocument({
      type: 'UPD', senderInn: '111', recipientInn: '222', title: 'УПД', content: 'base64', dealId: 'DL-1',
    });
    expect((calls[0].body as { operator: string }).operator).toBe('TAKSKOM');
    expect(calls[0].headers['idempotency-key']).toBe('takskom-send:111:222:DL-1');
  });

  it('MARINE reads a vessel position (GET)', async () => {
    const { http, calls } = recordingClient('MARINE', () => ({ mmsi: '273210490', vesselName: 'X', status: 'AT_SEA' }));
    await new LiveMarineAdapter(http).getVesselPosition('273210490');
    expect(calls[0].url).toBe('https://api.marine.example/v1/vessels/273210490/position');
    expect(calls[0].method).toBe('GET');
  });

  it('SMEV sends a request keyed on service+inn', async () => {
    const { http, calls } = recordingClient('SMEV', () => ({ id: 'S-1', service: 'FNS_EGRUL', status: 'ACCEPTED', requestedAt: 'now', payload: {} }));
    await new LiveSmevAdapter(http).sendRequest('FNS_EGRUL', { inn: '7707083893' });
    expect(calls[0].url).toBe('https://api.smev.example/v1/requests');
    expect(calls[0].headers['idempotency-key']).toBe('smev-req:FNS_EGRUL:7707083893');
  });
});
