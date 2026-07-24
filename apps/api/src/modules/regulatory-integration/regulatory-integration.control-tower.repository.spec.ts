import { Role, type RequestUser } from '../../common/types/request-user';
import { RegulatoryIntegrationControlTowerRepository } from './regulatory-integration.control-tower.repository';

const now = new Date('2026-07-24T07:00:00.000Z');

function user(): RequestUser {
  return {
    id: 'user-1', email: 'operator@example.test', role: Role.ADMIN,
    orgId: 'org-1', tenantId: 'tenant-1', membershipId: 'membership-1', sessionId: 'session-1',
    mfaVerified: true, staffRoles: ['OPERATIONS_SUPERVISOR'],
  };
}

function row(overrides: Record<string, unknown> = {}) {
  return {
    adapterCode: 'FGIS_ZERNO', adapterVersion: '1.0.0', provider: 'fgis-zerno',
    capabilities: ['INBOUND_EVENTS'], environment: 'PRODUCTION', schemaVersion: 'v1', mappingVersion: 'm1',
    lastUpdatedAt: now, freshnessAt: now, lastSuccessAt: now, lastErrorAt: null, lastErrorCode: null,
    oldestEventAt: null, inboxDepth: 0n, retryCount: 0n, quarantineCount: 0n, deadCount: 0n,
    processingCount: 0n, conflictCount: 0n, providerAcknowledgedCount: 1n, businessAcceptedCount: 1n,
    eligibleRedriveEntryId: null, aggregateVersion: 4n, states: ['PROCESSED'],
    reconciliationStatus: null, reconciliationUpdatedAt: null,
    ...overrides,
  };
}

function repositoryWithRows(rows: unknown[]) {
  const tx = { $queryRaw: jest.fn().mockResolvedValue(rows) };
  const transactions = {
    withTrustedContext: jest.fn((_actor, work) => work(tx, {
      userId: 'user-1', orgId: 'org-1', tenantId: 'tenant-1', role: Role.ADMIN, sessionId: 'session-1',
    })),
  };
  return { repository: new RegulatoryIntegrationControlTowerRepository(transactions as never), tx, transactions };
}

describe('RegulatoryIntegrationControlTowerRepository read model', () => {
  it('never infers CONFIRMED_LIVE from a healthy production adapter', async () => {
    const { repository } = repositoryWithRows([row()]);
    const result = await repository.list(user(), { limit: 10, hasJitAuthority: true });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      adapterCode: 'FGIS_ZERNO', honestStatus: 'ADAPTER_READY',
      credentialReferenceExpiresAt: null, credentialMetadataAvailable: false,
    });
    expect(result.items[0]?.honestStatus).not.toBe('CONFIRMED_LIVE');
  });

  it('derives DEGRADED and REDRIVE only from PostgreSQL error facts', async () => {
    const { repository } = repositoryWithRows([row({
      lastErrorAt: now, lastErrorCode: 'SIGNATURE_INVALID', quarantineCount: 1n,
      inboxDepth: 1n, eligibleRedriveEntryId: 'entry-1', states: ['QUARANTINED'],
    })]);
    const result = await repository.list(user(), { limit: 10, hasJitAuthority: true });
    expect(result.items[0]).toMatchObject({
      honestStatus: 'DEGRADED', quarantineCount: 1,
      primaryAction: { id: 'REDRIVE', entryId: 'entry-1', allowed: true },
    });
  });

  it('keeps sandbox/pre-production facts explicitly in TEST', async () => {
    const { repository } = repositoryWithRows([row({ environment: 'PRE_PRODUCTION' })]);
    const result = await repository.list(user(), { limit: 10, hasJitAuthority: false });
    expect(result.items[0]?.honestStatus).toBe('TEST');
  });

  it('uses bounded stable cursor pagination', async () => {
    const older = new Date(now.getTime() - 60_000);
    const { repository } = repositoryWithRows([
      row({ adapterCode: 'A_ADAPTER', freshnessAt: now, lastUpdatedAt: now }),
      row({ adapterCode: 'B_ADAPTER', freshnessAt: older, lastUpdatedAt: older }),
    ]);
    const first = await repository.list(user(), { limit: 1, hasJitAuthority: false });
    expect(first.items.map((item) => item.adapterCode)).toEqual(['A_ADAPTER']);
    expect(first.nextCursor).toEqual(expect.any(String));
    const second = await repository.list(user(), {
      limit: 1, cursor: first.nextCursor || undefined, hasJitAuthority: false,
    });
    expect(second.items.map((item) => item.adapterCode)).toEqual(['B_ADAPTER']);
  });
});
