-- PC-CROP federal accounting, Wave 2 seventh slice: the rule registry.
--
-- Every accounting document version already records which regulatory rule
-- governed it. Nothing produced that revision until now, so the field pointed
-- at nothing. This is what it points at.
--
-- The registry is platform-wide on purpose. Tax law is not an organization's
-- setting, and the failure this shape prevents is specific: if a tenant could
-- write the rule table, a document issued under the wrong rate could be
-- defended afterwards by editing the rate it claims to follow. The accounting
-- principals therefore receive SELECT and nothing else — no INSERT, no UPDATE,
-- no DELETE — and there is no policy admitting a write from any confined role.
-- Publishing a rule is an ops act through a migration or an admin connection,
-- which leaves a reviewed diff behind.
--
-- Two versions of one rule in force at the same instant makes "which rate
-- applied" unanswerable, so the guard refuses the overlap at write time. It is
-- a trigger rather than an exclusion constraint because the latter needs
-- btree_gist, and adding an extension to satisfy a check that plpgsql already
-- expresses would be a dependency bought for nothing.

-- CreateTable
CREATE TABLE "regulatory_rule_versions" (
    "id" TEXT NOT NULL,
    "ruleKey" TEXT NOT NULL,
    "versionTag" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMPTZ(6) NOT NULL,
    "effectiveTo" TIMESTAMPTZ(6),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "source" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "regulatory_rule_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "regulatory_rule_versions_ruleKey_effectiveFrom_idx" ON "regulatory_rule_versions"("ruleKey", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "regulatory_rule_versions_ruleKey_versionTag_key" ON "regulatory_rule_versions"("ruleKey", "versionTag");

-- Constraints ---------------------------------------------------------------

ALTER TABLE public."regulatory_rule_versions"
  DROP CONSTRAINT IF EXISTS regulatory_rule_versions_status_check;
ALTER TABLE public."regulatory_rule_versions"
  ADD CONSTRAINT regulatory_rule_versions_status_check
  CHECK ("status" IN ('ACTIVE', 'SUPERSEDED'));

ALTER TABLE public."regulatory_rule_versions"
  DROP CONSTRAINT IF EXISTS regulatory_rule_versions_window_check;
ALTER TABLE public."regulatory_rule_versions"
  ADD CONSTRAINT regulatory_rule_versions_window_check
  CHECK ("effectiveTo" IS NULL OR "effectiveTo" > "effectiveFrom");

ALTER TABLE public."regulatory_rule_versions"
  DROP CONSTRAINT IF EXISTS regulatory_rule_versions_key_not_blank_check;
ALTER TABLE public."regulatory_rule_versions"
  ADD CONSTRAINT regulatory_rule_versions_key_not_blank_check
  CHECK (length(btrim("ruleKey")) > 0 AND length(btrim("versionTag")) > 0);

-- A rule with no citation is an assertion. Documents generated under it cannot
-- explain themselves to anyone who asks why they look the way they do.
ALTER TABLE public."regulatory_rule_versions"
  DROP CONSTRAINT IF EXISTS regulatory_rule_versions_source_not_blank_check;
ALTER TABLE public."regulatory_rule_versions"
  ADD CONSTRAINT regulatory_rule_versions_source_not_blank_check
  CHECK (length(btrim("source")) > 0);

ALTER TABLE public."regulatory_rule_versions"
  DROP CONSTRAINT IF EXISTS regulatory_rule_versions_payload_object_check;
ALTER TABLE public."regulatory_rule_versions"
  ADD CONSTRAINT regulatory_rule_versions_payload_object_check
  CHECK (jsonb_typeof("payload") = 'object');

-- No two rules in force at once ---------------------------------------------

CREATE OR REPLACE FUNCTION public.pc_crop_regulatory_rule_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  conflicting text;
BEGIN
  IF NEW."status" = 'ACTIVE' THEN
    SELECT other."versionTag" INTO conflicting
    FROM public."regulatory_rule_versions" other
    WHERE other."ruleKey" = NEW."ruleKey"
      AND other."id" <> NEW."id"
      AND other."status" = 'ACTIVE'
      -- Half-open windows: a successor beginning exactly where its
      -- predecessor ends does not overlap it. Treating the bound as inclusive
      -- would make every clean handover look like a conflict.
      AND NEW."effectiveFrom" < coalesce(other."effectiveTo", 'infinity'::timestamptz)
      AND other."effectiveFrom" < coalesce(NEW."effectiveTo", 'infinity'::timestamptz)
    LIMIT 1;

    IF conflicting IS NOT NULL THEN
      RAISE EXCEPTION
        'regulatory rule % version % overlaps version % already in force',
        NEW."ruleKey", NEW."versionTag", conflicting;
    END IF;
  END IF;

  -- What a rule said is not editable. A document recorded this revision as the
  -- reason it looks the way it does; changing the payload underneath it makes
  -- that record a lie without changing the revision that vouches for it.
  IF TG_OP = 'UPDATE' AND (
       NEW."payload" IS DISTINCT FROM OLD."payload"
       OR NEW."ruleKey" IS DISTINCT FROM OLD."ruleKey"
       OR NEW."versionTag" IS DISTINCT FROM OLD."versionTag"
       OR NEW."effectiveFrom" IS DISTINCT FROM OLD."effectiveFrom"
       OR NEW."source" IS DISTINCT FROM OLD."source"
     ) THEN
    RAISE EXCEPTION 'a published regulatory rule version is immutable; publish a successor instead';
  END IF;

  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS regulatory_rule_versions_guard
  ON public."regulatory_rule_versions";
CREATE TRIGGER regulatory_rule_versions_guard
  BEFORE INSERT OR UPDATE ON public."regulatory_rule_versions"
  FOR EACH ROW EXECUTE FUNCTION public.pc_crop_regulatory_rule_guard();

-- Row level security --------------------------------------------------------
--
-- Enabled and forced with a read-only policy. Every confined principal may see
-- the rules — they are public law, and a document that cannot name its rule is
-- unverifiable — but no policy admits an INSERT, UPDATE or DELETE, so there is
-- no write path to grant by accident later.

ALTER TABLE public."regulatory_rule_versions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."regulatory_rule_versions" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS regulatory_rule_versions_read ON public."regulatory_rule_versions";
CREATE POLICY regulatory_rule_versions_read ON public."regulatory_rule_versions"
  FOR SELECT
  USING (true);

-- Privileges ----------------------------------------------------------------

DO $regulatory_rule_grants$
DECLARE
  role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['pc_accounting_authority', 'pc_accounting_command_authority']
  LOOP
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('GRANT USAGE ON SCHEMA public TO %I', role_name);
      EXECUTE format(
        'REVOKE ALL PRIVILEGES ON public."regulatory_rule_versions" FROM %I', role_name);
      EXECUTE format(
        'GRANT SELECT ON public."regulatory_rule_versions" TO %I', role_name);
    END IF;
  END LOOP;
END
$regulatory_rule_grants$;
