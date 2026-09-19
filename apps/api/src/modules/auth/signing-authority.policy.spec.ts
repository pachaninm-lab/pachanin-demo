import { Capability } from './membership-capability.resolver';
import {
  DEFAULT_MFA_MAX_AGE_SECONDS,
  SigningAuthorityType,
  SigningDenyReason,
  SigningMode,
  type SigningAuthorityRecord,
  type SigningRequest,
  canSign,
  evaluateSigningAuthority,
} from './signing-authority.policy';

const NOW = new Date('2026-08-15T12:00:00.000Z');

function authority(
  overrides: Partial<SigningAuthorityRecord> = {},
): SigningAuthorityRecord {
  return {
    organizationId: 'org-1',
    tenantId: 'tenant-1',
    membershipId: 'membership-1',
    authorityType: SigningAuthorityType.ORGANIZATION_HEAD,
    mchdReference: null,
    validFrom: new Date('2026-01-01T00:00:00.000Z'),
    validTo: new Date('2027-01-01T00:00:00.000Z'),
    allowedDocumentTypes: ['UPD', 'ACCEPTANCE_ACT'],
    amountLimitKopecks: 100_000_000n, // 1 000 000 ₽
    certificateFingerprint: 'fp-good',
    allowedSigningModes: [SigningMode.PROVIDER_UI, SigningMode.LOCAL_CSP],
    status: 'ACTIVE',
    ...overrides,
  };
}

function request(overrides: Partial<SigningRequest> = {}): SigningRequest {
  return {
    tenantId: 'tenant-1',
    organizationId: 'org-1',
    membershipId: 'membership-1',
    membershipStatus: 'ACTIVE',
    userStatus: 'ACTIVE',
    capabilities: new Set([Capability.DOCUMENTS_READ]),
    documentType: 'UPD',
    documentAmountKopecks: 50_000_000n,
    documentIsStale: false,
    mfaVerifiedAt: new Date(NOW.getTime() - 60_000),
    certificate: {
      fingerprint: 'fp-good',
      status: 'VALID',
      validFrom: new Date('2026-01-01T00:00:00.000Z'),
      validUntil: new Date('2027-01-01T00:00:00.000Z'),
    },
    signingMode: SigningMode.PROVIDER_UI,
    now: NOW,
    ...overrides,
  };
}

