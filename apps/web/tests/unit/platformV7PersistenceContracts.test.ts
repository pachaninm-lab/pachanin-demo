import { describe, expect, it } from 'vitest';
import {
  PLATFORM_V7_APPEND_ONLY_ENTITIES,
  PLATFORM_V7_PERSISTENCE_CONTRACTS,
  getPlatformV7PersistenceContract,
  getPlatformV7PersistenceReadinessSummary,
} from '@/lib/platform-v7/persistence-contracts';

describe('platform-v7 persistence contracts', () => {
  it('keeps entity coverage explicit', () => {
    expect(PLATFORM_V7_PERSISTENCE_CONTRACTS).toHaveLength(15);
    expect(PLATFORM_V7_PERSISTENCE_CONTRACTS.map((item) => item.entity)).toContain('grain_batch');
    expect(PLATFORM_V7_PERSISTENCE_CONTRACTS.map((item) => item.entity)).toContain('deal');
    expect(PLATFORM_V7_PERSISTENCE_CONTRACTS.map((item) => item.entity)).toContain('money_record');
    expect(PLATFORM_V7_PERSISTENCE_CONTRACTS.map((item) => item.entity)).toContain('reconciliation_record');
  });

  it('keeps append-only coverage explicit', () => {
    expect(PLATFORM_V7_APPEND_ONLY_ENTITIES).toEqual([
      'audit_event',
      'integration_event',
      'reconciliation_record',
    ]);
  });

  it('keeps reconciliation scoped to a deal', () => {
    expect(getPlatformV7PersistenceContract('reconciliation_record')).toMatchObject({
      requiresDealId: true,
      storageMode: 'append_only',
    });
  });

  it('reports backend wiring as not done', () => {
    expect(getPlatformV7PersistenceReadinessSummary()).toMatchObject({
      total: 15,
      mode: 'contract_only_requires_backend_wiring',
    });
  });
});
