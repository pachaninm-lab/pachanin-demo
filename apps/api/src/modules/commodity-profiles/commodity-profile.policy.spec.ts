import { Role, type RequestUser } from '../../common/types/request-user';
import {
  CommodityProfileAction,
  decideCommodityProfileAction,
  deriveCommodityProfileActions,
} from './commodity-profile.policy';

function user(role: RequestUser['role'], overrides: Partial<RequestUser> = {}): RequestUser {
  return {
    id: 'user-1',
    orgId: 'org-1',
    role,
    email: 'user@example.test',
    sessionId: 'session-1',
    membershipId: 'membership-1',
    tenantId: 'tenant-1',
    staffRoles: [],
    ...overrides,
  };
}

describe('commodity profile policy', () => {
  it.each([
    Role.FARMER,
    Role.BUYER,
    Role.LOGISTICIAN,
    Role.DRIVER,
    Role.SURVEYOR,
    Role.LAB,
    Role.ELEVATOR,
    Role.ACCOUNTING,
    Role.EXECUTIVE,
    Role.SUPPORT_MANAGER,
    Role.ADMIN,
    Role.COMPLIANCE_OFFICER,
    Role.ARBITRATOR,
  ])('permits platform registry read for %s', (role) => {
    expect(decideCommodityProfileAction({
      user: user(role),
      action: CommodityProfileAction.READ,
      classification: 'INTERNAL',
    })).toEqual({ allowed: true, reasonCode: 'ALLOWED' });
  });

  it('denies confidential profile content to ordinary commercial role', () => {
    expect(decideCommodityProfileAction({
      user: user(Role.BUYER),
      action: CommodityProfileAction.READ,
      classification: 'COMMERCIAL_SECRET',
    }).reasonCode).toBe('CLASSIFICATION_DENIED');
  });

  it('denies write when server identity context is incomplete', () => {
    expect(decideCommodityProfileAction({
      user: user(Role.ADMIN, { membershipId: undefined }),
      action: CommodityProfileAction.UPDATE_DRAFT,
      lifecycle: 'DRAFT',
      hasHumanReason: true,
    }).reasonCode).toBe('AUTH_CONTEXT_INCOMPLETE');
  });

  it('requires staff authority for draft editing', () => {
    expect(decideCommodityProfileAction({
      user: user(Role.SUPPORT_MANAGER),
      action: CommodityProfileAction.UPDATE_DRAFT,
      lifecycle: 'DRAFT',
      hasHumanReason: true,
    }).reasonCode).toBe('STAFF_AUTHORITY_REQUIRED');
  });

  it('requires human reason for every write', () => {
    expect(decideCommodityProfileAction({
      user: user(Role.ADMIN, { staffRoles: ['COMMODITY_PROFILE_EDITOR'] }),
      action: CommodityProfileAction.SUBMIT_REVIEW,
      lifecycle: 'DRAFT',
      hasHumanReason: false,
    }).reasonCode).toBe('HUMAN_REASON_REQUIRED');
  });

  it('requires MFA and JIT for approval', () => {
    const actor = user(Role.COMPLIANCE_OFFICER, {
      staffRoles: ['COMPLIANCE_CONTROL'],
      mfaVerified: false,
    });
    expect(decideCommodityProfileAction({
      user: actor,
      action: CommodityProfileAction.APPROVE,
      lifecycle: 'REVIEW',
      hasHumanReason: true,
      hasJitAuthority: true,
    }).reasonCode).toBe('MFA_REQUIRED');

    expect(decideCommodityProfileAction({
      user: { ...actor, mfaVerified: true },
      action: CommodityProfileAction.APPROVE,
      lifecycle: 'REVIEW',
      hasHumanReason: true,
      hasJitAuthority: false,
    }).reasonCode).toBe('JIT_AUTHORITY_REQUIRED');
  });

  it('allows privileged transition only with full server authority', () => {
    expect(decideCommodityProfileAction({
      user: user(Role.COMPLIANCE_OFFICER, {
        staffRoles: ['COMPLIANCE_CONTROL'],
        mfaVerified: true,
      }),
      action: CommodityProfileAction.ACTIVATE,
      lifecycle: 'APPROVED',
      hasHumanReason: true,
      hasJitAuthority: true,
    })).toEqual({ allowed: true, reasonCode: 'ALLOWED' });
  });

  it('rejects lifecycle-invalid command before role evaluation', () => {
    expect(decideCommodityProfileAction({
      user: user(Role.ADMIN, {
        staffRoles: ['PLATFORM_ADMIN'],
        mfaVerified: true,
      }),
      action: CommodityProfileAction.ACTIVATE,
      lifecycle: 'DRAFT',
      hasHumanReason: true,
      hasJitAuthority: true,
    }).reasonCode).toBe('INVALID_LIFECYCLE_ACTION');
  });

  it('derives deterministic actions and marks consequential actions for confirmation', () => {
    const actions = deriveCommodityProfileActions(
      user(Role.COMPLIANCE_OFFICER, {
        staffRoles: ['COMPLIANCE_CONTROL'],
        mfaVerified: true,
      }),
      'APPROVED',
      'INTERNAL',
      true,
    );
    expect(actions.map((action) => action.id)).toEqual([
      'UPDATE_DRAFT',
      'SUBMIT_REVIEW',
      'APPROVE',
      'ACTIVATE',
      'DEPRECATE',
      'REVOKE',
    ]);
    expect(actions.find((action) => action.id === 'ACTIVATE')).toMatchObject({
      allowed: true,
      requiresConfirmation: true,
      impact: 'HIGH',
      owner: 'COMPLIANCE',
    });
  });
});
