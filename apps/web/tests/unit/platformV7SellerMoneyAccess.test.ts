import { describe, expect, it } from 'vitest';
import { platformV7Can } from '@/lib/platform-v7/access-control';

describe('platform-v7 seller money access', () => {
  it('allows seller to request review on own money object but not release it', () => {
    const actor = { userId: 'user-1', organizationId: 'seller-a', roles: ['seller'] as const, activeRole: 'seller' as const };

    expect(platformV7Can({
      actor,
      action: 'request',
      resource: { resourceType: 'money', resourceId: 'money-1', sellerOrganizationId: 'seller-a' },
    })).toBe(true);

    expect(platformV7Can({
      actor,
      action: 'request',
      resource: { resourceType: 'money', resourceId: 'money-2', sellerOrganizationId: 'seller-b' },
    })).toBe(false);

    expect(platformV7Can({
      actor,
      action: 'release',
      resource: { resourceType: 'money', resourceId: 'money-3', sellerOrganizationId: 'seller-a' },
    })).toBe(false);
  });
});
