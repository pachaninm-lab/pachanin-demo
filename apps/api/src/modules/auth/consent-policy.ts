export const CURRENT_CONSENT_VERSION = '2026-07-31';

/**
 * SHA-256 digests of the exact versioned policy source artifacts presented by
 * the registration and invitation surfaces. A source change must be paired
 * with a new version and new digests; the companion spec enforces that link.
 */
export const CURRENT_CONSENT_EVIDENCE = Object.freeze({
  terms: {
    version: CURRENT_CONSENT_VERSION,
    source: '/platform-v7/terms',
    contentHash: 'sha256:fdef352223071fb8c92ba5cd188060abeb56f6c4baa091cf119c59e694dac2e8',
  },
  privacy: {
    version: CURRENT_CONSENT_VERSION,
    source: '/platform-v7/privacy',
    contentHash: 'sha256:5a221082693b1e863523d1aca9b0f5478ca634f6f16890521ef3267814e18c6e',
  },
});

export function isCurrentConsent(termsVersion: unknown, privacyVersion: unknown): boolean {
  return String(termsVersion ?? '').trim() === CURRENT_CONSENT_EVIDENCE.terms.version
    && String(privacyVersion ?? '').trim() === CURRENT_CONSENT_EVIDENCE.privacy.version;
}
