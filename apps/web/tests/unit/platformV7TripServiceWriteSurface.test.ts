import { describe, expect, it } from 'vitest';
import {
  doesPlatformV7TripServiceExposeWriteMethods,
  getPlatformV7TripServiceWriteMethods,
  PLATFORM_V7_TRIP_SERVICE_REQUIRED_METHODS,
  PLATFORM_V7_TRIP_SERVICE_WRITE_METHODS,
} from '@/lib/platform-v7/trip-service-contract';

describe('platform-v7 trip service write surface', () => {
  it('keeps write methods stable', () => {
    expect(PLATFORM_V7_TRIP_SERVICE_WRITE_METHODS).toEqual([
      'appendTripAudit',
      'confirmTripCheckpoint',
      'openTripIncident',
    ]);
  });

  it('keeps every write method listed in required methods', () => {
    for (const method of PLATFORM_V7_TRIP_SERVICE_WRITE_METHODS) {
      expect(PLATFORM_V7_TRIP_SERVICE_REQUIRED_METHODS, method).toContain(method);
    }
  });

  it('excludes read-only getDriverTrip from write surface', () => {
    expect(PLATFORM_V7_TRIP_SERVICE_WRITE_METHODS).not.toContain('getDriverTrip');
    expect(getPlatformV7TripServiceWriteMethods()).not.toContain('getDriverTrip');
  });

  it('helper returns the same list as the constant', () => {
    expect(getPlatformV7TripServiceWriteMethods()).toEqual([...PLATFORM_V7_TRIP_SERVICE_WRITE_METHODS]);
  });

  it('reports that trip service exposes write methods', () => {
    expect(doesPlatformV7TripServiceExposeWriteMethods()).toBe(true);
  });
});
