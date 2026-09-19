/**
 * Signing authority for the PC-CROP federal accounting contour.
 *
 * Wave 1 deliberately left legal signing unreachable: no job profile grants
 * `documents.sign`, no delegation can carry it, and the database refuses to
 * store it inside one. This module is the gate that was missing. It does not
 * relax that invariant — it replaces it with an explicit authority check that
 * a call site must pass, rather than a capability it could accidentally be
 * handed.
 *
 * The platform never holds a private key. An authority record points at a
 * certificate and states what that certificate's holder may sign inside one
 * organization; the cryptographic act happens in the provider UI, in a local
 * CSP, or in an approved cloud signing service.
 *
 * Deny by default. `evaluateSigningAuthority` returns every reason a request
 * fails rather than the first, so a disabled button can explain itself
 * completely instead of revealing one blocker at a time.
 */

import { Capability } from './membership-capability.resolver';

export const SigningMode = {
  /** The provider's own interface performs the signature. */
  PROVIDER_UI: 'PROVIDER_UI',
  /** A cryptographic service provider on the signer's own machine. */
  LOCAL_CSP: 'LOCAL_CSP',
  /** A cloud signing service that has passed review. */
  APPROVED_CLOUD_SIGNING: 'APPROVED_CLOUD_SIGNING',
} as const;

export type SigningMode = typeof SigningMode[keyof typeof SigningMode];

export const SigningAuthorityType = {
  /** The person signs as the organization's executive body. */
  ORGANIZATION_HEAD: 'ORGANIZATION_HEAD',
  /** The person signs under a machine-readable power of attorney. */
  MCHD_DELEGATED: 'MCHD_DELEGATED',
} as const;

export type SigningAuthorityType =
  typeof SigningAuthorityType[keyof typeof SigningAuthorityType];

export const SigningDenyReason = {
  MEMBERSHIP_NOT_ACTIVE: 'MEMBERSHIP_NOT_ACTIVE',
  USER_NOT_ACTIVE: 'USER_NOT_ACTIVE',
  TENANT_MISMATCH: 'TENANT_MISMATCH',
  ORGANIZATION_MISMATCH: 'ORGANIZATION_MISMATCH',
  MEMBERSHIP_MISMATCH: 'MEMBERSHIP_MISMATCH',
  DOCUMENT_READ_NOT_PERMITTED: 'DOCUMENT_READ_NOT_PERMITTED',
  AUTHORITY_MISSING: 'AUTHORITY_MISSING',
  AUTHORITY_NOT_ACTIVE: 'AUTHORITY_NOT_ACTIVE',
  AUTHORITY_NOT_YET_VALID: 'AUTHORITY_NOT_YET_VALID',
  AUTHORITY_EXPIRED: 'AUTHORITY_EXPIRED',
  MCHD_REFERENCE_REQUIRED: 'MCHD_REFERENCE_REQUIRED',
  DOCUMENT_TYPE_NOT_PERMITTED: 'DOCUMENT_TYPE_NOT_PERMITTED',
  AMOUNT_LIMIT_EXCEEDED: 'AMOUNT_LIMIT_EXCEEDED',
  DOCUMENT_STALE: 'DOCUMENT_STALE',
  MFA_REQUIRED: 'MFA_REQUIRED',
  MFA_STALE: 'MFA_STALE',
  CERTIFICATE_MISMATCH: 'CERTIFICATE_MISMATCH',
  CERTIFICATE_NOT_VALID: 'CERTIFICATE_NOT_VALID',
  CERTIFICATE_NOT_YET_VALID: 'CERTIFICATE_NOT_YET_VALID',
  CERTIFICATE_EXPIRED: 'CERTIFICATE_EXPIRED',
  SIGNING_MODE_NOT_ALLOWED: 'SIGNING_MODE_NOT_ALLOWED',
  SECURITY_HOLD: 'SECURITY_HOLD',
} as const;

export type SigningDenyReason =
  typeof SigningDenyReason[keyof typeof SigningDenyReason];

/** Freshness demanded of the signer's last MFA before a signature. */
export const DEFAULT_MFA_MAX_AGE_SECONDS = 300;

export type SigningAuthorityRecord = {
  organizationId: string;
  tenantId: string;
  membershipId: string;
  authorityType: SigningAuthorityType;
  /** Reference to the machine-readable power of attorney, when one applies. */
  mchdReference: string | null;
  validFrom: Date;
  validTo: Date;
  /** Empty means nothing is permitted, not everything. */
  allowedDocumentTypes: readonly string[];
  /**
   * Kopecks as bigint. Null means the authority carries no monetary ceiling.
   * Money never travels as a JavaScript number here; the repository forbids
   * number arithmetic on money and persists BIGINT columns.
   */
  amountLimitKopecks: bigint | null;
  certificateFingerprint: string;
  allowedSigningModes: readonly SigningMode[];
  status: string;
};

export type SigningCertificateState = {
  fingerprint: string;
  status: string;
  validFrom: Date;
  validUntil: Date;
};

export type SigningRequest = {
  tenantId: string;
  organizationId: string;
  membershipId: string;
  membershipStatus: string;
  userStatus?: string;
  capabilities: ReadonlySet<Capability>;
  documentType: string;
  /** Kopecks as bigint, matching the persistence and domain-core convention. */
  documentAmountKopecks: bigint;
  /**
   * True when a source fact behind the document changed after the version was
   * produced — weight, quality, price, requisites, tax profile or contract
   * version. A stale document must be reissued, never signed.
   */
  documentIsStale: boolean;
  mfaVerifiedAt: Date | null;
  mfaMaxAgeSeconds?: number;
  certificate: SigningCertificateState | null;
  signingMode: SigningMode;
  /** Set by the fraud or security contour; any hold refuses the signature. */
  securityHold?: boolean;
  now?: Date;
};

