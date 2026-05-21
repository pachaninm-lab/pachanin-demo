import { describe, expect, it } from 'vitest';
import {
  platformV7CreateMockAdapter,
  platformV7CreateMockAdapterRegistry,
  type PlatformV7ExternalCallContext,
  type PlatformV7ExternalSystem,
} from '@/lib/platform-v7/external-adapters';

const context: PlatformV7ExternalCallContext = {
  correlationId: 'corr-1',
  auditId: 'audit-1',
  actorId: 'user-1',
  organizationId: 'org-1',
  role: 'operator',
  idempotencyKey: 'idem-1',
};

const systems: PlatformV7ExternalSystem[] = ['bank', 'fgis', 'edo', 'epd', 'logistics', 'lab', 'oneC', 'notification'];

describe('platform-v7 external adapter contracts', () => {
  it('creates a complete mock adapter registry', () => {
    const registry = platformV7CreateMockAdapterRegistry();

    expect(Object.keys(registry).sort()).toEqual([...systems].sort());

    for (const system of systems) {
      expect(registry[system].provider).toBe('mock');
      expect(registry[system].system).toBe(system);
    }
  });

  it('keeps mock adapter calls pending and non-confirming externally', async () => {
    const adapter = platformV7CreateMockAdapter('bank');
    const result = await adapter.call({
      operation: 'requestReserve',
      dealId: 'deal-1',
      amount: 1000,
      currency: 'RUB',
      context,
    });

    expect(result).toEqual(expect.objectContaining({
      provider: 'mock',
      system: 'bank',
      status: 'pending',
      correlationId: 'corr-1',
      auditId: 'audit-1',
      doesNotConfirmExternally: true,
    }));
  });

  it('returns stable adapter health without live claims', async () => {
    const adapter = platformV7CreateMockAdapter('fgis');
    const health = await adapter.healthCheck();

    expect(health).toEqual(expect.objectContaining({
      provider: 'mock',
      system: 'fgis',
      status: 'available',
    }));
    expect(health.message?.toLowerCase()).not.toContain('live');
    expect(health.message?.toLowerCase()).not.toContain('production-ready');
  });

  it('keeps each adapter result tied to correlation and audit ids', async () => {
    const registry = platformV7CreateMockAdapterRegistry();

    const bankResult = await registry.bank.call({ operation: 'requestRelease', dealId: 'deal-1', context });
    const fgisResult = await registry.fgis.call({ operation: 'getSdizStatus', sdizId: 'sdiz-1', context });
    const edoResult = await registry.edo.call({ operation: 'sendForSignature', dealId: 'deal-1', documentIds: ['doc-1'], context });
    const epdResult = await registry.epd.call({ operation: 'sendTransportDocument', tripId: 'trip-1', documentId: 'doc-2', context });
    const logisticsResult = await registry.logistics.call({ operation: 'receiveGpsPoint', tripId: 'trip-1', context });
    const labResult = await registry.lab.call({ operation: 'submitProtocol', protocolId: 'proto-1', context });
    const oneCResult = await registry.oneC.call({ operation: 'exportDeal', entityId: 'deal-1', context });

    for (const result of [bankResult, fgisResult, edoResult, epdResult, logisticsResult, labResult, oneCResult]) {
      expect(result.correlationId).toBe(context.correlationId);
      expect(result.auditId).toBe(context.auditId);
      expect(result.doesNotConfirmExternally).toBe(true);
    }
  });
});
