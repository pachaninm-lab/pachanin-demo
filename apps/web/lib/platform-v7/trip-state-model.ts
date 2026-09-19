export type PlatformV7TripStatus =
  | 'assigned'
  | 'accepted_by_driver'
  | 'arrived_to_loading'
  | 'loading_started'
  | 'loaded'
  | 'departed'
  | 'in_transit'
  | 'arrived_to_destination'
  | 'weighing'
  | 'unloaded'
  | 'completed'
  | 'blocked';

export const PLATFORM_V7_TRIP_STATUS_ORDER: readonly PlatformV7TripStatus[] = [
  'assigned',
  'accepted_by_driver',
  'arrived_to_loading',
  'loading_started',
  'loaded',
  'departed',
  'in_transit',
  'arrived_to_destination',
  'weighing',
  'unloaded',
  'completed',
  'blocked',
] as const;

const PLATFORM_V7_TRIP_TRANSITIONS: Record<PlatformV7TripStatus, readonly PlatformV7TripStatus[]> = {
  assigned: ['accepted_by_driver', 'blocked'],
  accepted_by_driver: ['arrived_to_loading', 'blocked'],
  arrived_to_loading: ['loading_started', 'blocked'],
  loading_started: ['loaded', 'blocked'],
  loaded: ['departed', 'blocked'],
  departed: ['in_transit', 'blocked'],
  in_transit: ['arrived_to_destination', 'blocked'],
  arrived_to_destination: ['weighing', 'blocked'],
  weighing: ['unloaded', 'blocked'],
  unloaded: ['completed', 'blocked'],
  completed: [],
  blocked: ['assigned', 'accepted_by_driver', 'arrived_to_loading', 'loading_started', 'loaded', 'departed', 'in_transit', 'arrived_to_destination', 'weighing', 'unloaded'],
};

export function canPlatformV7TripTransition(from: PlatformV7TripStatus, to: PlatformV7TripStatus): boolean {
  return PLATFORM_V7_TRIP_TRANSITIONS[from].includes(to);
}

export function isPlatformV7TripTerminal(status: PlatformV7TripStatus): boolean {
  return status === 'completed';
}

export function getPlatformV7TripNextStatuses(status: PlatformV7TripStatus): readonly PlatformV7TripStatus[] {
  return PLATFORM_V7_TRIP_TRANSITIONS[status];
}
