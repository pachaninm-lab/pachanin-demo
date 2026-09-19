-- PC-CROP federal accounting, Wave 2 first slice: signing authority.
--
-- Expand-only. Adds one new table and nothing else. No existing column, grant,
-- policy or constraint is touched.
--
-- Wave 1 made legal signing unreachable on purpose: no job profile grants
-- documents.sign and no delegation may carry it. This table is the gate that
-- replaces that refusal with an explicit, bounded authority.
--
-- The platform never stores a private key. A row names a certificate by
-- fingerprint and states what its holder may sign inside one organization.
-- ukep_certificates stays the user-level certificate record and is not moved,
-- renamed or duplicated; the binding here is by fingerprint because a
-- certificate belongs to a person while an authority belongs to a membership.
--
-- Structural names, types and defaults mirror exactly what Prisma derives from
-- schema.prisma, so `prisma migrate diff` reports no drift. The CHECK
-- constraints and the row level security block are invariants Prisma does not
-- model and do not create drift.

CREATE TABLE IF NOT EXISTS public."signing_authorities" (
  "id"                     TEXT           NOT NULL,
  "tenantId"               TEXT           NOT NULL,
  "organizationId"         TEXT           NOT NULL,
  "membershipId"           TEXT           NOT NULL,
  "authorityType"          TEXT           NOT NULL,
  "mchdReference"          TEXT,
  "validFrom"              TIMESTAMPTZ(6) NOT NULL,
  "validTo"                TIMESTAMPTZ(6) NOT NULL,
  "allowedDocumentTypes"   TEXT[],
  "amountLimitKopecks"     BIGINT,
  "certificateFingerprint" TEXT           NOT NULL,
  "allowedSigningModes"    TEXT[],
  "status"                 TEXT           NOT NULL DEFAULT 'ACTIVE',
  "lastVerifiedAt"         TIMESTAMPTZ(6),
  "grantedByMembershipId"  TEXT           NOT NULL,
  "revokedAt"              TIMESTAMPTZ(6),
  "version"                BIGINT         NOT NULL DEFAULT 0,
  "createdAt"              TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"              TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "signing_authorities_pkey" PRIMARY KEY ("id")
);

DO $signing_authority_invariants$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'signing_authority_window_check'
  ) THEN
    ALTER TABLE public."signing_authorities"
      ADD CONSTRAINT signing_authority_window_check
      CHECK ("validTo" > "validFrom");
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'signing_authority_type_check'
  ) THEN
    ALTER TABLE public."signing_authorities"
      ADD CONSTRAINT signing_authority_type_check
      CHECK ("authorityType" IN ('ORGANIZATION_HEAD', 'MCHD_DELEGATED'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'signing_authority_status_check'
  ) THEN
    ALTER TABLE public."signing_authorities"
      ADD CONSTRAINT signing_authority_status_check
      CHECK ("status" IN ('ACTIVE', 'REVOKED', 'EXPIRED', 'SUSPENDED'));
  END IF;

  -- A delegated signer without a power-of-attorney reference is not a signer.
  -- The policy refuses it; the database refuses to record it in the first place.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'signing_authority_mchd_reference_check'
  ) THEN
    ALTER TABLE public."signing_authorities"
      ADD CONSTRAINT signing_authority_mchd_reference_check
      CHECK (
        "authorityType" <> 'MCHD_DELEGATED'
        OR ("mchdReference" IS NOT NULL AND btrim("mchdReference") <> '')
      );
  END IF;

  -- An empty list must mean nothing is permitted, and an authority that
  -- permits nothing is a configuration mistake rather than a safe default.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'signing_authority_document_types_check'
  ) THEN
    ALTER TABLE public."signing_authorities"
      ADD CONSTRAINT signing_authority_document_types_check
      CHECK (
        "allowedDocumentTypes" IS NOT NULL
        AND cardinality("allowedDocumentTypes") > 0
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'signing_authority_signing_modes_check'
  ) THEN
    ALTER TABLE public."signing_authorities"
      ADD CONSTRAINT signing_authority_signing_modes_check
      CHECK (
        "allowedSigningModes" IS NOT NULL
        AND cardinality("allowedSigningModes") > 0
        AND "allowedSigningModes" <@ ARRAY[
          'PROVIDER_UI', 'LOCAL_CSP', 'APPROVED_CLOUD_SIGNING'
        ]::text[]
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'signing_authority_amount_limit_check'
  ) THEN
    ALTER TABLE public."signing_authorities"
      ADD CONSTRAINT signing_authority_amount_limit_check
      CHECK ("amountLimitKopecks" IS NULL OR "amountLimitKopecks" >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'signing_authority_fingerprint_check'
  ) THEN
    ALTER TABLE public."signing_authorities"
      ADD CONSTRAINT signing_authority_fingerprint_check
      CHECK (btrim("certificateFingerprint") <> '');
  END IF;
END
$signing_authority_invariants$;

CREATE INDEX IF NOT EXISTS "signing_authorities_organizationId_membershipId_status_vali_idx"
  ON public."signing_authorities" ("organizationId", "membershipId", "status", "validTo");

CREATE INDEX IF NOT EXISTS "signing_authorities_tenantId_idx"
  ON public."signing_authorities" ("tenantId");

CREATE INDEX IF NOT EXISTS "signing_authorities_certificateFingerprint_idx"
  ON public."signing_authorities" ("certificateFingerprint");

-- One membership may hold at most one active authority per certificate, so a
-- duplicated grant command cannot quietly stack two overlapping authorities.
CREATE UNIQUE INDEX IF NOT EXISTS signing_authorities_active_membership_certificate_idx
  ON public."signing_authorities"
  ("organizationId", "membershipId", "certificateFingerprint")
  WHERE "status" = 'ACTIVE';

DO $signing_authority_foreign_keys$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'signing_authorities_membershipId_organizationId_fkey'
  ) THEN
    ALTER TABLE public."signing_authorities"
      ADD CONSTRAINT "signing_authorities_membershipId_organizationId_fkey"
      FOREIGN KEY ("membershipId", "organizationId")
      REFERENCES public."user_orgs" ("id", "organizationId")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'signing_authorities_organizationId_tenantId_fkey'
  ) THEN
    ALTER TABLE public."signing_authorities"
      ADD CONSTRAINT "signing_authorities_organizationId_tenantId_fkey"
      FOREIGN KEY ("organizationId", "tenantId")
      REFERENCES public."organizations" ("id", "tenantId")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$signing_authority_foreign_keys$;

ALTER TABLE public."signing_authorities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."signing_authorities" FORCE ROW LEVEL SECURITY;

-- No policy is created here, matching membership_delegations. RLS enabled and
-- forced with no policy denies every non-superuser principal, so the table
-- cannot be reached until the slice that introduces its API provisions a
-- reading principal and a tenant-scoped policy under its own review.

DO $signing_authority_privilege_boundary$
DECLARE
  role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY[
    'pc_organization_membership_command_authority'
  ] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format(
        'REVOKE ALL PRIVILEGES ON public."signing_authorities" FROM %I',
        role_name
      );
    END IF;
  END LOOP;
END
$signing_authority_privilege_boundary$;
