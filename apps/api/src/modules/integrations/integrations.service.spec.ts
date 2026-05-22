import * as crypto from 'crypto';
import { IntegrationsService } from './integrations.service';

function makeRuntime() {
  return {
    integrationHealth: jest.fn().mockReturnValue({ status: 'OK', connectors: [] }),
    appendGpsHeartbeat: jest.fn().mockReturnValue({ lat: 55.75, lng: 37.61 }),
    reservePrepayment: jest.fn().mockReturnValue({ status: 'RESERVE_PENDING' }),
  } as any;
}

describe('IntegrationsService', () => {
  let svc: IntegrationsService;

  beforeEach(() => {
    svc = new IntegrationsService(makeRuntime());
  });

  describe('handleFgisWebhook()', () => {
    it('returns received:true with echoed fields', () => {
      const result = svc.handleFgisWebhook({
        sdizId: 'SDIZ-123',
        dealId: 'D1',
        status: 'CONFIRMED',
        confirmedAt: '2026-05-20T10:00:00Z',
      });
      expect(result.received).toBe(true);
      expect(result.sdizId).toBe('SDIZ-123');
      expect(result.status).toBe('CONFIRMED');
      expect(result.confirmedAt).toBe('2026-05-20T10:00:00Z');
    });

    it('fills confirmedAt when not provided', () => {
      const result = svc.handleFgisWebhook({ sdizId: 'S1', dealId: 'D1', status: 'REJECTED' });
      expect(result.confirmedAt).toBeDefined();
      expect(new Date(result.confirmedAt).getFullYear()).toBeGreaterThanOrEqual(2026);
    });
  });

  describe('handleEdoWebhook()', () => {
    it('returns received:true with echoed fields', () => {
      const result = svc.handleEdoWebhook({
        documentId: 'DOC-1',
        dealId: 'D1',
        signingStatus: 'SIGNED',
      });
      expect(result.received).toBe(true);
      expect(result.documentId).toBe('DOC-1');
      expect(result.signingStatus).toBe('SIGNED');
    });
  });

  describe('gpsHeartbeat()', () => {
    it('delegates to runtime and returns GPS status', () => {
      const runtime = makeRuntime();
      const service = new IntegrationsService(runtime);
      const result = service.gpsHeartbeat('SHIP-1', { id: 'u1', role: 'DRIVER' });
      expect(result.connector).toBe('GPS');
      expect(result.status).toBe('LIVE_SIMULATED');
      expect(runtime.appendGpsHeartbeat).toHaveBeenCalledWith('SHIP-1', { id: 'u1', role: 'DRIVER' });
    });
  });
});

describe('HMAC verification helpers', () => {
  const secret = 'test-secret';

  function computeSig(body: object, prefix: string) {
    return prefix + crypto.createHmac('sha256', secret).update(JSON.stringify(body)).digest('hex');
  }

  it('produces consistent HMAC for same body', () => {
    const body = { dealId: 'D1', status: 'SUCCESS' };
    const sig1 = computeSig(body, 'hmac-sha256=');
    const sig2 = computeSig(body, 'hmac-sha256=');
    expect(sig1).toBe(sig2);
  });

  it('produces different HMAC for different bodies', () => {
    const sig1 = computeSig({ dealId: 'D1', status: 'SUCCESS' }, 'hmac-sha256=');
    const sig2 = computeSig({ dealId: 'D1', status: 'FAILED' }, 'hmac-sha256=');
    expect(sig1).not.toBe(sig2);
  });

  it('timing-safe comparison works for equal values', () => {
    const a = 'hmac-sha256=abc123';
    const b = 'hmac-sha256=abc123';
    expect(crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))).toBe(true);
  });

  it('timing-safe comparison returns false for unequal values', () => {
    const a = 'hmac-sha256=abc123';
    const b = 'hmac-sha256=xyz999';
    expect(crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))).toBe(false);
  });
});
