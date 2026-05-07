import type { AuditEvent, LogisticsOrder } from './grain-execution/types';
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
}

export const PLATFORM_V7_TRIP_SERVICE_REQUIRED_METHODS = [
  'getDriverTrip',
  'appendTripAudit',
  'confirmTripCheckpoint',
] as const;
