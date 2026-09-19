import { describe, expect, it } from 'vitest';
import { getPlatformV7ActionPermissionPolicy } from '@/lib/platform-v7/action-permission-boundary';
import { getPlatformV7ActionServiceName } from '@/lib/platform-v7/action-service-map';

describe('platform-v7 trip acceptance action mapping', () => {
  it('keeps trip acceptance on the trip service boundary', () => {
    expect(getPlatformV7ActionServiceName('trip.accept')).toBe('trip');
  });

  it('keeps trip acceptance available only to receiving roles and operator', () => {
    expect(getPlatformV7ActionPermissionPolicy('trip.accept')).toMatchObject({
      route: '/platform-v7/deals',
      allowedRoles: ['elevator', 'surveyor', 'operator'],
      serviceName: 'trip',
      needsDurableWrite: true,
      needsAuditEvent: true,
      needsIdempotencyKey: true,
    });
  });
});
