import { describe, expect, it } from 'vitest';

import {
  platformV7AssertObjectScope,
  platformV7ObjectScopeDecision,
} from '../../../src/platform-v7/object-scope';

describe('platform-v7 object scope boundary', () => {
  it('allows object owner for own-object scope', () => {
    expect(
      platformV7ObjectScopeDecision(
        { actorId: 'seller-1', tenantId: 'tenant-a' },
        { tenantId: 'tenant-a', ownerActorIds: ['seller-1'] },
        'own-object',
      ),
    ).toEqual({ allowed: true, reason: 'owner-match' });
  });

  it('rejects non-owner for own-object scope', () => {
    expect(
      platformV7ObjectScopeDecision(
        { actorId: 'seller-2', tenantId: 'tenant-a' },
        { tenantId: 'tenant-a', ownerActorIds: ['seller-1'] },
        'own-object',
      ),
    ).toEqual({ allowed: false, reason: 'missing-owner' });
  });

  it('rejects cross-tenant object access before owner checks', () => {
    expect(
      platformV7ObjectScopeDecision(
        { actorId: 'seller-1', tenantId: 'tenant-a' },
        { tenantId: 'tenant-b', ownerActorIds: ['seller-1'] },
        'own-object',
      ),
    ).toEqual({ allowed: false, reason: 'tenant-rejected' });
  });

  it('allows tenant-scoped actor within the same tenant', () => {
    expect(
      platformV7ObjectScopeDecision(
        { actorId: 'operator-1', tenantId: 'tenant-a' },
        { tenantId: 'tenant-a', ownerActorIds: ['seller-1'] },
        'tenant',
      ),
    ).toEqual({ allowed: true, reason: 'tenant-scope' });
  });

  it('allows platform readonly scope without object ownership', () => {
    expect(
      platformV7ObjectScopeDecision(
        { actorId: 'executive-1', tenantId: 'tenant-a' },
        { tenantId: 'tenant-b', ownerActorIds: ['seller-1'] },
        'platform-readonly',
      ),
    ).toEqual({ allowed: true, reason: 'platform-readonly' });
  });

  it('throws on rejected object scope', () => {
    expect(() =>
      platformV7AssertObjectScope(
        { actorId: 'driver-2', tenantId: 'tenant-a' },
        { tenantId: 'tenant-a', ownerActorIds: ['driver-1'] },
        'own-object',
      ),
    ).toThrow('platform-v7 object scope rejected: missing-owner');
  });
});
