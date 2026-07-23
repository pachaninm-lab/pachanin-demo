BEGIN;

-- Keep the public intake row contract deterministic at PostgreSQL millisecond
-- precision. Comparing a timestamptz(3) value with the higher-precision
-- transaction clock can make a rounded-up consent timestamp look future-dated.
ALTER TABLE public.public_organization_connection_requests
  DROP CONSTRAINT IF EXISTS public_org_connection_requests_consent_check;

-- The authority functions declare request_status as text. Store the constrained
-- status as text as well so sequential/replay RETURN QUERY paths have an exact
-- PostgreSQL type match rather than varchar(24) -> text ambiguity.
ALTER TABLE public.public_organization_connection_requests
  ALTER COLUMN status TYPE text USING status::text;

ALTER TABLE public.public_organization_connection_requests
  ADD CONSTRAINT public_org_connection_requests_consent_check
  CHECK (
    "consentVersion" <> ''
    AND "consentedAt" <= "createdAt"
  );

COMMIT;
