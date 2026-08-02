import * as crypto from 'crypto';
import { GoneException } from '@nestjs/common';
import { IntegrationsService } from './integrations.service';
import { FGIS_LEGACY_ERROR_CODES } from '../regulatory-integration/fgis-grain/fgis-grain-legacy-quarantine';

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

  describe('handleFgisWebhook() — retired in P0.2-1A', () => {
    function denial(body: Record<string, unknown>) {
      try {
        svc.handleFgisWebhook(body);
      } catch (error) {
        return error as GoneException;
      }
      throw new Error('handleFgisWebhook must not return a success response');
    }

    it('refuses the JSON callback with 410 and a stable code', () => {
      const error = denial({ sdizId: 'SDIZ-123', dealId: 'D1', status: 'CONFIRMED' });
      expect(error).toBeInstanceOf(GoneException);
      expect(error.getStatus()).toBe(410);
      const body = error.getResponse() as Record<string, unknown>;
      expect(body.code).toBe(FGIS_LEGACY_ERROR_CODES.WEBHOOK_RETIRED);
      expect(body.stateChanged).toBe(false);
      expect(body.attestation).toBe('NOT_ATTESTED');
    });

    it('does not echo caller-supplied fields back', () => {
      // The old handler reflected sdizId/dealId/status. Echoing an unauthenticated
      // body makes attacker-chosen values look like recorded ФГИС state.
      const body = denial({
        sdizId: 'SDIZ-ATTACKER',
        dealId: 'DEAL-ATTACKER',
        status: 'CONFIRMED',
      }).getResponse() as Record<string, unknown>;
      expect(JSON.stringify(body)).not.toContain('SDIZ-ATTACKER');
      expect(JSON.stringify(body)).not.toContain('DEAL-ATTACKER');
      expect(body).not.toHaveProperty('received');
      expect(body).not.toHaveProperty('sdizId');
      expect(body).not.toHaveProperty('status');
    });

    it('issues a fresh correlation code per denial and leaks no secret', () => {
      const first = denial({}).getResponse() as { correlationCode: string };
      const second = denial({}).getResponse() as { correlationCode: string };
      expect(first.correlationCode).toMatch(/^FGIS-[0-9A-F]{8}$/);
      expect(second.correlationCode).not.toBe(first.correlationCode);
      expect(JSON.stringify(first)).not.toMatch(/secret|token|certificate|password/i);
    });
  });

  describe('pushFgis() — retired in P0.2-1A', () => {
    it('refuses without contacting any adapter or mutating the deal', () => {
      let thrown: GoneException | undefined;
      try {
        svc.pushFgis('DEAL-1', { sub: 'user-1', orgId: 'org-1' });
      } catch (error) {
        thrown = error as GoneException;
      }
      expect(thrown).toBeInstanceOf(GoneException);
      const body = thrown!.getResponse() as Record<string, unknown>;
      expect(body.code).toBe(FGIS_LEGACY_ERROR_CODES.PUSH_RETIRED);
      expect(body.stateChanged).toBe(false);
      // The old path answered MOCK_OK with an invented СДИЗ number.
      expect(JSON.stringify(body)).not.toContain('MOCK_OK');
      expect(body).not.toHaveProperty('sdizNumber');
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