export type SigningDecision = {
  allowed: boolean;
  reasons: readonly SigningDenyReason[];
};

function isWithin(now: Date, from: Date, to: Date): 'BEFORE' | 'INSIDE' | 'AFTER' {
  if (now.getTime() < from.getTime()) {
    return 'BEFORE';
  }
  if (now.getTime() >= to.getTime()) {
    return 'AFTER';
  }
  return 'INSIDE';
}

/**
 * Decide whether one membership may sign one document right now.
 *
 * Every check contributes its own reason. The result is allowed only when the
 * reason list is empty, so adding a check can never accidentally widen access.
 */
export function evaluateSigningAuthority(
  request: SigningRequest,
  authority: SigningAuthorityRecord | null | undefined,
): SigningDecision {
  const reasons: SigningDenyReason[] = [];
  const now = request.now ?? new Date();

  if (request.membershipStatus !== 'ACTIVE') {
    reasons.push(SigningDenyReason.MEMBERSHIP_NOT_ACTIVE);
  }
  if (request.userStatus !== undefined && request.userStatus !== 'ACTIVE') {
    reasons.push(SigningDenyReason.USER_NOT_ACTIVE);
  }

  // Signing something you may not even read is never coherent.
  if (!request.capabilities.has(Capability.DOCUMENTS_READ)) {
    reasons.push(SigningDenyReason.DOCUMENT_READ_NOT_PERMITTED);
  }

  if (request.documentIsStale) {
    reasons.push(SigningDenyReason.DOCUMENT_STALE);
  }

  if (request.securityHold === true) {
    reasons.push(SigningDenyReason.SECURITY_HOLD);
  }

  if (request.mfaVerifiedAt === null) {
    reasons.push(SigningDenyReason.MFA_REQUIRED);
  } else {
    const maxAge = request.mfaMaxAgeSeconds ?? DEFAULT_MFA_MAX_AGE_SECONDS;
    const ageSeconds = (now.getTime() - request.mfaVerifiedAt.getTime()) / 1000;
    if (ageSeconds < 0 || ageSeconds > maxAge) {
      reasons.push(SigningDenyReason.MFA_STALE);
    }
  }

  if (!authority) {
    reasons.push(SigningDenyReason.AUTHORITY_MISSING);
    return { allowed: false, reasons };
  }

  if (authority.tenantId !== request.tenantId) {
    reasons.push(SigningDenyReason.TENANT_MISMATCH);
  }
  if (authority.organizationId !== request.organizationId) {
    reasons.push(SigningDenyReason.ORGANIZATION_MISMATCH);
  }
  if (authority.membershipId !== request.membershipId) {
    reasons.push(SigningDenyReason.MEMBERSHIP_MISMATCH);
  }

  if (authority.status !== 'ACTIVE') {
    reasons.push(SigningDenyReason.AUTHORITY_NOT_ACTIVE);
  }

  const authorityWindow = isWithin(now, authority.validFrom, authority.validTo);
  if (authorityWindow === 'BEFORE') {
    reasons.push(SigningDenyReason.AUTHORITY_NOT_YET_VALID);
  }
  if (authorityWindow === 'AFTER') {
    reasons.push(SigningDenyReason.AUTHORITY_EXPIRED);
  }

  // A delegated signer without a power-of-attorney reference is not a signer.
  if (
    authority.authorityType === SigningAuthorityType.MCHD_DELEGATED
    && (authority.mchdReference === null || authority.mchdReference.trim() === '')
  ) {
    reasons.push(SigningDenyReason.MCHD_REFERENCE_REQUIRED);
  }

  if (!authority.allowedDocumentTypes.includes(request.documentType)) {
    reasons.push(SigningDenyReason.DOCUMENT_TYPE_NOT_PERMITTED);
  }

  if (
    authority.amountLimitKopecks !== null
    && request.documentAmountKopecks > authority.amountLimitKopecks
  ) {
    reasons.push(SigningDenyReason.AMOUNT_LIMIT_EXCEEDED);
  }

  if (!authority.allowedSigningModes.includes(request.signingMode)) {
    reasons.push(SigningDenyReason.SIGNING_MODE_NOT_ALLOWED);
  }

  const certificate = request.certificate;
  if (!certificate) {
    reasons.push(SigningDenyReason.CERTIFICATE_NOT_VALID);
  } else {
    if (certificate.fingerprint !== authority.certificateFingerprint) {
      reasons.push(SigningDenyReason.CERTIFICATE_MISMATCH);
    }
    if (certificate.status !== 'VALID') {
      reasons.push(SigningDenyReason.CERTIFICATE_NOT_VALID);
    }
    const certificateWindow = isWithin(
      now,
      certificate.validFrom,
      certificate.validUntil,
    );
    if (certificateWindow === 'BEFORE') {
      reasons.push(SigningDenyReason.CERTIFICATE_NOT_YET_VALID);
    }
    if (certificateWindow === 'AFTER') {
      reasons.push(SigningDenyReason.CERTIFICATE_EXPIRED);
    }
  }

  return { allowed: reasons.length === 0, reasons };
}

export function canSign(
  request: SigningRequest,
  authority: SigningAuthorityRecord | null | undefined,
): boolean {
  return evaluateSigningAuthority(request, authority).allowed;
}
