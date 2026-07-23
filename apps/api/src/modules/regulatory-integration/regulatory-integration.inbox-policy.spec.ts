import {
  RegulatoryInboxAuthorityError,
  assertRegulatoryInboxIdentityAuthority,
  assertRegulatoryInboxLeaseConsistency,
  decideRegulatoryInboxClaim,
  decideRegulatoryInboxInsert,
  type RegulatoryInboxIdentity,
  type RegulatoryInboxLeaseSnapshot,
} from './regulatory-integration.inbox-policy';

const context = {
  tenantId: 'tenant-1',
  organizationId: 'organization-1',
} as const;

function identity(
  overrides: Partial<RegulatoryInboxIdentity> = {},
): RegulatoryInboxIdentity {
  return {
    ...context,
    provider: 'provider-1',
    externalEventId: 'event-1',
    rawBodySha256: 'a'.repeat(64),
    ...overrides,
  };
}

function lease(
  overrides: Partial<RegulatoryInboxLeaseSnapshot> = {},
): RegulatoryInboxLeaseSnapshot {
  return {
    state: 'VERIFIED',
    attempts: 0,
    nextAttemptAt: null,
    leaseOwner: null,
    leaseExpiresAt: null,
    ...overrides,
  };
}

describe('regulatory integration inbox authority policy', () => {
  it('rejects client-selected tenant and organization identity', () => {
    expect(() => assertRegulatoryInboxIdentityAuthority(
      context,
      identity({ tenantId: 'tenant-2' }),
    )).toThrow('tenant authority mismatch');

    expect(() => assertRegulatoryInboxIdentityAuthority(
      context,
      identity({ organizationId: 'organization-2' }),
    )).toThrow('organization authority mismatch');
  });

  it('distinguishes insert, deterministic replay and security conflict', () => {
    expect(decideRegulatoryInboxInsert(null, identity())).toBe('INSERT');
    expect(decideRegulatoryInboxInsert(identity(), identity()))
      .toBe('DETERMINISTIC_REPLAY');
    expect(decideRegulatoryInboxInsert(
      identity(),
      identity({ rawBodySha256: 'b'.repeat(64) }),
    )).toBe('SECURITY_CONFLICT');
  });

  it('rejects replay comparison across different durable identities', () => {
    expect(() => decideRegulatoryInboxInsert(
      identity(),
      identity({ externalEventId: 'event-2' }),
    )).toThrow(RegulatoryInboxAuthorityError);
  });

  it('claims verified, due retry and expired processing leases', () => {
    const now = new Date('2026-07-23T05:00:00.000Z');

    expect(decideRegulatoryInboxClaim(lease(), now)).toBe('CLAIM');
    expect(decideRegulatoryInboxClaim(lease({
      state: 'RETRY',
      attempts: 2,
      nextAttemptAt: new Date('2026-07-23T04:59:00.000Z'),
    }), now)).toBe('CLAIM');
    expect(decideRegulatoryInboxClaim(lease({
      state: 'PROCESSING',
      attempts: 1,
      leaseOwner: 'worker-1',
      leaseExpiresAt: new Date('2026-07-23T04:59:00.000Z'),
    }), now)).toBe('CLAIM');
  });

  it('does not claim active leases, future retries or terminal rows', () => {
    const now = new Date('2026-07-23T05:00:00.000Z');

    expect(decideRegulatoryInboxClaim(lease({
      state: 'PROCESSING',
      attempts: 1,
      leaseOwner: 'worker-1',
      leaseExpiresAt: new Date('2026-07-23T05:01:00.000Z'),
    }), now)).toBe('ACTIVE_LEASE');
    expect(decideRegulatoryInboxClaim(lease({
      state: 'RETRY',
      attempts: 1,
      nextAttemptAt: new Date('2026-07-23T05:01:00.000Z'),
    }), now)).toBe('NOT_DUE');
    expect(decideRegulatoryInboxClaim(lease({
      state: 'PROCESSED',
    }), now)).toBe('TERMINAL_STATE');
  });

  it.each([
    lease({ attempts: -1 }),
    lease({ state: 'PROCESSING' }),
    lease({ state: 'VERIFIED', leaseOwner: 'worker-1' }),
    lease({
      state: 'VERIFIED',
      leaseOwner: 'worker-1',
      leaseExpiresAt: new Date('2026-07-23T05:01:00.000Z'),
    }),
    lease({ state: 'RETRY' }),
    lease({
      state: 'VERIFIED',
      nextAttemptAt: new Date('2026-07-23T05:01:00.000Z'),
    }),
  ])('fails closed for inconsistent lease/retry snapshot %#', (snapshot) => {
    expect(() => assertRegulatoryInboxLeaseConsistency(snapshot))
      .toThrow(RegulatoryInboxAuthorityError);
  });

  it('accepts internally consistent processing and retry snapshots', () => {
    expect(() => assertRegulatoryInboxLeaseConsistency(lease({
      state: 'PROCESSING',
      attempts: 1,
      leaseOwner: 'worker-1',
      leaseExpiresAt: new Date('2026-07-23T05:01:00.000Z'),
    }))).not.toThrow();

    expect(() => assertRegulatoryInboxLeaseConsistency(lease({
      state: 'RETRY',
      attempts: 2,
      nextAttemptAt: new Date('2026-07-23T05:01:00.000Z'),
    }))).not.toThrow();
  });
});
