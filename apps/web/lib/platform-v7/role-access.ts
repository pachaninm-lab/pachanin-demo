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

export type PlatformV7SensitiveField =
  | 'phone'
  | 'email'
  | 'exactAddress'
  | 'fullLegalName'
  | 'bankDetails'
  | 'fullDocuments'
  | 'responsiblePerson'
  | 'driverContact'
  | 'carrierContact'
  | 'closedOfferTerms';

export type PlatformV7AccessDecision = {
  readonly allowed: boolean;
  readonly reason: string;
};

const ROLE_SWITCH_ROUTE = '/platform-v7/roles';

export const PLATFORM_V7_ROLE_FORBIDDEN_SURFACES: Record<PlatformV7Role, readonly PlatformV7SensitiveSurface[]> = {
  driver: ['bankReserve', 'moneyRelease', 'grainPrice', 'thirdPartyBids', 'investorMode', 'controlTower', 'roleSwitcher', 'providerDebug'],
  logistics: ['bankReserve', 'moneyRelease', 'grainPrice', 'thirdPartyBids', 'providerDebug', 'roleSwitcher'],
  buyer: ['thirdPartyBids', 'operatorControls', 'bankInternalEvents', 'providerDebug', 'roleSwitcher'],
  seller: ['bankInternalEvents', 'thirdPartyBids', 'providerDebug', 'roleSwitcher'],
  bank: ['driverActions', 'thirdPartyBids', 'providerDebug', 'roleSwitcher'],
  elevator: ['bankReserve', 'moneyRelease', 'grainPrice', 'thirdPartyBids', 'investorMode', 'providerDebug', 'roleSwitcher'],
  lab: ['bankReserve', 'moneyRelease', 'grainPrice', 'thirdPartyBids', 'investorMode', 'driverActions', 'providerDebug', 'roleSwitcher'],
  surveyor: ['bankReserve', 'moneyRelease', 'thirdPartyBids', 'investorMode', 'providerDebug', 'roleSwitcher'],
  arbitrator: ['driverActions', 'thirdPartyBids', 'providerDebug', 'roleSwitcher'],
  compliance: ['driverActions', 'thirdPartyBids', 'providerDebug', 'roleSwitcher'],
  investor: ['driverActions', 'bankInternalEvents', 'operatorControls', 'providerDebug', 'roleSwitcher'],
  executive: ['driverActions', 'bankInternalEvents', 'providerDebug', 'roleSwitcher'],
  operator: [],
};

export const PLATFORM_V7_ROLE_FORBIDDEN_FIELDS: Record<PlatformV7Role, readonly PlatformV7SensitiveField[]> = {
  seller: ['bankDetails', 'closedOfferTerms'],
  buyer: ['phone', 'email', 'exactAddress', 'bankDetails', 'closedOfferTerms'],
  logistics: ['bankDetails', 'closedOfferTerms'],
  driver: ['phone', 'email', 'bankDetails', 'closedOfferTerms', 'fullDocuments', 'responsiblePerson'],
  elevator: ['bankDetails', 'closedOfferTerms'],
  lab: ['bankDetails', 'closedOfferTerms', 'driverContact', 'carrierContact'],
  surveyor: ['bankDetails', 'closedOfferTerms'],
  bank: ['driverContact', 'carrierContact'],
  operator: [],
  arbitrator: ['driverContact', 'carrierContact'],
  compliance: ['driverContact', 'carrierContact'],
  investor: ['phone', 'email', 'exactAddress', 'bankDetails', 'fullDocuments', 'responsiblePerson', 'driverContact', 'carrierContact', 'closedOfferTerms'],
  executive: ['driverContact', 'carrierContact', 'bankDetails'],
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
  driver: [ROLE_SWITCH_ROUTE, '/platform-v7/bank', '/platform-v7/control-tower', '/platform-v7/investor', '/platform-v7/buyer', '/platform-v7/seller', '/platform-v7/connectors'],
  logistics: [ROLE_SWITCH_ROUTE, '/platform-v7/bank', '/platform-v7/investor', '/platform-v7/connectors'],
  buyer: [ROLE_SWITCH_ROUTE, '/platform-v7/control-tower', '/platform-v7/bank/release-safety', '/platform-v7/connectors'],
  seller: [ROLE_SWITCH_ROUTE, '/platform-v7/bank/release-safety', '/platform-v7/connectors'],
  bank: [ROLE_SWITCH_ROUTE, '/platform-v7/driver/field', '/platform-v7/lots/create', '/platform-v7/connectors'],
  elevator: [ROLE_SWITCH_ROUTE, '/platform-v7/bank', '/platform-v7/investor', '/platform-v7/connectors'],
  lab: [ROLE_SWITCH_ROUTE, '/platform-v7/bank', '/platform-v7/investor', '/platform-v7/driver/field', '/platform-v7/connectors'],
  surveyor: [ROLE_SWITCH_ROUTE, '/platform-v7/bank', '/platform-v7/investor', '/platform-v7/connectors'],
  arbitrator: [ROLE_SWITCH_ROUTE, '/platform-v7/driver/field', '/platform-v7/connectors'],
  compliance: [ROLE_SWITCH_ROUTE, '/platform-v7/driver/field', '/platform-v7/connectors'],
  investor: [ROLE_SWITCH_ROUTE, '/platform-v7/driver/field', '/platform-v7/control-tower', '/platform-v7/connectors'],
  executive: [ROLE_SWITCH_ROUTE, '/platform-v7/driver/field', '/platform-v7/connectors'],
  operator: [],
};

export function isPlatformV7SurfaceForbiddenForRole(role: PlatformV7Role, surface: PlatformV7SensitiveSurface): boolean {
  return PLATFORM_V7_ROLE_FORBIDDEN_SURFACES[role].includes(surface);
}

export function isPlatformV7FieldForbiddenForRole(role: PlatformV7Role, field: PlatformV7SensitiveField): boolean {
  return PLATFORM_V7_ROLE_FORBIDDEN_FIELDS[role].includes(field);
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

export function canPlatformV7RoleSeeField(role: PlatformV7Role, field: PlatformV7SensitiveField): PlatformV7AccessDecision {
  if (isPlatformV7FieldForbiddenForRole(role, field)) {
    return {
      allowed: false,
      reason: 'Поле закрыто для роли до наступления допустимого этапа сделки.',
    };
  }

  return {
    allowed: true,
    reason: 'Поле доступно для роли.',
  };
}

export function getPlatformV7VisibleFields(role: PlatformV7Role, fields: readonly PlatformV7SensitiveField[]): PlatformV7SensitiveField[] {
  return fields.filter((field) => !isPlatformV7FieldForbiddenForRole(role, field));
}
