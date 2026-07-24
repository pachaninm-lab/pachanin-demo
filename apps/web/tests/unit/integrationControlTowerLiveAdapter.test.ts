import {
  collectIntegrationControlTowerPages,
  parseIntegrationControlTowerPage,
  parseIntegrationControlTowerRecord,
} from '../../components/crop-platform/integration-control-tower-live-adapter';

function record(overrides: Record<string, unknown> = {}) {
  return {
    adapterCode: 'FGIS_ZERNO', adapterVersion: '1.0.0', provider: 'fgis-zerno',
    capabilities: ['INBOUND_EVENTS'], environment: 'PRODUCTION', honestStatus: 'ADAPTER_READY',
    schemaVersion: 'v1', mappingVersion: 'm1', freshnessAt: '2026-07-24T07:00:00.000Z',
    lastSuccessAt: null, lastErrorAt: null, lastErrorCode: null, inboxDepth: 0,
    oldestEventAt: null, retryCount: 0, quarantineCount: 0, deadCount: 0,
    processingCount: 0, conflictCount: 0, providerAcknowledgedCount: 0, businessAcceptedCount: 0,
    reconciliationState: 'NOT_REQUESTED', reconciliationUpdatedAt: null,
    credentialReferenceExpiresAt: null, credentialMetadataAvailable: false, aggregateVersion: '0',
    primaryAction: {
      id: 'RECONCILE', allowed: false, reasonCode: 'JIT_AUTHORITY_REQUIRED',
      requiresConfirmation: true, owner: 'OPERATOR', impact: 'HIGH', entryId: null,
    },
    ...overrides,
  };
}

describe('Integration Control Tower strict live adapter', () => {
  it('parses a complete server record without adding local authority', () => {
    const parsed = parseIntegrationControlTowerRecord(record(), 'ru');
    expect(parsed).toMatchObject({
      adapterCode: 'FGIS_ZERNO', honestStatus: 'ADAPTER_READY',
      credentialReferenceExpiresAt: null, credentialMetadataAvailable: false,
      primaryAction: { id: 'RECONCILE', allowed: false },
    });
    expect(parsed?.recentEvents).toEqual([]);
  });

  it('rejects missing evidence-boundary and version fields', () => {
    const invalid = record();
    delete invalid.aggregateVersion;
    expect(parseIntegrationControlTowerRecord(invalid, 'ru')).toBeNull();
    expect(parseIntegrationControlTowerRecord(record({ credentialMetadataAvailable: true }), 'ru')).toBeNull();
    expect(parseIntegrationControlTowerRecord(record({ credentialReferenceExpiresAt: '2026-08-01T00:00:00Z' }), 'ru')).toBeNull();
  });

  it('does not silently promote ADAPTER_READY to CONFIRMED_LIVE', () => {
    expect(parseIntegrationControlTowerRecord(record(), 'en')?.honestStatus).toBe('ADAPTER_READY');
  });

  it('rejects malformed recent events and unsafe numeric values', () => {
    expect(parseIntegrationControlTowerRecord(record({ inboxDepth: -1 }), 'ru')).toBeNull();
    expect(parseIntegrationControlTowerRecord(record({
      recentEvents: [{ id: 'entry-1', state: 'PROCESSED' }],
    }), 'ru')).toBeNull();
  });

  it('parses bounded page envelopes and rejects invalid cursor contracts', () => {
    expect(parseIntegrationControlTowerPage({ items: [record()], nextCursor: null }, 'ru')?.items).toHaveLength(1);
    expect(parseIntegrationControlTowerPage({ items: [record()], nextCursor: 42 }, 'ru')).toBeNull();
  });

  it('rejects cursor loops and divergent duplicate adapters', async () => {
    const loop = await collectIntegrationControlTowerPages(async () => ({ items: [record()], nextCursor: 'same' }), 'ru');
    expect(loop).toBeNull();
    let index = 0;
    const divergent = await collectIntegrationControlTowerPages(async () => {
      index += 1;
      return index === 1
        ? { items: [record()], nextCursor: 'next' }
        : { items: [record({ inboxDepth: 2 })], nextCursor: null };
    }, 'ru');
    expect(divergent).toBeNull();
  });
});
