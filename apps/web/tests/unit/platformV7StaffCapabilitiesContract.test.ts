import { describe, expect, it } from 'vitest';
import { parseStaffCapabilitiesContract } from '@/lib/platform-v7/staff-capabilities';

function validContract() {
  return {
    identity: {
      id: 'staff-1',
      email: 'staff@example.test',
      fullName: 'Staff User',
    },
    assignments: [{
      id: 'assignment-1',
      role: 'OPERATIONS_AGENT',
      status: 'ACTIVE',
      validFrom: '2026-08-14T21:00:00.000Z',
      validUntil: null,
    }],
    roles: ['OPERATIONS_AGENT'],
    capabilities: ['deal:read', 'deal:list'],
    workspaces: ['EMPLOYEE', 'OPERATIONS'],
    scopes: [],
    authenticationAssurance: {
      mfaVerified: true,
      mfaVerifiedAt: '2026-08-14T21:20:00.000Z',
      recentMfa: true,
    },
    activeAccessSessions: [],
  };
}

describe('platform-v7 staff capabilities contract', () => {
  it('accepts a complete server-authoritative contract', () => {
    expect(parseStaffCapabilitiesContract(validContract())).toEqual(validContract());
  });

  it('fails closed when the server does not prove MFA', () => {
    expect(parseStaffCapabilitiesContract({
      ...validContract(),
      authenticationAssurance: {
        ...validContract().authenticationAssurance,
        mfaVerified: false,
      },
    })).toBeNull();
  });

  it('fails closed when durable assignments or roles are empty', () => {
    expect(parseStaffCapabilitiesContract({
      ...validContract(),
      assignments: [],
    })).toBeNull();
    expect(parseStaffCapabilitiesContract({
      ...validContract(),
      roles: [],
    })).toBeNull();
  });

  it('fails closed on malformed privileged-session scope data', () => {
    expect(parseStaffCapabilitiesContract({
      ...validContract(),
      scopes: [{
        accessSessionId: 'session-1',
        accessMode: 'OPERATIONS',
        effectiveTenantId: { forged: true },
        effectiveOrganizationId: null,
        effectiveUserId: null,
        effectiveRole: null,
        targetDealId: null,
        expiresAt: '2026-08-14T22:00:00.000Z',
      }],
    })).toBeNull();
  });
});
