import { describe, expect, it } from 'vitest';
import { canRoleSeeSurface, forbiddenSurfacesForRole } from '@/lib/platform-v7/role-visibility-matrix';

describe('platform-v7 role visibility matrix', () => {
  it('keeps driver limited to trip and field surfaces', () => {
    expect(canRoleSeeSurface('driver', 'tripOnly')).toBe(true);
    expect(canRoleSeeSurface('driver', 'fieldActions')).toBe(true);
    expect(canRoleSeeSurface('driver', 'transportDocuments')).toBe(true);

    for (const surface of ['money', 'moneyDispute', 'grainPrice', 'bankReserve', 'buyerBids', 'investorMetrics', 'allRoles'] as const) {
      expect(canRoleSeeSurface('driver', surface), `driver must not see ${surface}`).toBe(false);
    }
  });

  it('keeps logistics away from grain price, bids, reserve, margin and money dispute', () => {
    expect(canRoleSeeSurface('logistics', 'tripOnly')).toBe(true);
    expect(canRoleSeeSurface('logistics', 'transportDocuments')).toBe(true);

    for (const surface of ['grainPrice', 'buyerBids', 'bankReserve', 'dealMargin', 'moneyDispute', 'investorMetrics'] as const) {
      expect(canRoleSeeSurface('logistics', surface), `logistics must not see ${surface}`).toBe(false);
    }
  });

  it('keeps buyer away from sealed competing bids and seller floor', () => {
    expect(canRoleSeeSurface('buyer', 'grainPrice')).toBe(true);
    expect(canRoleSeeSurface('buyer', 'money')).toBe(true);

    expect(canRoleSeeSurface('buyer', 'competingBidsInSealedMode')).toBe(false);
    expect(canRoleSeeSurface('buyer', 'sellerMinimumPrice')).toBe(false);
    expect(canRoleSeeSurface('buyer', 'bankDebug')).toBe(false);
  });

  it('keeps bank away from pre-deal commercial bidding fight', () => {
    expect(canRoleSeeSurface('bank', 'bankReserve')).toBe(true);
    expect(canRoleSeeSurface('bank', 'money')).toBe(true);
    expect(canRoleSeeSurface('bank', 'preDealBidFight')).toBe(false);
    expect(canRoleSeeSurface('bank', 'buyerBids')).toBe(false);
    expect(canRoleSeeSurface('bank', 'dealMargin')).toBe(false);
  });

  it('keeps investor anonymized', () => {
    expect(canRoleSeeSurface('investor', 'investorMetrics')).toBe(true);
    expect(canRoleSeeSurface('investor', 'personalData')).toBe(false);
    expect(canRoleSeeSurface('investor', 'realLegalNames')).toBe(false);
    expect(canRoleSeeSurface('investor', 'buyerBids')).toBe(false);
  });

  it('keeps forbidden sets explicit for every sensitive role', () => {
    for (const role of ['driver', 'logistics', 'buyer', 'bank', 'investor'] as const) {
      expect(forbiddenSurfacesForRole(role).length, `${role} must have an explicit forbidden surface list`).toBeGreaterThan(0);
    }
  });
});
