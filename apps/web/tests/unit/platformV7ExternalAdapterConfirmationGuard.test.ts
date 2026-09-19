import { describe, expect, it } from 'vitest';
import {
  platformV7CreateMockAdapter,
  type PlatformV7ExternalSystem,
} from '@/lib/platform-v7/external-adapters';

const systems = ['bank', 'fgis', 'edo', 'epd', 'logistics', 'lab', 'oneC', 'notification'] as const;

const ctx = {
  correlationId: 'corr-confirmation-guard',
  auditId: 'audit-confirmation-guard',
  actorId: 'operator-1',
  organizationId: 'org-1',
  role: 'operator',
};

async function callMockAdapter(system: PlatformV7ExternalSystem) {
  switch (system) {
    case 'bank':
      return platformV7CreateMockAdapter('bank').call({ operation: 'requestReserve', dealId: 'deal-1', amount: 1000, currency: 'RUB', context: ctx });
    case 'fgis':
      return platformV7CreateMockAdapter('fgis').call({ operation: 'createGrainBatchDraft', partyId: 'party-1', context: ctx });
    case 'edo':
      return platformV7CreateMockAdapter('edo').call({ operation: 'createDocumentPackage', dealId: 'deal-1', documentIds: ['doc-1'], context: ctx });
    case 'epd':
      return platformV7CreateMockAdapter('epd').call({ operation: 'createTransportDocument', tripId: 'trip-1', documentId: 'doc-1', context: ctx });
    case 'logistics':
      return platformV7CreateMockAdapter('logistics').call({ operation: 'createRoute', tripId: 'trip-1', context: ctx });
    case 'lab':
      return platformV7CreateMockAdapter('lab').call({ operation: 'createSample', sampleId: 'sample-1', context: ctx });
    case 'oneC':
      return platformV7CreateMockAdapter('oneC').call({ operation: 'exportDeal', entityId: 'deal-1', context: ctx });
    case 'notification':
      return platformV7CreateMockAdapter('notification').call({ operation: 'send', context: ctx });
  }
}

describe('platform-v7 external adapter confirmation guard', () => {
  it('keeps every mock adapter call from confirming external execution', async () => {
    for (const system of systems) {
      const result = await callMockAdapter(system);

      expect(result.provider, system).toBe('mock');
      expect(result.system, system).toBe(system);
      expect(result.doesNotConfirmExternally, system).toBe(true);
      expect(String(result.status), system).not.toBe('confirmed');
      expect(String(result.status), system).not.toBe('live');
      expect(String(result.status), system).not.toBe('integrated');
    }
  });
});
