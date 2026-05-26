import { describe, expect, it } from 'vitest';
import { createMockGatewayProvider, MockGatewayProvider } from '../../lib/platform-v7/ai/gateway-mock-provider';
import type { GatewayRequest, GatewayScope } from '../../lib/platform-v7/ai/gateway-envelope';

const makeRequest = (overrides: Partial<GatewayRequest> = {}): GatewayRequest => ({
  requestId: 'req-001',
  dealId: 'deal-001',
  role: 'operator',
  scope: 'hint',
  maturity: 'pre-integration',
  idempotencyKey: 'idem-001',
  inputSnapshot: { blocker: 'documents', amount: 1000 },
  ...overrides,
});

const scopes: readonly GatewayScope[] = [
  'hint',
  'summary',
  'blocker_explanation',
  'next_action',
  'evidence_summary',
  'triage',
] as const;

const forbiddenClaims = [
  'production-ready',
  'fully live',
  'fully integrated',
  'AI makes binding decisions',
  'AI gateway is live',
  'platform guarantees payment',
  'platform releases money',
  'платформа гарантирует оплату',
  'платформа сама выпускает деньги',
  'банк подключён',
  'ФГИС подключён',
  'ЭДО подключён',
];

describe('MockGatewayProvider', () => {
  it('creates a provider through the factory', () => {
    expect(createMockGatewayProvider()).toBeInstanceOf(MockGatewayProvider);
  });

  it('keeps maturity pre-integration', () => {
    expect(createMockGatewayProvider().maturity).toBe('pre-integration');
  });

  it('resolves every allowed scope', async () => {
    const provider = createMockGatewayProvider();

    for (const scope of scopes) {
      const res = await provider.execute(makeRequest({ scope }));
      expect(res.result).toContain(`scope=${scope}`);
      expect(res.limitations.length).toBeGreaterThan(0);
    }
  });

  it('is deterministic for the same request', async () => {
    const provider = createMockGatewayProvider();
    const req = makeRequest({ inputSnapshot: { z: 2, a: 1 } });

    await expect(provider.execute(req)).resolves.toEqual(await provider.execute(req));
  });

  it('keeps confidence bounded', async () => {
    const res = await createMockGatewayProvider().execute(makeRequest());

    expect(res.confidence).toBeGreaterThanOrEqual(0);
    expect(res.confidence).toBeLessThanOrEqual(1);
  });

  it('returns stable audit context without live provider identity', async () => {
    const res = await createMockGatewayProvider().execute(makeRequest());

    expect(res.auditContext.providerId).toBe('mock-preintegration');
    expect(res.auditContext.executedAt).toBe('mock:idem-001');
  });

  it('states human review and no external action limits', async () => {
    const res = await createMockGatewayProvider().execute(makeRequest());
    const text = res.limitations.join(' ');

    expect(text).toContain('human review');
    expect(text).toContain('does not make binding decisions');
    expect(text).toContain('does not');
  });

  it('does not expose forbidden claims in output', async () => {
    const provider = createMockGatewayProvider();
    const res = await provider.execute(makeRequest());
    const output = [res.result, ...res.limitations, res.auditContext.providerId].join(' ');

    for (const claim of forbiddenClaims) {
      expect(output).not.toContain(claim);
    }
  });

  it('does not use network APIs', async () => {
    const source = await import('../../lib/platform-v7/ai/gateway-mock-provider');
    const text = JSON.stringify(source);

    expect(text).not.toContain('fetch(');
    expect(text).not.toContain('XMLHttpRequest');
    expect(text).not.toContain('WebSocket');
    expect(text).not.toContain('EventSource');
  });
});
