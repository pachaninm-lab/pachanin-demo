import { describe, expect, it } from 'vitest';
import { PLATFORM_V7_API_ACTION_MAP } from '@/lib/platform-v7/api-action-map';
import { getPlatformV7ActionServiceName } from '@/lib/platform-v7/action-service-map';
import { PLATFORM_V7_EXECUTION_SERVICE_NAMES } from '@/lib/platform-v7/execution-service-registry-contract';

describe('platform-v7 api action service trace', () => {
  it('keeps every mapped api action tied to a registered execution service', () => {
    const registeredServices = new Set<string>(PLATFORM_V7_EXECUTION_SERVICE_NAMES);

    for (const [boundaryId, actionId] of Object.entries(PLATFORM_V7_API_ACTION_MAP)) {
      if (!actionId) continue;

      const serviceName = getPlatformV7ActionServiceName(actionId);
      expect(serviceName, boundaryId).toSatisfy((name: string) => registeredServices.has(name));
    }
  });

  it('keeps field checkpoint api boundary on the trip service', () => {
    const actionId = PLATFORM_V7_API_ACTION_MAP.mark_trip_arrived;

    expect(actionId).toBe('driver.confirm_checkpoint');
    expect(actionId ? getPlatformV7ActionServiceName(actionId) : undefined).toBe('trip');
  });
});
