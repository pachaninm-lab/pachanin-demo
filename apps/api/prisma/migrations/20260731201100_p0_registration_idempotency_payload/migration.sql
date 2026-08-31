ALTER TABLE auth.registration_applications
  ADD COLUMN IF NOT EXISTS request_hash TEXT;

-- The PR may be applied after registration traffic has already created rows
-- from the immediately preceding migration. Give those legacy rows a unique,
-- non-secret reconciliation marker before enforcing the invariant.
UPDATE auth.registration_applications
SET request_hash = 'legacy:' || id
WHERE request_hash IS NULL;

DO $request_hash_guard$
BEGIN
  IF EXISTS (
    SELECT 1 FROM auth.registration_applications WHERE request_hash IS NULL
  ) THEN
    RAISE EXCEPTION 'registration application request_hash backfill incomplete';
  END IF;
END
$request_hash_guard$;

ALTER TABLE auth.registration_applications
  ALTER COLUMN request_hash SET NOT NULL;

CREATE INDEX registration_applications_request_hash_idx
  ON auth.registration_applications(request_hash);
