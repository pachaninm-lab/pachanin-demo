import { describe, expect, it } from 'vitest';
import { PLATFORM_V7_API_ACTION_MAP } from '@/lib/platform-v7/api-action-map';
import { getPlatformV7ActionPermissionPolicy } from '@/lib/platform-v7/action-permission-boundary';
import { getPlatformV7ActionServiceName } from '@/lib/platform-v7/action-service-map';

describe('platform-v7 deal terms action mapping', () => {
  it('maps confirm deal terms to the deal service boundary', () => {
    expect(PLATFORM_V7_API_ACTION_MAP.confirm_deal_terms).toBe('deal.confirm_terms');
    expect(getPlatformV7ActionServiceName('deal.confirm_terms')).toBe('deal');
  });

  it('keeps deal terms confirmation available only to deal parties and operator', () => {
    expect(getPlatformV7ActionPermissionPolicy('deal.confirm_terms')).toMatchObject({
      route: '/platform-v7/deals',
      allowedRoles: ['seller', 'buyer', 'operator'],
      serviceName: 'deal',
      needsDurableWrite: true,
      needsAuditEvent: true,
      needsIdempotencyKey: true,
    });
  });
});
