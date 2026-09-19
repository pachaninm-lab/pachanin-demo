import { describe, expect, it } from 'vitest';
import { getPlatformV7ActionPermissionPolicy } from '@/lib/platform-v7/action-permission-boundary';
import { getPlatformV7ActionServiceName } from '@/lib/platform-v7/action-service-map';

describe('platform-v7 trip incident action mapping', () => {
  it('keeps trip incident opening on the trip service boundary', () => {
    expect(getPlatformV7ActionServiceName('trip.open_incident')).toBe('trip');
  });

  it('keeps trip incidents available to execution roles and operator', () => {
    expect(getPlatformV7ActionPermissionPolicy('trip.open_incident')).toMatchObject({
      route: '/platform-v7/logistics',
      allowedRoles: ['logistics', 'driver', 'elevator', 'surveyor', 'operator'],
      serviceName: 'trip',
      needsDurableWrite: true,
      needsAuditEvent: true,
      needsIdempotencyKey: true,
    });
  });
});
