import type { PlatformRole } from './execution-contour';

export type PlatformV7Surface =
  | 'grainPrice'
  | 'buyerBids'
  | 'competingBidsInSealedMode'
  | 'sellerMinimumPrice'
  | 'buyerRiskScore'
  | 'bankReserve'
  | 'bankDebug'
  | 'dealMargin'
  | 'investorMetrics'
  | 'personalData'
  | 'realLegalNames'
  | 'money'
  | 'moneyDispute'
  | 'allRoles'
  | 'preDealBidFight'
  | 'tripOnly'
  | 'fieldActions'
  | 'transportDocuments'
  | 'receivingFacts'
  | 'labProtocol'
  | 'auditTrail';

export const roleForbiddenSurfaces: Record<PlatformRole, readonly PlatformV7Surface[]> = {
  operator: [],
  seller: ['buyerRiskScore', 'bankDebug', 'competingBidsInSealedMode'],
  buyer: ['competingBidsInSealedMode', 'sellerMinimumPrice', 'bankDebug', 'buyerRiskScore'],
  bank: ['preDealBidFight', 'competingBidsInSealedMode', 'buyerBids', 'dealMargin'],
  logistics: ['grainPrice', 'buyerBids', 'bankReserve', 'dealMargin', 'investorMetrics', 'moneyDispute'],
  driver: ['grainPrice', 'buyerBids', 'bankReserve', 'bankDebug', 'dealMargin', 'investorMetrics', 'money', 'moneyDispute', 'allRoles', 'personalData', 'realLegalNames', 'preDealBidFight'],
  elevator: ['buyerBids', 'bankReserve', 'bankDebug', 'dealMargin', 'investorMetrics', 'preDealBidFight'],
  lab: ['buyerBids', 'bankReserve', 'bankDebug', 'dealMargin', 'investorMetrics', 'preDealBidFight'],
  surveyor: ['bankDebug', 'dealMargin', 'investorMetrics', 'preDealBidFight'],
  arbitrator: ['bankDebug', 'dealMargin', 'investorMetrics', 'preDealBidFight'],
  investor: ['personalData', 'realLegalNames', 'buyerBids', 'bankDebug', 'preDealBidFight'],
};

export const roleAllowedSurfaces: Record<PlatformRole, readonly PlatformV7Surface[]> = {
  operator: ['grainPrice', 'buyerBids', 'sellerMinimumPrice', 'buyerRiskScore', 'bankReserve', 'money', 'moneyDispute', 'transportDocuments', 'receivingFacts', 'labProtocol', 'auditTrail'],
  seller: ['grainPrice', 'buyerBids', 'sellerMinimumPrice', 'transportDocuments', 'receivingFacts', 'labProtocol', 'auditTrail'],
  buyer: ['grainPrice', 'bankReserve', 'money', 'moneyDispute', 'transportDocuments', 'receivingFacts', 'labProtocol'],
  bank: ['bankReserve', 'money', 'moneyDispute', 'transportDocuments', 'auditTrail'],
  logistics: ['tripOnly', 'fieldActions', 'transportDocuments', 'receivingFacts'],
  driver: ['tripOnly', 'fieldActions', 'transportDocuments'],
  elevator: ['tripOnly', 'transportDocuments', 'receivingFacts'],
  lab: ['receivingFacts', 'labProtocol'],
  surveyor: ['tripOnly', 'transportDocuments', 'receivingFacts', 'labProtocol', 'auditTrail'],
  arbitrator: ['moneyDispute', 'transportDocuments', 'receivingFacts', 'labProtocol', 'auditTrail'],
  investor: ['investorMetrics', 'auditTrail'],
};

export function canRoleSeeSurface(role: PlatformRole, surface: PlatformV7Surface): boolean {
  if (roleForbiddenSurfaces[role].includes(surface)) return false;
  if (role === 'operator') return true;
  return roleAllowedSurfaces[role].includes(surface);
}

export function forbiddenSurfacesForRole(role: PlatformRole): readonly PlatformV7Surface[] {
  return roleForbiddenSurfaces[role];
}
