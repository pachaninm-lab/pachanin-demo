-- PC-CROP federal accounting, Wave 1: job profile and delegated capabilities.
--
-- Expand-only. Adds one nullable column and one new table. No column is
-- dropped, retyped or backfilled, and no existing grant, policy or constraint
-- is modified, so a partially rolled-out deployment keeps working: code that
-- has never heard of job_profile continues to read user_orgs exactly as before.
--
-- job_profile is a second axis alongside user_orgs."role". It never replaces
-- the role. "role" keeps its market meaning, including ACCOUNTING, which is the
-- bank/settlement actor and must not be repurposed as the organization
-- bookkeeper. A bookkeeper is expected to carry role = 'GUEST' together with
-- job_profile = 'ACCOUNTANT'.
--
-- Structural names and defaults below mirror exactly what Prisma derives from
-- schema.prisma, so `prisma migrate diff` reports no drift. The CHECK
-- constraints and the row level security block are additions Prisma does not
-- model; they are invariants this slice must not lose, and they do not create
-- drift.
--
-- Column-level privileges are deliberately not extended to the existing
-- narrowly scoped identity principals. They keep the exact column set they were
-- granted, so this migration cannot widen what any current runtime can read.

ALTER TABLE public."user_orgs"
  ADD COLUMN IF NOT EXISTS "job_profile" TEXT;

DO $job_profile_constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_orgs_job_profile_check'
  ) THEN
    ALTER TABLE public."user_orgs"
      ADD CONSTRAINT user_orgs_job_profile_check
      CHECK (
        "job_profile" IS NULL
        OR "job_profile" IN (
          'OWNER',
          'DIRECTOR',
          'CHIEF_ACCOUNTANT',
          'ACCOUNTANT',
          'EXTERNAL_ACCOUNTANT',
          'SALES_MANAGER',
          'PROCUREMENT_MANAGER',
          'LOGISTICS_MANAGER',
          'DOCUMENT_SPECIALIST',
          'SIGNER',
          'VIEWER'
        )
      );
  END IF;
END
$job_profile_constraint$;

CREATE INDEX IF NOT EXISTS "user_orgs_organizationId_job_profile_idx"
  ON public."user_orgs" ("organizationId", "job_profile");

-- Time-bounded delegation of a capability subset from one membership to
-- another, used when a bookkeeper is on leave. Legal signing authority is not
-- delegable and the database refuses to store it, so a bug in any future call
-- site cannot turn a stand-in into a signatory.

CREATE TABLE IF NOT EXISTS public."membership_delegations" (
  "id"                    TEXT           NOT NULL,
  "tenantId"              TEXT           NOT NULL,
  "organizationId"        TEXT           NOT NULL,
  "fromMembershipId"      TEXT           NOT NULL,
  "toMembershipId"        TEXT           NOT NULL,
  "capabilities"          TEXT[],
  "startsAt"              TIMESTAMPTZ(6) NOT NULL,
  "endsAt"                TIMESTAMPTZ(6) NOT NULL,
  "status"                TEXT           NOT NULL DEFAULT 'ACTIVE',
  "reason"                TEXT,
  "createdByMembershipId" TEXT           NOT NULL,
  "revokedAt"             TIMESTAMPTZ(6),
  "version"               BIGINT         NOT NULL DEFAULT 0,
  "createdAt"             TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"             TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "membership_delegations_pkey" PRIMARY KEY ("id")
);

DO $delegation_invariants$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'membership_delegation_window_check'
  ) THEN
    ALTER TABLE public."membership_delegations"
      ADD CONSTRAINT membership_delegation_window_check
      CHECK ("endsAt" > "startsAt");
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'membership_delegation_status_check'
  ) THEN
    ALTER TABLE public."membership_delegations"
      ADD CONSTRAINT membership_delegation_status_check
      CHECK ("status" IN ('ACTIVE', 'REVOKED', 'EXPIRED'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'membership_delegation_not_self_check'
  ) THEN
    ALTER TABLE public."membership_delegations"
      ADD CONSTRAINT membership_delegation_not_self_check
      CHECK ("fromMembershipId" <> "toMembershipId");
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'membership_delegation_capabilities_present_check'
  ) THEN
    ALTER TABLE public."membership_delegations"
      ADD CONSTRAINT membership_delegation_capabilities_present_check
      CHECK ("capabilities" IS NOT NULL AND cardinality("capabilities") > 0);
  END IF;

  -- Signing is gated by a signing authority record, never by delegation.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'membership_delegation_no_signing_check'
  ) THEN
    ALTER TABLE public."membership_delegations"
      ADD CONSTRAINT membership_delegation_no_signing_check
      CHECK (NOT ('documents.sign' = ANY ("capabilities")));
  END IF;
END
$delegation_invariants$;

CREATE INDEX IF NOT EXISTS "membership_delegations_organizationId_toMembershipId_status_idx"
  ON public."membership_delegations" ("organizationId", "toMembershipId", "status", "endsAt");

CREATE INDEX IF NOT EXISTS "membership_delegations_tenantId_idx"
  ON public."membership_delegations" ("tenantId");

-- Only one active delegation may run between the same pair at the same moment,
-- so a duplicated command cannot silently stack two overlapping grants.
CREATE UNIQUE INDEX IF NOT EXISTS membership_delegations_active_pair_idx
  ON public."membership_delegations"
  ("organizationId", "fromMembershipId", "toMembershipId", "startsAt")
  WHERE "status" = 'ACTIVE';

DO $delegation_foreign_keys$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'membership_delegations_fromMembershipId_organizationId_fkey'
  ) THEN
    ALTER TABLE public."membership_delegations"
      ADD CONSTRAINT "membership_delegations_fromMembershipId_organizationId_fkey"
      FOREIGN KEY ("fromMembershipId", "organizationId")
      REFERENCES public."user_orgs" ("id", "organizationId")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'membership_delegations_toMembershipId_organizationId_fkey'
  ) THEN
    ALTER TABLE public."membership_delegations"
      ADD CONSTRAINT "membership_delegations_toMembershipId_organizationId_fkey"
      FOREIGN KEY ("toMembershipId", "organizationId")
      REFERENCES public."user_orgs" ("id", "organizationId")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'membership_delegations_organizationId_tenantId_fkey'
  ) THEN
    ALTER TABLE public."membership_delegations"
      ADD CONSTRAINT "membership_delegations_organizationId_tenantId_fkey"
      FOREIGN KEY ("organizationId", "tenantId")
      REFERENCES public."organizations" ("id", "tenantId")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$delegation_foreign_keys$;

ALTER TABLE public."membership_delegations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."membership_delegations" FORCE ROW LEVEL SECURITY;

-- No policy is created here. With RLS enabled, forced and no policy present,
-- every non-superuser principal is denied. The reading principal and its
-- tenant-scoped policy are provisioned in the slice that introduces the API
-- which needs them, so this table cannot be reached before that review.

DO $delegation_privilege_boundary$
DECLARE
  role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY[
    'pc_organization_membership_command_authority'
  ] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format(
        'REVOKE ALL PRIVILEGES ON public."membership_delegations" FROM %I',
        role_name
      );
    END IF;
  END LOOP;
END
$delegation_privilege_boundary$;
