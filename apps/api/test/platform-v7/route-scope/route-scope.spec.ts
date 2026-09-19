import { describe, expect, it } from 'vitest';

import {
  platformV7ActionForRoute,
  platformV7AssertRouteScope,
  platformV7RouteScopeDecision,
  type PlatformV7RouteScopedActor,
  type PlatformV7RouteScopedResource,
} from '../../../src/platform-v7/route-scope';

const ownDeal: PlatformV7RouteScopedResource = {
  objectId: 'DL-9102',
  tenantId: 'tenant-a',
  ownerActorIds: ['seller-1', 'buyer-1', 'driver-1'],
};

const tenantDeal: PlatformV7RouteScopedResource = {
  objectId: 'DL-9106',
  tenantId: 'tenant-a',
  ownerActorIds: ['seller-2', 'buyer-2', 'driver-2'],
};

const otherTenantDeal: PlatformV7RouteScopedResource = {
  objectId: 'DL-9110',
  tenantId: 'tenant-b',
  ownerActorIds: ['seller-3', 'buyer-3'],
};

function actor(role: PlatformV7RouteScopedActor['role'], actorId = `${role}-1`): PlatformV7RouteScopedActor {
  return { role, actorId, tenantId: 'tenant-a' };
}

describe('platform-v7 route scope boundary', () => {
  it('maps route ids to RBAC actions', () => {
    expect(platformV7ActionForRoute('deal.detail')).toBe('deal.read');
    expect(platformV7ActionForRoute('money.basis')).toBe('money.basis.review');
    expect(platformV7ActionForRoute('unknown.route')).toBeNull();
  });

  it('allows seller and buyer only on own deal routes', () => {
    expect(platformV7RouteScopeDecision(actor('seller'), 'deal.detail', ownDeal)).toMatchObject({
      allowed: true,
      reason: 'route-allowed',
      scopeReason: 'owner-match',
    });
    expect(platformV7RouteScopeDecision(actor('buyer'), 'money.release.request', ownDeal)).toMatchObject({
      allowed: true,
      action: 'money.release.request',
      scopeReason: 'owner-match',
    });
    expect(platformV7RouteScopeDecision(actor('seller'), 'deal.detail', tenantDeal)).toMatchObject({
      allowed: false,
      reason: 'scope-rejected',
      scopeReason: 'missing-owner',
    });
  });

  it('keeps driver inside own logistics routes and out of money/dispute routes', () => {
    expect(platformV7RouteScopeDecision(actor('driver'), 'logistics.dispatch', ownDeal)).toMatchObject({
      allowed: true,
      scopeReason: 'owner-match',
    });
    expect(platformV7RouteScopeDecision(actor('driver'), 'money.ledger', ownDeal)).toMatchObject({
      allowed: false,
      reason: 'permission-denied',
      action: 'money.read',
    });
    expect(platformV7RouteScopeDecision(actor('driver'), 'dispute.update', ownDeal)).toMatchObject({
      allowed: false,
      reason: 'permission-denied',
      action: 'dispute.write',
    });
  });

  it('allows logistics, elevator and lab only on their tenant-scoped operational routes', () => {
    expect(platformV7RouteScopeDecision(actor('logistics'), 'logistics.dispatch', tenantDeal)).toMatchObject({
      allowed: true,
      scopeReason: 'tenant-scope',
    });
    expect(platformV7RouteScopeDecision(actor('elevator'), 'quality.submit', tenantDeal)).toMatchObject({
      allowed: true,
      scopeReason: 'tenant-scope',
    });
    expect(platformV7RouteScopeDecision(actor('lab'), 'quality.submit', tenantDeal)).toMatchObject({
      allowed: true,
      scopeReason: 'tenant-scope',
    });
    expect(platformV7RouteScopeDecision(actor('lab'), 'money.basis', tenantDeal)).toMatchObject({
      allowed: false,
      reason: 'permission-denied',
    });
    expect(platformV7RouteScopeDecision(actor('elevator'), 'money.ledger', tenantDeal)).toMatchObject({
      allowed: false,
      reason: 'permission-denied',
    });
  });

  it('keeps bank on money basis without fake release authority', () => {
    expect(platformV7RouteScopeDecision(actor('bank'), 'money.basis', tenantDeal)).toMatchObject({
      allowed: true,
      action: 'money.basis.review',
      scopeReason: 'tenant-scope',
    });
    expect(platformV7RouteScopeDecision(actor('bank'), 'money.release.request', tenantDeal)).toMatchObject({
      allowed: false,
      reason: 'permission-denied',
      action: 'money.release.request',
    });
  });

  it('keeps arbitrator, compliance, support and operator role-specific', () => {
    expect(platformV7RouteScopeDecision(actor('arbitrator'), 'dispute.update', tenantDeal)).toMatchObject({
      allowed: true,
      scopeReason: 'tenant-scope',
    });
    expect(platformV7RouteScopeDecision(actor('compliance'), 'audit.trail', tenantDeal)).toMatchObject({
      allowed: true,
      scopeReason: 'tenant-scope',
    });
    expect(platformV7RouteScopeDecision(actor('support'), 'support.case', tenantDeal)).toMatchObject({
      allowed: true,
      scopeReason: 'tenant-scope',
    });
    expect(platformV7RouteScopeDecision(actor('operator'), 'deal.edit', tenantDeal)).toMatchObject({
      allowed: true,
      scopeReason: 'tenant-scope',
    });
    expect(platformV7RouteScopeDecision(actor('support'), 'deal.edit', tenantDeal)).toMatchObject({
      allowed: false,
      reason: 'permission-denied',
    });
  });

  it('keeps executive as platform-readonly without write routes', () => {
    expect(platformV7RouteScopeDecision(actor('executive'), 'money.ledger', otherTenantDeal)).toMatchObject({
      allowed: true,
      scopeReason: 'platform-readonly',
    });
    expect(platformV7RouteScopeDecision(actor('executive'), 'deal.edit', tenantDeal)).toMatchObject({
      allowed: false,
      reason: 'permission-denied',
      action: 'deal.write',
    });
  });

  it('rejects cross-tenant tenant-scoped routes', () => {
    expect(platformV7RouteScopeDecision(actor('bank'), 'money.basis', otherTenantDeal)).toMatchObject({
      allowed: false,
      reason: 'scope-rejected',
      scopeReason: 'tenant-rejected',
    });
  });

  it('throws on rejected route scope', () => {
    expect(() => platformV7AssertRouteScope(actor('driver'), 'money.ledger', ownDeal)).toThrow(
      'platform-v7 route scope rejected: permission-denied',
    );
  });
});
