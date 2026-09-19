import { describe, it, expect } from 'vitest';
import {
  DisabledGatewayProvider,
  GATEWAY_MATURITY,
} from '../../lib/platform-v7/ai/gateway-provider-port';
import type { GatewayRequest } from '../../lib/platform-v7/ai/gateway-envelope';

const makeRequest = (overrides: Partial<GatewayRequest> = {}): GatewayRequest => ({
  requestId: 'req-001',
  dealId: 'deal-001',
  role: 'operator',
  scope: 'hint',
  maturity: 'pre-integration',
  idempotencyKey: 'idem-001',
  inputSnapshot: {},
  ...overrides,
});

describe('DisabledGatewayProvider', () => {
  const provider = new DisabledGatewayProvider();

  it('resolves without throwing', async () => {
    await expect(provider.execute(makeRequest())).resolves.toBeDefined();
  });

  it('returns result: null', async () => {
    const res = await provider.execute(makeRequest());
    expect(res.result).toBeNull();
  });

  it('returns confidence: 0', async () => {
    const res = await provider.execute(makeRequest());
    expect(res.confidence).toBe(0);
  });

  it('returns non-empty limitations array', async () => {
    const res = await provider.execute(makeRequest());
    expect(res.limitations.length).toBeGreaterThan(0);
  });

  it('returns auditContext.providerId === "disabled"', async () => {
    const res = await provider.execute(makeRequest());
    expect(res.auditContext.providerId).toBe('disabled');
  });

  it('returns auditContext.executedAt as valid ISO string', async () => {
    const res = await provider.execute(makeRequest());
    expect(() => new Date(res.auditContext.executedAt).toISOString()).not.toThrow();
  });

  it('maturity field equals "pre-integration"', () => {
    expect(provider.maturity).toBe('pre-integration');
  });

  it('GATEWAY_MATURITY equals "pre-integration"', () => {
    expect(GATEWAY_MATURITY).toBe('pre-integration');
  });

  it('does not throw on any valid scope', async () => {
    const scopes = [
      'hint',
      'summary',
      'blocker_explanation',
      'next_action',
      'evidence_summary',
      'triage',
    ] as const;
    for (const scope of scopes) {
      await expect(provider.execute(makeRequest({ scope }))).resolves.toBeDefined();
    }
  });

  it('response shape is stable across calls', async () => {
    const res1 = await provider.execute(makeRequest({ idempotencyKey: 'k1' }));
    const res2 = await provider.execute(makeRequest({ idempotencyKey: 'k2' }));
    expect(res1.result).toBe(res2.result);
    expect(res1.confidence).toBe(res2.confidence);
    expect(res1.limitations).toEqual(res2.limitations);
    expect(res1.auditContext.providerId).toBe(res2.auditContext.providerId);
  });
});

describe('forbidden claims', () => {
  it('GATEWAY_MATURITY does not contain forbidden claims', () => {
    const forbidden = [
      'production-ready',
      'fully live',
      'fully integrated',
      'AI makes binding decisions',
      'AI gateway is live',
    ];
    for (const claim of forbidden) {
      expect(GATEWAY_MATURITY).not.toContain(claim);
    }
  });
});
