import { describe, expect, it } from 'vitest';
import { getPlatformV7ActionPermissionPolicy } from '@/lib/platform-v7/action-permission-boundary';
import { getPlatformV7ActionForApiBoundary, PLATFORM_V7_API_ACTION_MAP } from '@/lib/platform-v7/api-action-map';
import { getPlatformV7ApiBoundary } from '@/lib/platform-v7/api-boundary-contracts';
import { getPlatformV7ActionServiceName } from '@/lib/platform-v7/action-service-map';

describe('platform-v7 api action map', () => {
  it('maps write api boundaries to action permission policies', () => {
    for (const [boundaryId, actionId] of Object.entries(PLATFORM_V7_API_ACTION_MAP)) {
      expect(getPlatformV7ApiBoundary(boundaryId as keyof typeof PLATFORM_V7_API_ACTION_MAP)).toBeDefined();
      expect(getPlatformV7ActionPermissionPolicy(actionId)).toBeDefined();
    }
  });

  it('keeps driver trip arrival api tied to driver checkpoint and trip service', () => {
    const actionId = getPlatformV7ActionForApiBoundary('mark_trip_arrived');

    expect(actionId).toBe('driver.confirm_checkpoint');
    expect(actionId ? getPlatformV7ActionServiceName(actionId) : undefined).toBe('trip');
  });
});
