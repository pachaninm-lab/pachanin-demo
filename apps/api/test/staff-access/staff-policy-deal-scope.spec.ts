import { PolicyEngineService } from '../../src/common/security/policy-engine.service';

describe('staff policy exact deal scope', () => {
  const engine = new PolicyEngineService();
  const base = {
    action: 'deal:read',
    user: {
      id: 'staff-owner',
      role: 'ADMIN',
      organizationId: 'platform-org',
      tenantId: 'tenant-a',
      mfaVerified: true,
    },
    staffAccess: {
      actorUserId: 'staff-owner',
      accessMode: 'VIEW_AS',
      permissions: ['deal:read'],
      effectiveTenantId: 'tenant-a',
      effectiveOrganizationId: 'buyer-org',
      effectiveUserId: null,
      targetDealId: 'deal-a',
      expiresAt: new Date(Date.now() + 60_000),
    },
  };

  it('allows the exact deal bound to the grant', () => {
    const result = engine.evaluate({
      ...base,
      resource: {
        type: 'Deal',
        id: 'deal-a',
        tenantId: 'tenant-a',
        organizationId: 'buyer-org',
        buyerOrgId: 'buyer-org',
      },
    });
    expect(result.allowed).toBe(true);
    expect(result.matchedPolicy).toBe('allow.staff.scoped-grant');
  });

  it('denies reuse of the same session for another deal', () => {
    const result = engine.evaluate({
      ...base,
      resource: {
        type: 'Deal',
        id: 'deal-b',
        tenantId: 'tenant-a',
        organizationId: 'buyer-org',
        buyerOrgId: 'buyer-org',
      },
    });
    expect(result.allowed).toBe(false);
    expect(result.matchedPolicy).toBe('deny.staff.invalid-or-cross-scope');
  });

  it('denies actor substitution even when the target scope matches', () => {
    const result = engine.evaluate({
      ...base,
      user: { ...base.user, id: 'different-staff-user' },
      resource: {
        type: 'Deal',
        id: 'deal-a',
        tenantId: 'tenant-a',
        organizationId: 'buyer-org',
        buyerOrgId: 'buyer-org',
      },
    });
    expect(result.allowed).toBe(false);
    expect(result.matchedPolicy).toBe('deny.staff.invalid-or-cross-scope');
  });
});