describe('signing authority policy', () => {
  describe('the permitted path', () => {
    it('allows a valid head-of-organization signature', () => {
      const decision = evaluateSigningAuthority(request(), authority());
      expect(decision.reasons).toEqual([]);
      expect(decision.allowed).toBe(true);
    });

    it('allows a delegated signer that carries a power-of-attorney reference', () => {
      expect(
        canSign(
          request(),
          authority({
            authorityType: SigningAuthorityType.MCHD_DELEGATED,
            mchdReference: 'MCHD-2026-0001',
          }),
        ),
      ).toBe(true);
    });

    it('treats a null amount limit as no monetary ceiling', () => {
      expect(
        canSign(
          request({ documentAmountKopecks: 999_999_999_999n }),
          authority({ amountLimitKopecks: null }),
        ),
      ).toBe(true);
    });

    it('allows a signature exactly at the amount limit', () => {
      expect(
        canSign(
          request({ documentAmountKopecks: 100_000_000n }),
          authority({ amountLimitKopecks: 100_000_000n }),
        ),
      ).toBe(true);
    });
  });

  describe('deny by default', () => {
    it('refuses when no authority record exists', () => {
      const decision = evaluateSigningAuthority(request(), null);
      expect(decision.allowed).toBe(false);
      expect(decision.reasons).toContain(SigningDenyReason.AUTHORITY_MISSING);
    });

    it('refuses when the authority record is undefined', () => {
      expect(canSign(request(), undefined)).toBe(false);
    });

    it('refuses an empty allowed-document-type list rather than treating it as any', () => {
      const decision = evaluateSigningAuthority(
        request(),
        authority({ allowedDocumentTypes: [] }),
      );
      expect(decision.reasons).toContain(
        SigningDenyReason.DOCUMENT_TYPE_NOT_PERMITTED,
      );
    });

    it('reports every blocker at once, not just the first', () => {
      const decision = evaluateSigningAuthority(
        request({
          membershipStatus: 'REVOKED',
          documentIsStale: true,
          mfaVerifiedAt: null,
          documentType: 'UNKNOWN_TYPE',
        }),
        authority({ status: 'REVOKED' }),
      );
      expect(decision.reasons).toEqual(
        expect.arrayContaining([
          SigningDenyReason.MEMBERSHIP_NOT_ACTIVE,
          SigningDenyReason.DOCUMENT_STALE,
          SigningDenyReason.MFA_REQUIRED,
          SigningDenyReason.DOCUMENT_TYPE_NOT_PERMITTED,
          SigningDenyReason.AUTHORITY_NOT_ACTIVE,
        ]),
      );
    });
  });

  describe('identity and scope', () => {
    it('refuses a revoked membership', () => {
      const decision = evaluateSigningAuthority(
        request({ membershipStatus: 'REVOKED' }),
        authority(),
      );
      expect(decision.reasons).toContain(SigningDenyReason.MEMBERSHIP_NOT_ACTIVE);
    });

    it('refuses a blocked user account', () => {
      const decision = evaluateSigningAuthority(
        request({ userStatus: 'BLOCKED' }),
        authority(),
      );
      expect(decision.reasons).toContain(SigningDenyReason.USER_NOT_ACTIVE);
    });

    it('refuses an authority issued for another tenant', () => {
      const decision = evaluateSigningAuthority(
        request(),
        authority({ tenantId: 'tenant-2' }),
      );
      expect(decision.reasons).toContain(SigningDenyReason.TENANT_MISMATCH);
    });

    it('refuses an authority issued for another organization', () => {
      const decision = evaluateSigningAuthority(
        request(),
        authority({ organizationId: 'org-2' }),
      );
      expect(decision.reasons).toContain(SigningDenyReason.ORGANIZATION_MISMATCH);
    });

    it('refuses an authority belonging to a different membership', () => {
      const decision = evaluateSigningAuthority(
        request(),
        authority({ membershipId: 'membership-2' }),
      );
      expect(decision.reasons).toContain(SigningDenyReason.MEMBERSHIP_MISMATCH);
    });

    it('refuses a signer who cannot read documents', () => {
      const decision = evaluateSigningAuthority(
        request({ capabilities: new Set() }),
        authority(),
      );
      expect(decision.reasons).toContain(
        SigningDenyReason.DOCUMENT_READ_NOT_PERMITTED,
      );
    });
  });

  describe('authority validity window', () => {
    it('refuses before the window opens', () => {
      const decision = evaluateSigningAuthority(
        request(),
        authority({ validFrom: new Date('2026-09-01T00:00:00.000Z') }),
      );
      expect(decision.reasons).toContain(SigningDenyReason.AUTHORITY_NOT_YET_VALID);
    });

    it('refuses after the window closes', () => {
      const decision = evaluateSigningAuthority(
        request(),
        authority({ validTo: new Date('2026-08-01T00:00:00.000Z') }),
      );
      expect(decision.reasons).toContain(SigningDenyReason.AUTHORITY_EXPIRED);
    });

    it('treats the closing instant as exclusive', () => {
      const decision = evaluateSigningAuthority(
        request(),
        authority({ validTo: NOW }),
      );
      expect(decision.reasons).toContain(SigningDenyReason.AUTHORITY_EXPIRED);
    });

    it('refuses a revoked authority even inside its window', () => {
      const decision = evaluateSigningAuthority(
        request(),
        authority({ status: 'REVOKED' }),
      );
      expect(decision.reasons).toContain(SigningDenyReason.AUTHORITY_NOT_ACTIVE);
    });
  });

  describe('power of attorney', () => {
    it('refuses a delegated authority with no reference', () => {
      const decision = evaluateSigningAuthority(
        request(),
        authority({
          authorityType: SigningAuthorityType.MCHD_DELEGATED,
          mchdReference: null,
        }),
      );
      expect(decision.reasons).toContain(
        SigningDenyReason.MCHD_REFERENCE_REQUIRED,
      );
    });

    it('refuses a blank reference as firmly as a missing one', () => {
      const decision = evaluateSigningAuthority(
        request(),
        authority({
          authorityType: SigningAuthorityType.MCHD_DELEGATED,
          mchdReference: '   ',
        }),
      );
      expect(decision.reasons).toContain(
        SigningDenyReason.MCHD_REFERENCE_REQUIRED,
      );
    });

    it('does not demand a reference from the organization head', () => {
      const decision = evaluateSigningAuthority(
        request(),
        authority({
          authorityType: SigningAuthorityType.ORGANIZATION_HEAD,
          mchdReference: null,
        }),
      );
      expect(decision.reasons).not.toContain(
        SigningDenyReason.MCHD_REFERENCE_REQUIRED,
      );
    });
  });

  describe('document scope and money', () => {
    it('refuses a document type outside the authority', () => {
      const decision = evaluateSigningAuthority(
        request({ documentType: 'PAYMENT_ORDER' }),
        authority(),
      );
      expect(decision.reasons).toContain(
        SigningDenyReason.DOCUMENT_TYPE_NOT_PERMITTED,
      );
    });

    it('refuses one kopeck above the limit', () => {
      const decision = evaluateSigningAuthority(
        request({ documentAmountKopecks: 100_000_001n }),
        authority({ amountLimitKopecks: 100_000_000n }),
      );
      expect(decision.reasons).toContain(SigningDenyReason.AMOUNT_LIMIT_EXCEEDED);
    });

    it('refuses a stale document', () => {
      const decision = evaluateSigningAuthority(
        request({ documentIsStale: true }),
        authority(),
      );
      expect(decision.reasons).toContain(SigningDenyReason.DOCUMENT_STALE);
    });
  });

  describe('step-up freshness', () => {
    it('refuses when MFA was never performed', () => {
      const decision = evaluateSigningAuthority(
        request({ mfaVerifiedAt: null }),
        authority(),
      );
      expect(decision.reasons).toContain(SigningDenyReason.MFA_REQUIRED);
    });

    it('refuses MFA older than the default window', () => {
      const decision = evaluateSigningAuthority(
        request({
          mfaVerifiedAt: new Date(
            NOW.getTime() - (DEFAULT_MFA_MAX_AGE_SECONDS + 1) * 1000,
          ),
        }),
        authority(),
      );
      expect(decision.reasons).toContain(SigningDenyReason.MFA_STALE);
    });

    it('accepts MFA inside the window', () => {
      const decision = evaluateSigningAuthority(
        request({
          mfaVerifiedAt: new Date(
            NOW.getTime() - (DEFAULT_MFA_MAX_AGE_SECONDS - 1) * 1000,
          ),
        }),
        authority(),
      );
      expect(decision.reasons).not.toContain(SigningDenyReason.MFA_STALE);
    });

    it('refuses an MFA timestamp in the future rather than trusting it', () => {
      const decision = evaluateSigningAuthority(
        request({ mfaVerifiedAt: new Date(NOW.getTime() + 60_000) }),
        authority(),
      );
      expect(decision.reasons).toContain(SigningDenyReason.MFA_STALE);
    });

    it('honours a tighter window when one is demanded', () => {
      const decision = evaluateSigningAuthority(
        request({
          mfaVerifiedAt: new Date(NOW.getTime() - 120_000),
          mfaMaxAgeSeconds: 60,
        }),
        authority(),
      );
      expect(decision.reasons).toContain(SigningDenyReason.MFA_STALE);
    });
  });

  describe('certificate binding', () => {
    it('refuses a certificate that is not the one the authority names', () => {
      const decision = evaluateSigningAuthority(
        request({
          certificate: {
            fingerprint: 'fp-other',
            status: 'VALID',
            validFrom: new Date('2026-01-01T00:00:00.000Z'),
            validUntil: new Date('2027-01-01T00:00:00.000Z'),
          },
        }),
        authority(),
      );
      expect(decision.reasons).toContain(SigningDenyReason.CERTIFICATE_MISMATCH);
    });

    it('refuses a revoked certificate', () => {
      const decision = evaluateSigningAuthority(
        request({
          certificate: {
            fingerprint: 'fp-good',
            status: 'REVOKED',
            validFrom: new Date('2026-01-01T00:00:00.000Z'),
            validUntil: new Date('2027-01-01T00:00:00.000Z'),
          },
        }),
        authority(),
      );
      expect(decision.reasons).toContain(SigningDenyReason.CERTIFICATE_NOT_VALID);
    });

    it('refuses an expired certificate', () => {
      const decision = evaluateSigningAuthority(
        request({
          certificate: {
            fingerprint: 'fp-good',
            status: 'VALID',
            validFrom: new Date('2026-01-01T00:00:00.000Z'),
            validUntil: new Date('2026-08-01T00:00:00.000Z'),
          },
        }),
        authority(),
      );
      expect(decision.reasons).toContain(SigningDenyReason.CERTIFICATE_EXPIRED);
    });

    it('refuses a certificate that is not yet valid', () => {
      const decision = evaluateSigningAuthority(
        request({
          certificate: {
            fingerprint: 'fp-good',
            status: 'VALID',
            validFrom: new Date('2026-09-01T00:00:00.000Z'),
            validUntil: new Date('2027-01-01T00:00:00.000Z'),
          },
        }),
        authority(),
      );
      expect(decision.reasons).toContain(
        SigningDenyReason.CERTIFICATE_NOT_YET_VALID,
      );
    });

    it('refuses when no certificate is presented', () => {
      const decision = evaluateSigningAuthority(
        request({ certificate: null }),
        authority(),
      );
      expect(decision.reasons).toContain(SigningDenyReason.CERTIFICATE_NOT_VALID);
    });
  });

  describe('signing mode', () => {
    it('refuses a mode the authority does not allow', () => {
      const decision = evaluateSigningAuthority(
        request({ signingMode: SigningMode.APPROVED_CLOUD_SIGNING }),
        authority(),
      );
      expect(decision.reasons).toContain(
        SigningDenyReason.SIGNING_MODE_NOT_ALLOWED,
      );
    });

    it('refuses every mode when the authority allows none', () => {
      for (const mode of Object.values(SigningMode)) {
        const decision = evaluateSigningAuthority(
          request({ signingMode: mode }),
          authority({ allowedSigningModes: [] }),
        );
        expect(decision.reasons).toContain(
          SigningDenyReason.SIGNING_MODE_NOT_ALLOWED,
        );
      }
    });
  });

  describe('security hold', () => {
    it('refuses while a hold is in place, whatever else is valid', () => {
      const decision = evaluateSigningAuthority(
        request({ securityHold: true }),
        authority(),
      );
      expect(decision.allowed).toBe(false);
      expect(decision.reasons).toEqual([SigningDenyReason.SECURITY_HOLD]);
    });
  });

  describe('relationship to the Wave 1 capability axis', () => {
    it('does not accept documents.sign as a substitute for an authority record', () => {
      const decision = evaluateSigningAuthority(
        request({
          capabilities: new Set([
            Capability.DOCUMENTS_READ,
            Capability.DOCUMENTS_SIGN,
          ]),
        }),
        null,
      );
      expect(decision.allowed).toBe(false);
      expect(decision.reasons).toContain(SigningDenyReason.AUTHORITY_MISSING);
    });
  });
});
