-- Forward-only technical consent evidence authority. Legal approval of the
-- policy text remains an owner/legal operational gate outside this migration.

ALTER TABLE auth.registration_applications
  ADD COLUMN IF NOT EXISTS terms_content_hash TEXT,
  ADD COLUMN IF NOT EXISTS privacy_content_hash TEXT;

UPDATE auth.registration_applications
SET terms_content_hash = CASE
      WHEN terms_version = '2026-07-31'
        THEN 'sha256:fdef352223071fb8c92ba5cd188060abeb56f6c4baa091cf119c59e694dac2e8'
      ELSE 'legacy-unverified:' || terms_version
    END
WHERE terms_content_hash IS NULL;

UPDATE auth.registration_applications
SET privacy_content_hash = CASE
      WHEN privacy_version = '2026-07-31'
        THEN 'sha256:5a221082693b1e863523d1aca9b0f5478ca634f6f16890521ef3267814e18c6e'
      ELSE 'legacy-unverified:' || privacy_version
    END
WHERE privacy_content_hash IS NULL;

DO $terms_content_hash_guard$
BEGIN
  IF EXISTS (
    SELECT 1 FROM auth.registration_applications WHERE terms_content_hash IS NULL
  ) THEN
    RAISE EXCEPTION 'registration terms consent evidence backfill incomplete';
  END IF;
END
$terms_content_hash_guard$;

DO $privacy_content_hash_guard$
BEGIN
  IF EXISTS (
    SELECT 1 FROM auth.registration_applications WHERE privacy_content_hash IS NULL
  ) THEN
    RAISE EXCEPTION 'registration privacy consent evidence backfill incomplete';
  END IF;
END
$privacy_content_hash_guard$;

ALTER TABLE auth.registration_applications
  ALTER COLUMN terms_content_hash SET NOT NULL;

ALTER TABLE auth.registration_applications
  ALTER COLUMN privacy_content_hash SET NOT NULL;

ALTER TABLE auth.registration_applications
  ADD CONSTRAINT registration_terms_consent_evidence_check CHECK (
    (terms_version = '2026-07-31'
      AND terms_content_hash = 'sha256:fdef352223071fb8c92ba5cd188060abeb56f6c4baa091cf119c59e694dac2e8')
    OR terms_content_hash = 'legacy-unverified:' || terms_version
  ),
  ADD CONSTRAINT registration_privacy_consent_evidence_check CHECK (
    (privacy_version = '2026-07-31'
      AND privacy_content_hash = 'sha256:5a221082693b1e863523d1aca9b0f5478ca634f6f16890521ef3267814e18c6e')
    OR privacy_content_hash = 'legacy-unverified:' || privacy_version
  );
