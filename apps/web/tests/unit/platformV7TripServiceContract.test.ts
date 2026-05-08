import { describe, expect, it } from 'vitest';
import {
  PLATFORM_V7_TRIP_SERVICE_NAME,
  PLATFORM_V7_TRIP_SERVICE_REQUIRED_METHODS,
} from '@/lib/platform-v7/trip-service-contract';

describe('platform-v7 trip service contract', () => {
  it('keeps trip as a separate controlled-pilot service boundary', () => {
    expect(PLATFORM_V7_TRIP_SERVICE_NAME).toBe('trip');
    expect(PLATFORM_V7_TRIP_SERVICE_REQUIRED_METHODS).toEqual([
      'getDriverTrip',
      'appendTripAudit',
      'confirmTripCheckpoint',
      'openTripIncident',
    ]);
  });

  it('does not claim trip runtime persistence or live telemetry', () => {
    expect(PLATFORM_V7_TRIP_SERVICE_REQUIRED_METHODS.join(' ')).not.toMatch(
      /production-ready|fully live|fully integrated|live telemetry/i,
    );
  });
});
