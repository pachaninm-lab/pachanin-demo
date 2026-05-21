import { describe, expect, it } from 'vitest';
import {
  PLATFORM_V7_API_ENDPOINTS,
  platformV7ApiEndpoint,
  platformV7CriticalApiEndpoints,
  type PlatformV7ApiEventEnvelope,
  type PlatformV7ApiErrorEnvelope,
} from '@/lib/platform-v7/api-contracts';

describe('platform-v7 api contract foundation', () => {
  it('keeps endpoint method+path pairs unique and resolvable', () => {
    const keys = PLATFORM_V7_API_ENDPOINTS.map((endpoint) => `${endpoint.method} ${endpoint.path}`);

    expect(new Set(keys).size).toBe(keys.length);

    for (const endpoint of PLATFORM_V7_API_ENDPOINTS) {
      expect(platformV7ApiEndpoint(endpoint.method, endpoint.path)).toEqual(endpoint);
    }
  });

  it('requires actor context for every endpoint', () => {
    for (const endpoint of PLATFORM_V7_API_ENDPOINTS) {
      expect(endpoint.requiresActorContext).toBe(true);
      expect(endpoint.allowedRoles.length).toBeGreaterThan(0);
    }
  });

  it('requires idempotency and audit events for all critical endpoints', () => {
    const criticalEndpoints = platformV7CriticalApiEndpoints();

    expect(criticalEndpoints.length).toBeGreaterThan(0);

    for (const endpoint of criticalEndpoints) {
      expect(endpoint.requiresIdempotencyKey).toBe(true);
      expect(endpoint.emitsAuditEvent).toBe(true);
      expect(endpoint.method).toBe('POST');
    }
  });

  it('keeps money endpoints restricted and critical', () => {
    const reserve = platformV7ApiEndpoint('POST', '/api/deals/{id}/money/reserve');
    const release = platformV7ApiEndpoint('POST', '/api/deals/{id}/money/release-request');

    expect(reserve).toEqual(expect.objectContaining({ resource: 'money', criticality: 'critical', requiresIdempotencyKey: true }));
    expect(release).toEqual(expect.objectContaining({ resource: 'money', criticality: 'critical', requiresIdempotencyKey: true }));
    expect(reserve?.allowedRoles).toEqual(['operator', 'buyer']);
    expect(release?.allowedRoles).toEqual(['operator', 'seller', 'buyer']);
  });

  it('keeps driver limited to trip event writes at the API contract layer', () => {
    const driverWritable = PLATFORM_V7_API_ENDPOINTS.filter((endpoint) =>
      endpoint.method !== 'GET' && endpoint.allowedRoles.includes('driver')
    );

    expect(driverWritable).toEqual([
      expect.objectContaining({ method: 'POST', path: '/api/trips/{id}/events', resource: 'trips' }),
    ]);
  });

  it('keeps executive viewer out of mutating endpoints', () => {
    const executiveMutations = PLATFORM_V7_API_ENDPOINTS.filter((endpoint) =>
      endpoint.method !== 'GET' && endpoint.allowedRoles.includes('executiveViewer')
    );

    expect(executiveMutations).toEqual([]);
  });

  it('documents the required error envelope shape', () => {
    const envelope: PlatformV7ApiErrorEnvelope = {
      error: {
        code: 'DOCUMENT_BLOCKER',
        message: 'Выпуск денег заблокирован: отсутствует акт приёмки',
        details: { dealId: 'deal_123' },
        correlationId: 'corr_123',
      },
    };

    expect(envelope.error.code).toBe('DOCUMENT_BLOCKER');
    expect(envelope.error.correlationId).toBe('corr_123');
  });

  it('documents the required event envelope shape', () => {
    const envelope: PlatformV7ApiEventEnvelope<{ amount: number; currency: 'RUB' }> = {
      eventId: 'evt_123',
      eventType: 'money.release_requested',
      dealId: 'deal_123',
      actorId: 'user_123',
      actorRole: 'operator',
      occurredAt: '2026-05-21T12:00:00Z',
      payload: { amount: 12500000, currency: 'RUB' },
      correlationId: 'corr_123',
      auditId: 'audit_123',
    };

    expect(envelope.eventType).toBe('money.release_requested');
    expect(envelope.correlationId).toBe('corr_123');
    expect(envelope.auditId).toBe('audit_123');
  });
});
