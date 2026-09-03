-- Forward-only expansion of the registration consent evidence authority.
-- Preserve the already accepted 2026-07-31 evidence while admitting only the
-- exact 2026-09-03 Terms/Privacy source digests for the new public policy text.

ALTER TABLE auth.registration_applications
  DROP CONSTRAINT IF EXISTS registration_terms_consent_evidence_check,
  DROP CONSTRAINT IF EXISTS registration_privacy_consent_evidence_check;

ALTER TABLE auth.registration_applications
  ADD CONSTRAINT registration_terms_consent_evidence_check CHECK (
    (terms_version = '2026-07-31'
      AND terms_content_hash = 'sha256:fdef352223071fb8c92ba5cd188060abeb56f6c4baa091cf119c59e694dac2e8')
    OR (terms_version = '2026-09-03'
      AND terms_content_hash = 'sha256:7249d807e7df5e71a255947c2425882c5698e39133e112cd534dfb5dea701c18')
    OR (terms_version NOT IN ('2026-07-31', '2026-09-03')
      AND terms_content_hash = 'legacy-unverified:' || terms_version)
  ),
  ADD CONSTRAINT registration_privacy_consent_evidence_check CHECK (
    (privacy_version = '2026-07-31'
      AND privacy_content_hash = 'sha256:5a221082693b1e863523d1aca9b0f5478ca634f6f16890521ef3267814e18c6e')
    OR (privacy_version = '2026-09-03'
      AND privacy_content_hash = 'sha256:c68e3d50bf3a984207a961882bb4e0564057303a180fe4c95af65d9f74798e85')
    OR (privacy_version NOT IN ('2026-07-31', '2026-09-03')
      AND privacy_content_hash = 'legacy-unverified:' || privacy_version)
  );
