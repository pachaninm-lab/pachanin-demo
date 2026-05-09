import type { PlatformV7ServiceRegistry } from './service-contracts';
import { PLATFORM_V7_REQUIRED_SERVICE_NAMES } from './service-contracts';
import type { PlatformV7TripService } from './trip-service-contract';
import { PLATFORM_V7_TRIP_SERVICE_NAME } from './trip-service-contract';

export type PlatformV7ExecutionServiceRegistry = PlatformV7ServiceRegistry & {
  readonly trip: PlatformV7TripService;
};

export type PlatformV7ExecutionServiceName = keyof PlatformV7ExecutionServiceRegistry;

export const PLATFORM_V7_EXECUTION_SERVICE_NAMES = [
  ...PLATFORM_V7_REQUIRED_SERVICE_NAMES,
  PLATFORM_V7_TRIP_SERVICE_NAME,
] as const;

export function hasUniquePlatformV7ExecutionServiceNames(
  serviceNames: readonly string[] = PLATFORM_V7_EXECUTION_SERVICE_NAMES,
): boolean {
  return new Set(serviceNames).size === serviceNames.length;
}

export function doesPlatformV7ExecutionRegistryRequireTripBoundary(
  serviceNames: readonly string[] = PLATFORM_V7_EXECUTION_SERVICE_NAMES,
): boolean {
  return serviceNames.includes(PLATFORM_V7_TRIP_SERVICE_NAME);
}
