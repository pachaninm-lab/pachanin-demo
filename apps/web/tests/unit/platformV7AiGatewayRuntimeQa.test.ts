import { describe, expect, it } from 'vitest';
import {
  DisabledGatewayProvider,
  GATEWAY_MATURITY,
  type GatewayProviderPort,
} from '../../lib/platform-v7/ai/gateway-provider-port';
import { createMockGatewayProvider } from '../../lib/platform-v7/ai/gateway-mock-provider';
import type { GatewayRequest } from '../../lib/platform-v7/ai/gateway-envelope';

const makeRequest = (overrides: Partial<GatewayRequest> = {}): GatewayRequest => ({
  requestId: 'req-runtime-001',
  dealId: 'deal-runtime-001',
  role: 'operator',
  scope: 'summary',
  maturity: 'pre-integration',
  idempotencyKey: 'idem-runtime-001',
  inputSnapshot: { blocker: 'manual_review', amount: 2500 },
  ...overrides,
});

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

const providers: readonly [string, GatewayProviderPort][] = [
  ['disabled', new DisabledGatewayProvider()],
  ['mock', createMockGatewayProvider()],
];

describe('platform-v7 AI gateway runtime QA', () => {
  it('keeps gateway maturity pre-integration', () => {
    expect(GATEWAY_MATURITY).toBe('pre-integration');
  });

  it('providers satisfy the same port contract', async () => {
    for (const [name, provider] of providers) {
      const res = await provider.execute(makeRequest({ idempotencyKey: `idem-${name}` }));

      expect(res).toHaveProperty('result');
      expect(res).toHaveProperty('confidence');
      expect(res).toHaveProperty('limitations');
      expect(res).toHaveProperty('auditContext');
      expect(Array.isArray(res.limitations)).toBe(true);
      expect(res.confidence).toBeGreaterThanOrEqual(0);
      expect(res.confidence).toBeLessThanOrEqual(1);
      expect(res.auditContext.providerId.length).toBeGreaterThan(0);
      expect(res.auditContext.executedAt.length).toBeGreaterThan(0);
    }
  });

  it('disabled provider returns no generated result', async () => {
    const res = await new DisabledGatewayProvider().execute(makeRequest());

    expect(res.result).toBeNull();
    expect(res.confidence).toBe(0);
    expect(res.auditContext.providerId).toBe('disabled');
  });

  it('mock provider is deterministic for the same request', async () => {
    const provider = createMockGatewayProvider();
    const req = makeRequest({ inputSnapshot: { z: 2, a: 1 } });

    await expect(provider.execute(req)).resolves.toEqual(await provider.execute(req));
  });

  it('does not expose forbidden claims through provider outputs', async () => {
    for (const [, provider] of providers) {
      const res = await provider.execute(makeRequest());
      const output = [res.result, ...res.limitations, res.auditContext.providerId].join(' ');

      for (const claim of forbiddenClaims) {
        expect(output).not.toContain(claim);
      }
    }
  });

  it('does not expose network or credential markers through providers', async () => {
    for (const [, provider] of providers) {
      const source = provider.execute.toString();

      expect(source).not.toContain('fetch(');
      expect(source).not.toContain('XMLHttpRequest');
      expect(source).not.toContain('WebSocket');
      expect(source).not.toContain('EventSource');
      expect(source).not.toContain('apiKey');
      expect(source).not.toContain('token');
    }
  });
});
