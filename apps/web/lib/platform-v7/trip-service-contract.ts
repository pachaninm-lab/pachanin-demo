import type { AuditEvent, LogisticsIncident, LogisticsOrder } from './grain-execution/types';
import type { PlatformV7WriteResult } from './service-contracts';

export const PLATFORM_V7_TRIP_SERVICE_NAME = 'trip' as const;

export type PlatformV7TripCheckpoint =
  | 'arrived'
  | 'loading_started'
  | 'loading_done'
  | 'in_transit'
  | 'unloading'
  | 'completed';

export interface PlatformV7TripService {
  getDriverTrip(driverId: string): Promise<LogisticsOrder | undefined>;
  appendTripAudit(tripId: string, event: Partial<AuditEvent>): Promise<PlatformV7WriteResult<AuditEvent>>;
  confirmTripCheckpoint(
    tripId: string,
    checkpoint: PlatformV7TripCheckpoint,
  ): Promise<PlatformV7WriteResult<LogisticsOrder>>;
  openTripIncident(tripId: string, incident: Partial<LogisticsIncident>): Promise<PlatformV7WriteResult<LogisticsIncident>>;
}

export const PLATFORM_V7_TRIP_SERVICE_REQUIRED_METHODS = [
  'getDriverTrip',
  'appendTripAudit',
  'confirmTripCheckpoint',
  'openTripIncident',
] as const;

export const PLATFORM_V7_TRIP_SERVICE_WRITE_METHODS = [
  'appendTripAudit',
  'confirmTripCheckpoint',
  'openTripIncident',
] as const satisfies readonly (typeof PLATFORM_V7_TRIP_SERVICE_REQUIRED_METHODS)[number][];

export function getPlatformV7TripServiceWriteMethods(): readonly string[] {
  return PLATFORM_V7_TRIP_SERVICE_WRITE_METHODS;
}

export function doesPlatformV7TripServiceExposeWriteMethods(): boolean {
  return getPlatformV7TripServiceWriteMethods().length > 0;
}
