export const CURRENT_CONSENT_VERSION = '2026-09-03';

/**
 * SHA-256 digests of the exact versioned policy source artifacts presented by
 * the registration and invitation surfaces. A source change must be paired
 * with a new version and new digests; the companion spec enforces that link.
 */
export const CURRENT_CONSENT_EVIDENCE = Object.freeze({
  terms: {
    version: CURRENT_CONSENT_VERSION,
    source: '/platform-v7/terms',
    contentHash: 'sha256:7249d807e7df5e71a255947c2425882c5698e39133e112cd534dfb5dea701c18',
  },
  privacy: {
    version: CURRENT_CONSENT_VERSION,
    source: '/platform-v7/privacy',
    contentHash: 'sha256:c68e3d50bf3a984207a961882bb4e0564057303a180fe4c95af65d9f74798e85',
  },
});

export function isCurrentConsent(termsVersion: unknown, privacyVersion: unknown): boolean {
  return String(termsVersion ?? '').trim() === CURRENT_CONSENT_EVIDENCE.terms.version
    && String(privacyVersion ?? '').trim() === CURRENT_CONSENT_EVIDENCE.privacy.version;
}
