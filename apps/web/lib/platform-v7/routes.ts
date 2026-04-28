export const PLATFORM_V7_MARKET_RFQ_ROUTE = '/platform-v7/market-rfq';
export const PLATFORM_V7_RELEASE_SAFETY_ROUTE = '/platform-v7/bank/release-safety';
export const PLATFORM_V7_EXECUTION_MAP_ROUTE = '/platform-v7/execution-map';
export const PLATFORM_V7_READINESS_ROUTE = '/platform-v7/readiness';
export const PLATFORM_V7_DATA_ROOM_ROUTE = '/platform-v7/data-room';
export const PLATFORM_V7_LOGISTICS_ROUTE = '/platform-v7/logistics';
export const PLATFORM_V7_DISPUTES_ROUTE = '/platform-v7/disputes';
export const PLATFORM_V7_BANK_ROUTE = '/platform-v7/bank';
export const PLATFORM_V7_OPERATOR_ROUTE = '/platform-v7/operator';
export const PLATFORM_V7_CONTROL_TOWER_ROUTE = '/platform-v7/control-tower';

export const PLATFORM_V7_EXECUTION_MACHINE_STRIP_ROUTES = [
  PLATFORM_V7_READINESS_ROUTE,
  PLATFORM_V7_EXECUTION_MAP_ROUTE,
  PLATFORM_V7_RELEASE_SAFETY_ROUTE,
  PLATFORM_V7_DATA_ROOM_ROUTE,
  PLATFORM_V7_LOGISTICS_ROUTE,
  PLATFORM_V7_DISPUTES_ROUTE,
] as const;

export type PlatformV7ExecutionMachineStripRoute = typeof PLATFORM_V7_EXECUTION_MACHINE_STRIP_ROUTES[number];
