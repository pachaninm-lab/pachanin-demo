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
  | 'driverActions';

export const PLATFORM_V7_ROLE_FORBIDDEN_SURFACES: Record<PlatformV7Role, readonly PlatformV7SensitiveSurface[]> = {
  driver: ['bankReserve', 'moneyRelease', 'grainPrice', 'thirdPartyBids', 'investorMode', 'controlTower', 'roleSwitcher'],
  logistics: ['bankReserve', 'moneyRelease', 'grainPrice', 'thirdPartyBids'],
  buyer: ['thirdPartyBids', 'operatorControls', 'bankInternalEvents'],
  seller: ['bankInternalEvents', 'thirdPartyBids'],
  bank: ['driverActions', 'thirdPartyBids'],
  elevator: ['bankReserve', 'moneyRelease', 'grainPrice', 'thirdPartyBids', 'investorMode'],
  lab: ['bankReserve', 'moneyRelease', 'grainPrice', 'thirdPartyBids', 'investorMode', 'driverActions'],
  surveyor: ['bankReserve', 'moneyRelease', 'thirdPartyBids', 'investorMode'],
  arbitrator: ['driverActions', 'thirdPartyBids'],
  compliance: ['driverActions', 'thirdPartyBids'],
  investor: ['driverActions', 'bankInternalEvents', 'operatorControls'],
  executive: ['driverActions', 'bankInternalEvents'],
  operator: [],
};

export function isPlatformV7SurfaceForbiddenForRole(role: PlatformV7Role, surface: PlatformV7SensitiveSurface): boolean {
  return PLATFORM_V7_ROLE_FORBIDDEN_SURFACES[role].includes(surface);
}
