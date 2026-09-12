import { evaluateStaffLifecycleCommand } from './staff-lifecycle.policy';
import {
  StaffLifecycleActor,
  StaffLifecycleCommand,
  StaffLifecycleSubject,
} from './staff-lifecycle.types';

const NOW = new Date('2026-08-22T10:00:00.000Z');

function actor(overrides: Partial<StaffLifecycleActor> = {}): StaffLifecycleActor {
  return {
    tenantId: 'tenant-a',
    actorId: 'owner-1',
    permissions: [
      'staff.lifecycle.invite',
      'staff.lifecycle.activate',
      'staff.lifecycle.suspend',
      'staff.lifecycle.terminate',
      'staff.lifecycle.expire',
      'staff.grant.request',
      'staff.grant.approve',
      'staff.grant.revoke',
    ],
    allowedPermissions: ['deal.read', 'deal.manage', 'audit.read'],
    allowedRoles: ['OPERATOR', 'MANAGER', 'OWNER', 'COMPLIANCE'],
    allowedScopes: ['deals', 'audit', 'staff'],
    mfaLevel: 'PHISHING_RESISTANT',
    sessionIssuedAt: new Date('2026-08-22T09:00:00.000Z'),
    authorityVersion: 7,
    ...overrides,
  };
}

function subject(overrides: Partial<StaffLifecycleSubject> = {}): StaffLifecycleSubject {
  return {
    tenantId: 'tenant-a',
    identityId: 'employee-1',
    state: 'ACTIVE',
    role: 'OPERATOR',
    permissions: ['deal.read'],
    scopes: ['deals'],
    authorityVersion: 7,
    emailVerifiedAt: NOW,
    mfaEnrolledAt: NOW,
    suspendedAt: null,
    terminatedAt: null,
    ...overrides,
  };
}

function command(overrides: Partial<StaffLifecycleCommand> = {}): StaffLifecycleCommand {
  return {
    commandId: 'command-1',
    idempotencyKey: 'test',
    tenantId: 'tenant-a',
    action: 'SUSPEND',
    actor: actor(),
    subject: subject(),
    now: NOW,
    expectedAuthorityVersion: 7,
    ...overrides,
  };
}

