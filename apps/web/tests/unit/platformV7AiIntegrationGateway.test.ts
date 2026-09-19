import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { createMockGatewayProvider, MockGatewayProvider } from '@/lib/platform-v7/ai/gateway-mock-provider';
import { DisabledGatewayProvider, GATEWAY_MATURITY } from '@/lib/platform-v7/ai/gateway-provider-port';
import type { GatewayRequest } from '@/lib/platform-v7/ai/gateway-envelope';

function makeRequest(overrides: Partial<GatewayRequest> = {}): GatewayRequest {
  return {
    requestId: 'req-1',
    dealId: 'deal-1',
    role: 'operator',
    scope: 'hint',
    maturity: 'pre-integration',
    idempotencyKey: 'idem-1',
    inputSnapshot: { status: 'reserved', blockers: [] },
    ...overrides,
  };
}

describe('GatewayRequest / GatewayResponse envelope', () => {
  it('GATEWAY_MATURITY is pre-integration', () => {
    expect(GATEWAY_MATURITY).toBe('pre-integration');
  });
});

describe('MockGatewayProvider', () => {
  it('returns a non-null result string', async () => {
    const provider = createMockGatewayProvider();
    const response = await provider.execute(makeRequest());

    expect(typeof response.result).toBe('string');
    expect(response.result).not.toBeNull();
  });

  it('includes scope, role and dealId in the result', async () => {
    const provider = createMockGatewayProvider();
    const response = await provider.execute(makeRequest({ scope: 'blocker_explanation', role: 'bank', dealId: 'deal-42' }));

    expect(response.result).toContain('scope=blocker_explanation');
    expect(response.result).toContain('role=bank');
    expect(response.result).toContain('deal=deal-42');
  });

  it('returns confidence of 0.42', async () => {
    const provider = createMockGatewayProvider();
    const response = await provider.execute(makeRequest());

    expect(response.confidence).toBe(0.42);
  });

  it('includes all required pre-integration limitations', async () => {
    const provider = createMockGatewayProvider();
    const response = await provider.execute(makeRequest());

    expect(response.limitations.length).toBeGreaterThan(0);
    expect(response.limitations.some((l) => l.includes('pre-integration'))).toBe(true);
    expect(response.limitations.some((l) => l.includes('human review'))).toBe(true);
  });

  it('does not claim to override bank or document statuses', async () => {
    const provider = createMockGatewayProvider();
    const response = await provider.execute(makeRequest());

    const limitationsText = response.limitations.join(' ');
    expect(limitationsText).toContain('cannot override');
  });

  it('includes idempotencyKey in auditContext.executedAt', async () => {
    const provider = createMockGatewayProvider();
    const response = await provider.execute(makeRequest({ idempotencyKey: 'my-key-123' }));

    expect(response.auditContext.executedAt).toContain('my-key-123');
  });

  it('auditContext.providerId is mock-preintegration', async () => {
    const provider = createMockGatewayProvider();
    const response = await provider.execute(makeRequest());

    expect(response.auditContext.providerId).toBe('mock-preintegration');
  });

  it('produces deterministic result for identical snapshots', async () => {
    const provider = createMockGatewayProvider();
    const req = makeRequest({ inputSnapshot: { amount: 1000, status: 'reserved' } });
    const first = await provider.execute(req);
    const second = await provider.execute(req);

    expect(first.result).toBe(second.result);
  });

  it('produces different results for different snapshots', async () => {
    const provider = createMockGatewayProvider();
    const reqA = makeRequest({ inputSnapshot: { status: 'reserved' } });
    const reqB = makeRequest({ inputSnapshot: { status: 'released' } });
    const responseA = await provider.execute(reqA);
    const responseB = await provider.execute(reqB);

    expect(responseA.result).not.toBe(responseB.result);
  });

  it('covers all 6 GatewayScope values', async () => {
    const provider = createMockGatewayProvider();
    const scopes = ['hint', 'summary', 'blocker_explanation', 'next_action', 'evidence_summary', 'triage'] as const;
    for (const scope of scopes) {
      const response = await provider.execute(makeRequest({ scope }));
      expect(response.result, scope).toContain(`scope=${scope}`);
    }
  });

  it('maturity field is pre-integration', () => {
    const provider = new MockGatewayProvider();
    expect(provider.maturity).toBe('pre-integration');
  });
});

describe('DisabledGatewayProvider', () => {
  it('returns null result', async () => {
    const provider = new DisabledGatewayProvider();
    const response = await provider.execute(makeRequest());

    expect(response.result).toBeNull();
  });

  it('returns confidence of 0', async () => {
    const provider = new DisabledGatewayProvider();
    const response = await provider.execute(makeRequest());

    expect(response.confidence).toBe(0);
  });

  it('limitations describe unconfigured provider', async () => {
    const provider = new DisabledGatewayProvider();
    const response = await provider.execute(makeRequest());

    expect(response.limitations.length).toBeGreaterThan(0);
    expect(response.limitations[0]).toContain('provider not configured');
  });

  it('auditContext.providerId is disabled', async () => {
    const provider = new DisabledGatewayProvider();
    const response = await provider.execute(makeRequest());

    expect(response.auditContext.providerId).toBe('disabled');
  });

  it('maturity field is pre-integration', () => {
    const provider = new DisabledGatewayProvider();
    expect(provider.maturity).toBe('pre-integration');
  });
});

describe('source guard: AI gateway files are pre-integration with no live calls', () => {
  const gatewayFiles = [
    'lib/platform-v7/ai/gateway-envelope.ts',
    'lib/platform-v7/ai/gateway-provider-port.ts',
    'lib/platform-v7/ai/gateway-mock-provider.ts',
  ] as const;

  const forbiddenPatterns = [
    'fetch(',
    'XMLHttpRequest',
    'WebSocket',
    'EventSource',
    'axios.',
    'openai',
    'anthropic',
    'http.request',
    'https.request',
  ] as const;

  it('all AI gateway source files are present', () => {
    for (const file of gatewayFiles) {
      expect(existsSync(join(process.cwd(), file)), file).toBe(true);
    }
  });

  it('contains no live network calls or live AI API references', () => {
    for (const file of gatewayFiles) {
      const source = readFileSync(join(process.cwd(), file), 'utf8');
      for (const pattern of forbiddenPatterns) {
        expect(source, `${file} must not contain "${pattern}"`).not.toContain(pattern);
      }
    }
  });

  it('all gateway files declare pre-integration maturity', () => {
    for (const file of gatewayFiles) {
      const source = readFileSync(join(process.cwd(), file), 'utf8');
      expect(source, file).toContain('pre-integration');
    }
  });
});
