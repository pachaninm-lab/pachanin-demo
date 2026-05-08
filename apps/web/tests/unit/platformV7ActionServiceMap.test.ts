import { describe, expect, it } from 'vitest';
import { PLATFORM_V7_ACTION_SERVICE_MAP } from '@/lib/platform-v7/action-service-map';
import { PLATFORM_V7_EXECUTION_SERVICE_NAMES } from '@/lib/platform-v7/execution-service-registry-contract';

describe('platform-v7 action service map', () => {
  it('maps every action only to a registered execution service', () => {
    const registeredServices = new Set<string>(PLATFORM_V7_EXECUTION_SERVICE_NAMES);

    for (const [actionId, serviceName] of Object.entries(PLATFORM_V7_ACTION_SERVICE_MAP)) {
      expect(serviceName, actionId).toSatisfy((name: string) => registeredServices.has(name));
    }
  });

  it('keeps driver checkpoint actions on the trip boundary', () => {
    expect(PLATFORM_V7_ACTION_SERVICE_MAP['driver.confirm_checkpoint']).toBe('trip');
  });
});
