import { Role, type RequestUser } from '../../common/types/request-user';
import { StaffRole } from '../staff-access/staff-access.types';
import {
  decideIntegrationControlTowerAction,
  deriveIntegrationControlTowerPrimaryAction,
  IntegrationControlTowerAction,
} from './regulatory-integration.control-tower.policy';

function user(overrides: Partial<RequestUser> = {}): RequestUser {
  return {
    id: 'user-1',
    orgId: 'org-1',
    tenantId: 'tenant-1',
    membershipId: 'membership-1',
    sessionId: 'session-1',
    role: Role.ADMIN,
    email: 'operator@example.test',
    mfaVerified: true,
    staffRoles: [StaffRole.OPERATIONS_SUPERVISOR],
    ...overrides,
  };
}

describe('Integration Control Tower policy', () => {
  it.each([Role.ADMIN, Role.COMPLIANCE_OFFICER, Role.EXECUTIVE])(
    'allows %s to read only with trusted identity',
    (role) => {
      expect(decideIntegrationControlTowerAction({
        user: user({ role }),
        action: IntegrationControlTowerAction.READ,
      })).toEqual({ allowed: true, reasonCode: 'ALLOWED' });
    },
  );

  it('denies operational roles outside oversight', () => {
    expect(decideIntegrationControlTowerAction({
      user: user({ role: Role.BUYER }),
      action: IntegrationControlTowerAction.READ,
    })).toEqual({ allowed: false, reasonCode: 'ROLE_DENIED' });
  });

  it('denies incomplete server identity before evaluating role', () => {
    expect(decideIntegrationControlTowerAction({
      user: user({ tenantId: undefined }),
      action: IntegrationControlTowerAction.READ,
    })).toEqual({ allowed: false, reasonCode: 'AUTH_CONTEXT_INCOMPLETE' });
  });

  it('requires staff authority, MFA, JIT and human reason for commands', () => {
    expect(decideIntegrationControlTowerAction({
      user: user({ staffRoles: [] }), action: IntegrationControlTowerAction.RECONCILE,
      hasJitAuthority: true, hasHumanReason: true,
    }).reasonCode).toBe('STAFF_AUTHORITY_REQUIRED');
    expect(decideIntegrationControlTowerAction({
      user: user({ mfaVerified: false }), action: IntegrationControlTowerAction.RECONCILE,
      hasJitAuthority: true, hasHumanReason: true,
    }).reasonCode).toBe('MFA_REQUIRED');
    expect(decideIntegrationControlTowerAction({
      user: user(), action: IntegrationControlTowerAction.RECONCILE,
      hasJitAuthority: false, hasHumanReason: true,
    }).reasonCode).toBe('JIT_AUTHORITY_REQUIRED');
    expect(decideIntegrationControlTowerAction({
      user: user(), action: IntegrationControlTowerAction.RECONCILE,
      hasJitAuthority: true, hasHumanReason: false,
    }).reasonCode).toBe('HUMAN_REASON_REQUIRED');
  });

  it('does not allow executive to execute privileged commands', () => {
    expect(decideIntegrationControlTowerAction({
      user: user({ role: Role.EXECUTIVE }), action: IntegrationControlTowerAction.RECONCILE,
      hasJitAuthority: true, hasHumanReason: true,
    })).toEqual({ allowed: false, reasonCode: 'ROLE_DENIED' });
  });

  it('derives exactly one action and preserves disabled authority reason', () => {
    expect(deriveIntegrationControlTowerPrimaryAction(user(), {
      redriveEntryId: 'entry-1', hasJitAuthority: true,
    })).toMatchObject({ id: 'REDRIVE', entryId: 'entry-1', allowed: true });
    expect(deriveIntegrationControlTowerPrimaryAction(user({ role: Role.EXECUTIVE }), {
      redriveEntryId: null, hasJitAuthority: false,
    })).toMatchObject({ id: 'RECONCILE', entryId: null, allowed: false, reasonCode: 'ROLE_DENIED' });
  });
});
