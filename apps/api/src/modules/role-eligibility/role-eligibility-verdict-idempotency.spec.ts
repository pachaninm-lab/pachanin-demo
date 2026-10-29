import { verdictPublicationIdempotencyKey } from './role-eligibility.repository';
import type { EligibilityCheck } from './role-eligibility.types';

type PublicationCheck = Pick<
  EligibilityCheck,
  'applicationId' | 'applicationVersion' | 'requestedRole' | 'policyVersion' | 'policyHash' | 'requestKey'
>;

const baseCheck: PublicationCheck = {
  applicationId: 'app-bank-1',
  applicationVersion: 1n,
  requestedRole: 'ACCOUNTING',
  policyVersion: '2026-09-02.v1',
  policyHash: 'a'.repeat(64),
  requestKey: 'b'.repeat(64),
};

const emptyManifestHash = 'c'.repeat(64);

describe('Role Eligibility verdict publication idempotency', () => {
  it('replays the same immutable logical check with the same key', () => {
    expect(verdictPublicationIdempotencyKey(baseCheck, emptyManifestHash)).toBe(
      verdictPublicationIdempotencyKey({ ...baseCheck }, emptyManifestHash),
    );
  });

  it('allows a newer logical check to publish even when the source manifest is unchanged', () => {
    const recoveredCheck: PublicationCheck = {
      ...baseCheck,
      requestKey: 'd'.repeat(64),
    };

    expect(verdictPublicationIdempotencyKey(recoveredCheck, emptyManifestHash)).not.toBe(
      verdictPublicationIdempotencyKey(baseCheck, emptyManifestHash),
    );
  });

  it('still binds publication identity to the immutable source manifest', () => {
    expect(verdictPublicationIdempotencyKey(baseCheck, 'e'.repeat(64))).not.toBe(
      verdictPublicationIdempotencyKey(baseCheck, emptyManifestHash),
    );
  });
});
