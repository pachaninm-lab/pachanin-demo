import { describe, expect, it } from 'vitest';

import {
  platformV7AssertTenantScope,
  platformV7TenantScopeDecision,
} from '../../../src/platform-v7/tenant-scope';

describe('platform-v7 tenant scope boundary', () => {
  it('allows tenant-matching resources', () => {
    expect(
      platformV7TenantScopeDecision(
        { actorId: 'actor-1', tenantId: 'tenant-a' },
        { tenantId: 'tenant-a' },
        'tenant',
      ),
    ).toEqual({ allowed: true, reason: 'tenant-match' });
  });

  it('rejects cross-tenant resources', () => {
    expect(
      platformV7TenantScopeDecision(
        { actorId: 'actor-1', tenantId: 'tenant-a' },
        { tenantId: 'tenant-b' },
        'tenant',
      ),
    ).toEqual({ allowed: false, reason: 'tenant-mismatch' });
  });

  it('rejects missing tenant data', () => {
    expect(
      platformV7TenantScopeDecision(
        { actorId: 'actor-1', tenantId: '' },
        { tenantId: 'tenant-a' },
        'tenant',
      ),
    ).toEqual({ allowed: false, reason: 'missing-tenant' });
  });

  it('allows platform readonly scope without tenant equality', () => {
    expect(
      platformV7TenantScopeDecision(
        { actorId: 'executive-1', tenantId: 'tenant-a' },
        { tenantId: 'tenant-b' },
        'platform-readonly',
      ),
    ).toEqual({ allowed: true, reason: 'platform-readonly' });
  });

  it('throws on rejected tenant scope', () => {
    expect(() =>
      platformV7AssertTenantScope(
        { actorId: 'actor-1', tenantId: 'tenant-a' },
        { tenantId: 'tenant-b' },
        'tenant',
      ),
    ).toThrow('platform-v7 tenant scope rejected: tenant-mismatch');
  });
});
