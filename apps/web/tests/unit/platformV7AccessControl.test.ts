import { describe, expect, it } from 'vitest';
import {
  PlatformRbacError,
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
import {
  PLATFORM_V7_CANONICAL_ROLE_NAMES,
  toPlatformV7CanonicalRole,
} from '@/lib/platform-v7/role-canonical';

const actor = (activeRole: PlatformV7AccessActor['activeRole'], organizationId = 'org-1', userId = 'user-1'): PlatformV7AccessActor => ({
  userId,
  organizationId,
  roles: [activeRole],
  activeRole,
});

describe('platform-v7 access control foundation', () => {
  it('maps role aliases to one canonical role system', () => {
    expect(toPlatformV7CanonicalRole('supportAgent')).toBe('support_agent');
    expect(toPlatformV7CanonicalRole('support_agent')).toBe('support_agent');
    expect(PLATFORM_V7_CANONICAL_ROLE_NAMES.support_agent).toBe('SupportAgent');
    expect(toPlatformV7CanonicalRole('bank')).toBe('bank_officer');
    expect(toPlatformV7CanonicalRole('executive')).toBe('executive_viewer');
  });

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
      auditCode: 'EXPLICIT_DENY',
    });
  });

  it('allows SupportAgent to work linked support cases but never release money', () => {
    const support = actor('support_agent', 'support-org');

    expect(platformV7Can({
      actor: support,
      action: 'update',
      resource: {
        resourceType: 'supportCase',
        resourceId: 'case-1',
        supportOrganizationId: 'support-org',
      },
    })).toBe(true);

    expect(platformV7Can({
      actor: support,
      action: 'read',
      resource: {
        resourceType: 'deal',
        resourceId: 'deal-1',
        linkedOrganizationIds: ['support-org'],
      },
    })).toBe(true);

    for (const action of ['release', 'CONFIRM_BANK_RESERVE', 'CONFIRM_BANK_RELEASE', 'CONFIRM_BANK_REFUND'] as const) {
      expect(canPerformAction({
        actor: support,
        action,
        resource: { resourceType: 'money', resourceId: 'money-1', bankOrganizationId: 'bank-a' },
      }), action).toMatchObject({
        allowed: false,
        auditCode: 'EXPLICIT_DENY',
      });
    }
  });

  it('explicitly denies Arbitrator money access while allowing dispute decisions', () => {
    const arbitrator = actor('arbitrator');

    expect(platformV7Can({
      actor: arbitrator,
      action: 'decide',
      resource: { resourceType: 'dispute', resourceId: 'dispute-1' },
    })).toBe(true);

    for (const action of ['read', 'EXECUTE_RELEASE', 'EXECUTE_REFUND', 'CONFIRM_BANK_RELEASE'] as const) {
      expect(canPerformAction({
        actor: arbitrator,
        action,
        resource: { resourceType: 'money', resourceId: 'money-1', bankOrganizationId: 'bank-a' },
      }), action).toMatchObject({
        allowed: false,
        auditCode: 'EXPLICIT_DENY',
      });
    }

    expect(canPerformAction({
      actor: arbitrator,
      action: 'CONFIRM_BANK_RELEASE',
      resource: { resourceType: 'bank', resourceId: 'bank-action-1', bankOrganizationId: 'bank-a' },
    })).toMatchObject({
      allowed: false,
      auditCode: 'EXPLICIT_DENY',
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

    expect(() => assertPermission(request)).toThrow(PlatformRbacError);
    expect(() => assertPermission(request)).toThrow(PlatformV7PermissionError);

    expect(auditDeniedAccess(request)).toMatchObject({
      eventType: 'access.denied',
      auditCode: 'EXPLICIT_DENY',
      actorId: 'user-1',
      role: 'arbitrator',
      resource: { resourceType: 'money', resourceId: 'money-1', bankOrganizationId: 'bank-a' },
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

  it('denies by default for unknown resources and actions', () => {
    expect(canPerformAction({
      actor: actor('operator'),
      action: 'unknown_action' as never,
      resource: { resourceType: 'unknown_resource' as never, resourceId: 'unknown-1' },
    })).toMatchObject({
      allowed: false,
      auditCode: 'DENY_BY_DEFAULT',
    });
  });

  it('keeps bank, driver, executive and physical roles inside explicit negative boundaries', () => {
    expect(platformV7Can({
      actor: actor('driver', 'carrier-a', 'driver-1'),
      action: 'read',
      resource: { resourceType: 'trip', resourceId: 'trip-1', assignedDriverUserId: 'driver-1' },
    })).toBe(true);
    expect(platformV7Can({
      actor: actor('driver', 'carrier-a', 'driver-1'),
      action: 'read',
      resource: { resourceType: 'trip', resourceId: 'trip-2', assignedDriverUserId: 'driver-2' },
    })).toBe(false);
    expect(canPerformAction({
      actor: actor('bankOfficer', 'bank-a'),
      action: 'read',
      resource: { resourceType: 'driverField', resourceId: 'trip-1', assignedDriverUserId: 'driver-1' },
    })).toMatchObject({ allowed: false, auditCode: 'EXPLICIT_DENY' });
    expect(canPerformAction({
      actor: actor('executiveViewer'),
      action: 'read',
      resource: { resourceType: 'money', resourceId: 'money-1' },
    })).toMatchObject({ allowed: false, auditCode: 'EXPLICIT_DENY' });
    expect(canPerformAction({
      actor: actor('labSpecialist', 'lab-a'),
      action: 'update',
      resource: { resourceType: 'money', resourceId: 'money-1', assignedLabOrganizationId: 'lab-a' },
    })).toMatchObject({ allowed: false, auditCode: 'EXPLICIT_DENY' });
    expect(canPerformAction({
      actor: actor('elevatorOperator', 'elevator-a'),
      action: 'update',
      resource: { resourceType: 'labProtocol', resourceId: 'lab-1', assignedElevatorOrganizationId: 'elevator-a' },
    })).toMatchObject({ allowed: false, auditCode: 'EXPLICIT_DENY' });
  });

  it('denies seller and buyer bank reserve, release and refund confirmations', () => {
    for (const role of ['seller', 'buyer'] as const) {
      for (const action of ['CONFIRM_BANK_RESERVE', 'CONFIRM_BANK_RELEASE', 'CONFIRM_BANK_REFUND'] as const) {
        expect(canPerformAction({
          actor: actor(role, `${role}-org`),
          action,
          resource: { resourceType: 'money', resourceId: 'money-1', ownerOrganizationId: `${role}-org` },
        }), `${role}:${action}`).toMatchObject({
          allowed: false,
          auditCode: 'EXPLICIT_DENY',
        });
      }
    }
  });
});