describe('staff lifecycle policy', () => {
  it('keeps invitation delivery and email acknowledgement as separate transitions', () => {
    const invited = subject({ state: 'INVITED', emailVerifiedAt: null, mfaEnrolledAt: null });
    expect(evaluateStaffLifecycleCommand(command({ action: 'MARK_INVITATION_DELIVERED', subject: invited }))).toEqual(
      expect.objectContaining({ allowed: true, nextState: 'EMAIL_VERIFICATION_REQUIRED' }),
    );
    const awaitingEmail = subject({ state: 'EMAIL_VERIFICATION_REQUIRED', emailVerifiedAt: NOW, mfaEnrolledAt: null });
    expect(evaluateStaffLifecycleCommand(command({ action: 'ACKNOWLEDGE_EMAIL_VERIFICATION', subject: awaitingEmail }))).toEqual(
      expect.objectContaining({ allowed: true, nextState: 'MFA_ENROLLMENT_REQUIRED' }),
    );
  });

  it('requires verified email and enrolled MFA before activation', () => {
    const awaitingMfa = subject({ state: 'MFA_ENROLLMENT_REQUIRED', emailVerifiedAt: NOW, mfaEnrolledAt: null });
    expect(evaluateStaffLifecycleCommand(command({ action: 'ACTIVATE', subject: awaitingMfa })).denialCode).toBe('MFA_REQUIRED');
  });

  it('allows self-service access requests but still requires independent approval', () => {
    const target = subject();
    const result = evaluateStaffLifecycleCommand(command({
      action: 'REQUEST_ACCESS_GRANT',
      actor: actor({ actorId: target.identityId }),
      subject: target,
      requestedRole: 'MANAGER',
      requestedPermissions: ['deal.manage'],
      requestedScopes: ['deals'],
    }));
    expect(result).toEqual(expect.objectContaining({ allowed: true, requiresIndependentApproval: true }));
  });

  it('rejects self-approval', () => {
    const result = evaluateStaffLifecycleCommand(command({
      action: 'APPROVE_ACCESS_GRANT',
      grant: {
        grantId: 'grant-1', requestedByActorId: 'owner-1', requestedRole: 'MANAGER',
        requestedPermissions: ['deal.manage'], requestedScopes: ['deals'], privileged: true,
        validFrom: NOW, validUntil: null,
      },
    }));
    expect(result.denialCode).toBe('SELF_APPROVAL_FORBIDDEN');
  });

  it('rejects empty permission or scope grant payloads', () => {
    expect(evaluateStaffLifecycleCommand(command({
      action: 'REQUEST_ACCESS_GRANT', requestedRole: 'MANAGER', requestedPermissions: [], requestedScopes: ['deals'],
    })).denialCode).toBe('INVALID_COMMAND');
    expect(evaluateStaffLifecycleCommand(command({
      action: 'REQUEST_ACCESS_GRANT', requestedRole: 'MANAGER', requestedPermissions: ['deal.manage'], requestedScopes: [],
    })).denialCode).toBe('INVALID_COMMAND');
  });

  it('rejects a role outside the current server ceiling', () => {
    const result = evaluateStaffLifecycleCommand(command({
      action: 'REQUEST_ACCESS_GRANT', requestedRole: 'SUPERADMIN',
      requestedPermissions: ['deal.manage'], requestedScopes: ['deals'],
    }));
    expect(result.denialCode).toBe('ROLE_CEILING_EXCEEDED');
  });

  it('rejects permissions and scopes outside server ceilings', () => {
    expect(evaluateStaffLifecycleCommand(command({
      action: 'REQUEST_ACCESS_GRANT', requestedRole: 'MANAGER',
      requestedPermissions: ['root'], requestedScopes: ['deals'],
    })).denialCode).toBe('PERMISSION_CEILING_EXCEEDED');
    expect(evaluateStaffLifecycleCommand(command({
      action: 'REQUEST_ACCESS_GRANT', requestedRole: 'MANAGER',
      requestedPermissions: ['deal.manage'], requestedScopes: ['global'],
    })).denialCode).toBe('SCOPE_CEILING_EXCEEDED');
  });

  it('fails closed across tenant boundaries', () => {
    const result = evaluateStaffLifecycleCommand(command({ subject: subject({ tenantId: 'tenant-b' }) }));
    expect(result.denialCode).toBe('TENANT_BOUNDARY_VIOLATION');
  });

  it('rejects stale authority versions and future-issued sessions', () => {
    expect(evaluateStaffLifecycleCommand(command({ expectedAuthorityVersion: 6 })).denialCode).toBe('AUTHORITY_VERSION_CONFLICT');
    expect(evaluateStaffLifecycleCommand(command({
      actor: actor({ sessionIssuedAt: new Date('2026-08-22T11:00:00.000Z') }),
    })).denialCode).toBe('INVALID_COMMAND');
  });

  it('requires strong MFA for sensitive mutations', () => {
    const result = evaluateStaffLifecycleCommand(command({ actor: actor({ mfaLevel: 'SINGLE_FACTOR' }) }));
    expect(result.denialCode).toBe('MFA_REQUIRED');
  });

  it('revokes sessions on suspension and termination', () => {
    expect(evaluateStaffLifecycleCommand(command())).toEqual(expect.objectContaining({ allowed: true, revokeSessions: true }));
    expect(evaluateStaffLifecycleCommand(command({ action: 'TERMINATE' }))).toEqual(
      expect.objectContaining({ allowed: true, nextState: 'TERMINATED', revokeSessions: true }),
    );
  });

  it('does not permit commands against a terminated identity', () => {
    const result = evaluateStaffLifecycleCommand(command({ subject: subject({ state: 'TERMINATED' }) }));
    expect(result.denialCode).toBe('SUBJECT_TERMINATED');
  });

  it('rejects duplicate and oversized actor authorities', () => {
    expect(evaluateStaffLifecycleCommand(command({
      actor: actor({ allowedRoles: ['MANAGER', 'MANAGER'] }),
    })).denialCode).toBe('INVALID_COMMAND');
    expect(evaluateStaffLifecycleCommand(command({
      actor: actor({ allowedScopes: Array.from({ length: 129 }, (_, index) => `scope-${index}`) }),
    })).denialCode).toBe('INVALID_COMMAND');
  });

  it('rejects expired and inverted grant windows', () => {
    expect(evaluateStaffLifecycleCommand(command({
      action: 'REQUEST_ACCESS_GRANT', requestedRole: 'MANAGER', requestedPermissions: ['deal.manage'],
      requestedScopes: ['deals'], validFrom: new Date('2026-08-21T00:00:00.000Z'), validUntil: NOW,
    })).denialCode).toBe('GRANT_NOT_EFFECTIVE');
    expect(evaluateStaffLifecycleCommand(command({
      action: 'REQUEST_ACCESS_GRANT', requestedRole: 'MANAGER', requestedPermissions: ['deal.manage'],
      requestedScopes: ['deals'], validFrom: new Date('2026-08-23T00:00:00.000Z'), validUntil: NOW,
    })).denialCode).toBe('INVALID_COMMAND');
  });
});
