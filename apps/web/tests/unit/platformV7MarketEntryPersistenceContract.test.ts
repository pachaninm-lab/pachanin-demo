import { describe, expect, it } from 'vitest';
import { getPlatformV7PersistenceContract, requiresPlatformV7AuditLink, requiresPlatformV7Idempotency } from '@/lib/platform-v7/persistence-contracts';

describe('market intent persistence contract', () => {
  it('requires owner, audit and idempotency before production storage', () => {
    const contract = getPlatformV7PersistenceContract('market_intent');
    expect(contract?.tableName).toBe('platform_v7_market_intents');
    expect(contract?.requiresOwnerId).toBe(true);
    expect(requiresPlatformV7AuditLink('market_intent')).toBe(true);
    expect(requiresPlatformV7Idempotency('market_intent')).toBe(true);
    expect(contract?.canBeDeletedByUser).toBe(false);
  });
});
