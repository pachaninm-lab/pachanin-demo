export type PlatformV7Role =
  | 'seller'
  | 'buyer'
  | 'logistics'
  | 'driver'
  | 'elevator'
  | 'lab'
  | 'surveyor'
  | 'bank'
  | 'operator'
  | 'arbitrator'
  | 'compliance'
  | 'investor'
  | 'executive';

export type PlatformV7SensitiveSurface =
  | 'bankReserve'
  | 'moneyRelease'
  | 'grainPrice'
  | 'thirdPartyBids'
  | 'operatorControls'
  | 'bankInternalEvents'
  | 'investorMode'
  | 'controlTower'
  | 'roleSwitcher'
  | 'driverActions'
  | 'providerDebug';

export type PlatformV7AccessDecision = {
  readonly allowed: boolean;
  readonly reason: string;
};

export const PLATFORM_V7_ROLE_FORBIDDEN_SURFACES: Record<PlatformV7Role, readonly PlatformV7SensitiveSurface[]> = {
  driver: ['bankReserve', 'moneyRelease', 'grainPrice', 'thirdPartyBids', 'investorMode', 'controlTower', 'roleSwitcher', 'providerDebug'],
  logistics: ['bankReserve', 'moneyRelease', 'grainPrice', 'thirdPartyBids', 'providerDebug'],
  buyer: ['thirdPartyBids', 'operatorControls', 'bankInternalEvents', 'providerDebug'],
  seller: ['bankInternalEvents', 'thirdPartyBids', 'providerDebug'],
  bank: ['driverActions', 'thirdPartyBids', 'providerDebug'],
  elevator: ['bankReserve', 'moneyRelease', 'grainPrice', 'thirdPartyBids', 'investorMode', 'providerDebug'],
  lab: ['bankReserve', 'moneyRelease', 'grainPrice', 'thirdPartyBids', 'investorMode', 'driverActions', 'providerDebug'],
  surveyor: ['bankReserve', 'moneyRelease', 'thirdPartyBids', 'investorMode', 'providerDebug'],
  arbitrator: ['driverActions', 'thirdPartyBids', 'providerDebug'],
  compliance: ['driverActions', 'thirdPartyBids', 'providerDebug'],
  investor: ['driverActions', 'bankInternalEvents', 'operatorControls', 'providerDebug'],
  executive: ['driverActions', 'bankInternalEvents', 'providerDebug'],
  operator: [],
};

export const PLATFORM_V7_ROLE_HOME_ROUTE: Record<PlatformV7Role, string> = {
  seller: '/platform-v7/seller',
  buyer: '/platform-v7/buyer',
  logistics: '/platform-v7/logistics',
  driver: '/platform-v7/driver/field',
  elevator: '/platform-v7/elevator',
  lab: '/platform-v7/lab',
  surveyor: '/platform-v7/surveyor',
  bank: '/platform-v7/bank',
  operator: '/platform-v7/control-tower',
  arbitrator: '/platform-v7/arbitrator',
  compliance: '/platform-v7/compliance',
  investor: '/platform-v7/investor',
  executive: '/platform-v7/executive',
};

export const PLATFORM_V7_ROLE_BLOCKED_ROUTE_PREFIXES: Record<PlatformV7Role, readonly string[]> = {
  driver: ['/platform-v7/bank', '/platform-v7/control-tower', '/platform-v7/investor', '/platform-v7/buyer', '/platform-v7/seller', '/platform-v7/connectors'],
  logistics: ['/platform-v7/bank', '/platform-v7/investor', '/platform-v7/connectors'],
  buyer: ['/platform-v7/control-tower', '/platform-v7/bank/release-safety', '/platform-v7/connectors'],
  seller: ['/platform-v7/bank/release-safety', '/platform-v7/connectors'],
  bank: ['/platform-v7/driver/field', '/platform-v7/lots/create', '/platform-v7/connectors'],
  elevator: ['/platform-v7/bank', '/platform-v7/investor', '/platform-v7/connectors'],
  lab: ['/platform-v7/bank', '/platform-v7/investor', '/platform-v7/driver/field', '/platform-v7/connectors'],
  surveyor: ['/platform-v7/bank', '/platform-v7/investor', '/platform-v7/connectors'],
  arbitrator: ['/platform-v7/driver/field', '/platform-v7/connectors'],
  compliance: ['/platform-v7/driver/field', '/platform-v7/connectors'],
  investor: ['/platform-v7/driver/field', '/platform-v7/control-tower', '/platform-v7/connectors'],
  executive: ['/platform-v7/driver/field', '/platform-v7/connectors'],
  operator: [],
};

export function isPlatformV7SurfaceForbiddenForRole(role: PlatformV7Role, surface: PlatformV7SensitiveSurface): boolean {
  return PLATFORM_V7_ROLE_FORBIDDEN_SURFACES[role].includes(surface);
}

export function getPlatformV7RoleHomeRoute(role: PlatformV7Role): string {
  return PLATFORM_V7_ROLE_HOME_ROUTE[role];
}

export function canPlatformV7RoleOpenRoute(role: PlatformV7Role, route: string): PlatformV7AccessDecision {
  const blockedPrefix = PLATFORM_V7_ROLE_BLOCKED_ROUTE_PREFIXES[role].find((prefix) => route === prefix || route.startsWith(`${prefix}/`));

  if (blockedPrefix) {
    return {
      allowed: false,
      reason: `Маршрут закрыт для роли. Откройте рабочий экран: ${PLATFORM_V7_ROLE_HOME_ROUTE[role]}`,
    };
  }

  return {
    allowed: true,
    reason: 'Маршрут доступен для роли.',
  };
}
