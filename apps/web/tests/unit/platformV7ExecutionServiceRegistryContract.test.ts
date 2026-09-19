import { describe, expect, it } from 'vitest';
import {
  doesPlatformV7ExecutionRegistryRequireTripBoundary,
  PLATFORM_V7_EXECUTION_SERVICE_NAMES,
} from '@/lib/platform-v7/execution-service-registry-contract';
import { PLATFORM_V7_REQUIRED_SERVICE_NAMES } from '@/lib/platform-v7/service-contracts';
import { PLATFORM_V7_TRIP_SERVICE_NAME } from '@/lib/platform-v7/trip-service-contract';

describe('platform-v7 execution service registry contract', () => {
  it('extends the base service registry with the separate trip boundary', () => {
    expect(PLATFORM_V7_EXECUTION_SERVICE_NAMES).toEqual([
      ...PLATFORM_V7_REQUIRED_SERVICE_NAMES,
      PLATFORM_V7_TRIP_SERVICE_NAME,
    ]);
    expect(doesPlatformV7ExecutionRegistryRequireTripBoundary()).toBe(true);
  });

  it('does not remove any base controlled-pilot service boundary', () => {
    for (const serviceName of PLATFORM_V7_REQUIRED_SERVICE_NAMES) {
      expect(PLATFORM_V7_EXECUTION_SERVICE_NAMES).toContain(serviceName);
    }
  });
});
