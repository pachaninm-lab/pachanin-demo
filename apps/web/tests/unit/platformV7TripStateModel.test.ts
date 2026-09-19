import { describe, expect, it } from 'vitest';
import {
  PLATFORM_V7_TRIP_STATUS_ORDER,
  canPlatformV7TripTransition,
  getPlatformV7TripNextStatuses,
  isPlatformV7TripTerminal,
} from '@/lib/platform-v7/trip-state-model';

describe('platform-v7 trip state model', () => {
  it('keeps the field execution order explicit', () => {
    expect(PLATFORM_V7_TRIP_STATUS_ORDER[0]).toBe('assigned');
    expect(PLATFORM_V7_TRIP_STATUS_ORDER).toContain('accepted_by_driver');
    expect(PLATFORM_V7_TRIP_STATUS_ORDER).toContain('arrived_to_loading');
    expect(PLATFORM_V7_TRIP_STATUS_ORDER).toContain('in_transit');
    expect(PLATFORM_V7_TRIP_STATUS_ORDER).toContain('weighing');
    expect(PLATFORM_V7_TRIP_STATUS_ORDER).toContain('completed');
  });

  it('allows only forward field transitions or a blocked branch', () => {
    expect(canPlatformV7TripTransition('assigned', 'accepted_by_driver')).toBe(true);
    expect(canPlatformV7TripTransition('accepted_by_driver', 'arrived_to_loading')).toBe(true);
    expect(canPlatformV7TripTransition('loaded', 'departed')).toBe(true);
    expect(canPlatformV7TripTransition('in_transit', 'arrived_to_destination')).toBe(true);
    expect(canPlatformV7TripTransition('weighing', 'unloaded')).toBe(true);
    expect(canPlatformV7TripTransition('assigned', 'blocked')).toBe(true);
    expect(canPlatformV7TripTransition('in_transit', 'loading_started')).toBe(false);
    expect(canPlatformV7TripTransition('completed', 'blocked')).toBe(false);
  });

  it('allows a blocked trip to return only to field execution statuses, not completed', () => {
    expect(getPlatformV7TripNextStatuses('blocked')).toContain('assigned');
    expect(getPlatformV7TripNextStatuses('blocked')).toContain('in_transit');
    expect(getPlatformV7TripNextStatuses('blocked')).not.toContain('completed');
  });

  it('marks only completed as terminal', () => {
    expect(isPlatformV7TripTerminal('completed')).toBe(true);
    expect(isPlatformV7TripTerminal('blocked')).toBe(false);
    expect(isPlatformV7TripTerminal('in_transit')).toBe(false);
  });
});
