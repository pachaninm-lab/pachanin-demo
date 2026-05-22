import { describe, expect, it } from 'vitest';
import {
  PlatformV7PermissionError,
  assertPermission,
  auditDeniedAccess,
  canAccessResource,
  canPerformAction,
  getEffectivePermissions,
  platformV7AccessDecision,
  platformV7Can,
  type PlatformV7AccessActor,
} from '@/lib/platform-v7/access-control';

const actor = (activeRole: PlatformV7AccessActor['activeRole'], organizationId = 'org-1', userId = 'user-1'): PlatformV7AccessActor => ({
  userId,
  organizationId,
  roles: [activeRole],
  activeRole,
});

describe('platform-v7 access control foundation', () => {
  it('denies by default when no object-scope policy matches', () => {
    const decision = platformV7AccessDecision({
      actor: actor('seller', 'seller-a'),
      action: 'read',
      resource: { resourceType: 'deal', resourceId: 'deal-1', sellerOrganizationId: 'seller-b' },
    });

    expect(decision.allowed).toBe(false);
    expect(decision.auditCode).toBe('DENY_BY_DEFAULT');
  });

  it('denies active roles not granted by membership', () => {
    const decision = platformV7AccessDecision({
      actor: { userId: 'user-1', organizationId: 'org-1', roles: ['seller'], activeRole: 'buyer' },
      action: 'read',
      resource: { resourceType: 'rfq', resourceId: 'rfq-1', ownerOrganizationId: 'org-1' },
    });

    expect(decision.allowed).toBe(false);
    expect(decision.auditCode).toBe('ROLE_NOT_GRANTED');
  });

  it('allows seller to work only with own organization sell-side objects', () => {
    expect(platformV7Can({
      actor: actor('seller', 'seller-a'),
      action: 'create',
      resource: { resourceType: 'lot', resourceId: 'lot-1', ownerOrganizationId: 'seller-a' },
    })).toBe(true);

    expect(platformV7Can({
      actor: actor('seller', 'seller-a'),
      action: 'read',
      resource: { resourceType: 'deal', resourceId: 'deal-1', sellerOrganizationId: 'seller-a' },
    })).toBe(true);

    expect(platformV7Can({
      actor: actor('seller', 'seller-a'),
      action: 'read',
      resource: { resourceType: 'deal', resourceId: 'deal-2', sellerOrganizationId: 'seller-b' },
    })).toBe(false);
  });

  it('allows buyer to request money only on buyer-scoped deal money objects', () => {
    expect(platformV7Can({
      actor: actor('buyer', 'buyer-a'),
      action: 'request',
      resource: { resourceType: 'money', resourceId: 'money-1', buyerOrganizationId: 'buyer-a' },
    })).toBe(true);

    expect(platformV7Can({
      actor: actor('buyer', 'buyer-a'),
      action: 'release',
      resource: { resourceType: 'money', resourceId: 'money-1', buyerOrganizationId: 'buyer-a' },
    })).toBe(false);
  });

  it('keeps driver isolated to the assigned trip and evidence only', () => {
    expect(platformV7Can({
      actor: actor('driver', 'carrier-a', 'driver-1'),
      action: 'confirm',
      resource: { resourceType: 'trip', resourceId: 'trip-1', assignedDriverUserId: 'driver-1' },
    })).toBe(true);

    expect(platformV7Can({
      actor: actor('driver', 'carrier-a', 'driver-1'),
      action: 'read',
      resource: { resourceType: 'trip', resourceId: 'trip-2', assignedDriverUserId: 'driver-2' },
    })).toBe(false);

    expect(platformV7Can({
      actor: actor('driver', 'carrier-a', 'driver-1'),
      action: 'read',
      resource: { resourceType: 'money', resourceId: 'money-1', assignedDriverUserId: 'driver-1' },
    })).toBe(false);
  });

  it('allows bank only within its money and document basis scope', () => {
    expect(platformV7Can({
      actor: actor('bankOfficer', 'bank-a'),
      action: 'release',
      resource: { resourceType: 'money', resourceId: 'money-1', bankOrganizationId: 'bank-a' },
    })).toBe(true);

    expect(platformV7Can({
      actor: actor('bankOfficer', 'bank-a'),
      action: 'release',
      resource: { resourceType: 'money', resourceId: 'money-2', bankOrganizationId: 'bank-b' },
    })).toBe(false);

    expect(platformV7Can({
      actor: actor('bankOfficer', 'bank-a'),
      action: 'update',
      resource: { resourceType: 'deal', resourceId: 'deal-1', bankOrganizationId: 'bank-a' },
    })).toBe(false);
  });

  it('keeps executive viewer read-only and aggregate-only', () => {
    expect(platformV7Can({
      actor: actor('executiveViewer'),
      action: 'read',
      resource: { resourceType: 'aggregateReport', resourceId: 'agg-1' },
    })).toBe(true);

    expect(platformV7Can({
      actor: actor('executiveViewer'),
      action: 'update',
      resource: { resourceType: 'deal', resourceId: 'deal-1' },
    })).toBe(false);

    expect(platformV7Can({
      actor: actor('executiveViewer'),
      action: 'read',
      resource: { resourceType: 'deal', resourceId: 'deal-1' },
    })).toBe(false);
  });

  it('exposes the production-like RBAC facade names over the same deny-by-default policy', () => {
    const bank = actor('bankOfficer', 'bank-a');

    expect(canAccessResource(bank, { resourceType: 'deal', resourceId: 'deal-1', bankOrganizationId: 'bank-a' })).toMatchObject({
      allowed: true,
      auditCode: 'ALLOW_BY_POLICY',
    });

    expect(canPerformAction({
      actor: actor('supportAgent', 'support-a'),
      action: 'release',
      resource: { resourceType: 'money', resourceId: 'money-1', bankOrganizationId: 'bank-a' },
    })).toMatchObject({
      allowed: false,
      auditCode: 'DENY_BY_DEFAULT',
    });
  });

  it('returns effective permissions only inside the object scope of the active role', () => {
    expect(getEffectivePermissions(
      actor('driver', 'carrier-a', 'driver-1'),
      { resourceType: 'trip', resourceId: 'trip-1', assignedDriverUserId: 'driver-1' },
    ).map((permission) => permission.action)).toEqual(['read', 'update', 'confirm']);

    expect(getEffectivePermissions(
      actor('driver', 'carrier-a', 'driver-1'),
      { resourceType: 'money', resourceId: 'money-1', assignedDriverUserId: 'driver-1' },
    )).toEqual([]);

    expect(getEffectivePermissions(
      actor('platformAdmin'),
      { resourceType: 'money', resourceId: 'money-1', bankOrganizationId: 'bank-a' },
    )).toEqual([]);
  });

  it('throws and emits audit payloads for denied access without granting the action', () => {
    const request = {
      actor: actor('arbitrator'),
      action: 'release' as const,
      resource: { resourceType: 'money' as const, resourceId: 'money-1', bankOrganizationId: 'bank-a' },
      correlationId: 'corr-1',
      auditId: 'audit-1',
    };

    expect(() => assertPermission(request)).toThrow(PlatformV7PermissionError);

    expect(auditDeniedAccess(request)).toMatchObject({
      eventType: 'access.denied',
      auditCode: 'DENY_BY_DEFAULT',
      actorId: 'user-1',
      role: 'arbitrator',
      action: 'release',
      resourceType: 'money',
      resourceId: 'money-1',
      correlationId: 'corr-1',
      auditId: 'audit-1',
    });

    expect(auditDeniedAccess({
      actor: actor('bankOfficer', 'bank-a'),
      action: 'release',
      resource: { resourceType: 'money', resourceId: 'money-2', bankOrganizationId: 'bank-a' },
    })).toBeNull();
  });
});
