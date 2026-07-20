-- PC-CROP-01B.1 — PostgreSQL Commodity Profile Registry authority.
--
-- This migration creates platform-global, versioned product rules for all crop
-- archetypes. It does not create a parallel Deal/Lot authority and does not
-- activate any regulatory source or reference profile.

CREATE TABLE public."commodity_profiles" (
  "id" text PRIMARY KEY,
  "canonicalCode" varchar(64) NOT NULL,
  "archetype" varchar(40) NOT NULL,
  "authoritativeNameRu" text NOT NULL,
  "displayNameEn" text,
  "displayNameZh" text,
  "classification" varchar(32) NOT NULL DEFAULT 'INTERNAL',
  "version" bigint NOT NULL DEFAULT 0,
  "createdByUserId" text NOT NULL,
  "updatedByUserId" text NOT NULL,
  "createdAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "commodity_profiles_canonical_code_key" UNIQUE ("canonicalCode"),
  CONSTRAINT "commodity_profiles_canonical_code_check" CHECK (
    "canonicalCode" ~ '^[A-Z0-9][A-Z0-9._-]{2,63}$'
  ),
  CONSTRAINT "commodity_profiles_archetype_check" CHECK (
    "archetype" IN (
      'DRY_BULK',
      'SEED_PLANTING',
      'ROOT_INDUSTRIAL',
      'FRESH_PACKED',
      'GREENHOUSE_RECURRING',
      'ORGANIC_EXPORT_QUARANTINE'
    )
  ),
  CONSTRAINT "commodity_profiles_classification_check" CHECK (
    "classification" IN ('PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'PERSONAL', 'COMMERCIAL_SECRET')
  ),
  CONSTRAINT "commodity_profiles_names_check" CHECK (
    length(btrim("authoritativeNameRu")) BETWEEN 1 AND 500
    AND ("displayNameEn" IS NULL OR length(btrim("displayNameEn")) BETWEEN 1 AND 500)
    AND ("displayNameZh" IS NULL OR length(btrim("displayNameZh")) BETWEEN 1 AND 500)
  ),
  CONSTRAINT "commodity_profiles_version_nonnegative_check" CHECK ("version" >= 0)
);

CREATE TABLE public."commodity_profile_versions" (
  "id" text PRIMARY KEY,
  "profileId" text NOT NULL,
  "sequence" integer NOT NULL,
  "status" varchar(24) NOT NULL DEFAULT 'DRAFT',
  "content" jsonb NOT NULL,
  "contentHashAlgorithm" varchar(16) NOT NULL DEFAULT 'SHA-256',
  "contentHash" char(64) NOT NULL,
  "sourceStatus" varchar(32) NOT NULL DEFAULT 'REVERIFY_REQUIRED',
  "effectiveFrom" timestamptz(3),
  "effectiveTo" timestamptz(3),
  "approvalReason" text,
  "approvedByUserId" text,
  "approvedAt" timestamptz(3),
  "version" bigint NOT NULL DEFAULT 0,
  "createdByUserId" text NOT NULL,
  "updatedByUserId" text NOT NULL,
  "createdAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "commodity_profile_versions_profile_id_fkey"
    FOREIGN KEY ("profileId") REFERENCES public."commodity_profiles"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "commodity_profile_versions_profile_sequence_key"
    UNIQUE ("profileId", "sequence"),
  CONSTRAINT "commodity_profile_versions_profile_hash_key"
    UNIQUE ("profileId", "contentHash"),
  CONSTRAINT "commodity_profile_versions_sequence_check" CHECK ("sequence" > 0),
  CONSTRAINT "commodity_profile_versions_status_check" CHECK (
    "status" IN ('DRAFT', 'REVIEW', 'APPROVED', 'EFFECTIVE', 'DEPRECATED', 'REVOKED')
  ),
  CONSTRAINT "commodity_profile_versions_content_object_check" CHECK (
    jsonb_typeof("content") = 'object'
  ),
  CONSTRAINT "commodity_profile_versions_hash_algorithm_check" CHECK (
    "contentHashAlgorithm" = 'SHA-256'
  ),
  CONSTRAINT "commodity_profile_versions_hash_check" CHECK (
    "contentHash" ~ '^[a-f0-9]{64}$'
  ),
  CONSTRAINT "commodity_profile_versions_source_status_check" CHECK (
    "sourceStatus" IN ('VERIFIED', 'REVERIFY_REQUIRED', 'BLOCKED_EXTERNAL')
  ),
  CONSTRAINT "commodity_profile_versions_effective_range_check" CHECK (
    "effectiveTo" IS NULL OR (
      "effectiveFrom" IS NOT NULL AND "effectiveFrom" < "effectiveTo"
    )
  ),
  CONSTRAINT "commodity_profile_versions_approval_check" CHECK (
    "status" IN ('DRAFT', 'REVIEW')
    OR (
      "approvedByUserId" IS NOT NULL
      AND "approvedAt" IS NOT NULL
      AND length(btrim(COALESCE("approvalReason", ''))) BETWEEN 1 AND 2000
    )
  ),
  CONSTRAINT "commodity_profile_versions_effective_from_check" CHECK (
    "status" <> 'EFFECTIVE' OR "effectiveFrom" IS NOT NULL
  ),
  CONSTRAINT "commodity_profile_versions_deprecated_to_check" CHECK (
    "status" <> 'DEPRECATED' OR "effectiveTo" IS NOT NULL
  ),
  CONSTRAINT "commodity_profile_versions_version_nonnegative_check" CHECK ("version" >= 0)
);

CREATE TABLE public."commodity_profile_transitions" (
  "id" text PRIMARY KEY,
  "profileId" text NOT NULL,
  "profileVersionId" text NOT NULL,
  "fromStatus" varchar(24),
  "toStatus" varchar(24) NOT NULL,
  "actorUserId" text NOT NULL,
  "actorRole" text NOT NULL,
  "tenantId" text,
  "purpose" text NOT NULL,
  "reason" text NOT NULL,
  "commandId" text NOT NULL,
  "idempotencyKey" text NOT NULL,
  "correlationId" text NOT NULL,
  "contentHash" char(64) NOT NULL,
  "prevHash" char(64),
  "hash" char(64) NOT NULL,
  "createdAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "commodity_profile_transitions_profile_id_fkey"
    FOREIGN KEY ("profileId") REFERENCES public."commodity_profiles"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "commodity_profile_transitions_version_id_fkey"
    FOREIGN KEY ("profileVersionId") REFERENCES public."commodity_profile_versions"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "commodity_profile_transitions_idempotency_key_key" UNIQUE ("idempotencyKey"),
  CONSTRAINT "commodity_profile_transitions_command_id_key" UNIQUE ("commandId"),
  CONSTRAINT "commodity_profile_transitions_from_status_check" CHECK (
    "fromStatus" IS NULL OR "fromStatus" IN ('DRAFT', 'REVIEW', 'APPROVED', 'EFFECTIVE', 'DEPRECATED', 'REVOKED')
  ),
  CONSTRAINT "commodity_profile_transitions_to_status_check" CHECK (
    "toStatus" IN ('DRAFT', 'REVIEW', 'APPROVED', 'EFFECTIVE', 'DEPRECATED', 'REVOKED')
  ),
  CONSTRAINT "commodity_profile_transitions_reason_check" CHECK (
    length(btrim("reason")) BETWEEN 1 AND 2000
  ),
  CONSTRAINT "commodity_profile_transitions_purpose_check" CHECK (
    length(btrim("purpose")) BETWEEN 1 AND 200
  ),
  CONSTRAINT "commodity_profile_transitions_content_hash_check" CHECK (
    "contentHash" ~ '^[a-f0-9]{64}$'
  ),
  CONSTRAINT "commodity_profile_transitions_prev_hash_check" CHECK (
    "prevHash" IS NULL OR "prevHash" ~ '^[a-f0-9]{64}$'
  ),
  CONSTRAINT "commodity_profile_transitions_hash_check" CHECK (
    "hash" ~ '^[a-f0-9]{64}$'
  )
);

CREATE INDEX "commodity_profiles_archetype_idx"
  ON public."commodity_profiles" ("archetype");
CREATE INDEX "commodity_profiles_updated_idx"
  ON public."commodity_profiles" ("updatedAt" DESC, "id");
CREATE INDEX "commodity_profile_versions_profile_status_idx"
  ON public."commodity_profile_versions" ("profileId", "status", "sequence" DESC);
CREATE INDEX "commodity_profile_versions_effective_idx"
  ON public."commodity_profile_versions" ("profileId", "effectiveFrom", "effectiveTo")
  WHERE "status" IN ('APPROVED', 'EFFECTIVE');
CREATE INDEX "commodity_profile_versions_source_status_idx"
  ON public."commodity_profile_versions" ("sourceStatus", "status");
CREATE INDEX "commodity_profile_transitions_version_created_idx"
  ON public."commodity_profile_transitions" ("profileVersionId", "createdAt", "id");
CREATE INDEX "commodity_profile_transitions_correlation_idx"
  ON public."commodity_profile_transitions" ("correlationId");

CREATE OR REPLACE FUNCTION public.app_commodity_profile_valid_transition(
  p_from text,
  p_to text
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public
AS $function$
  SELECT
    p_from = p_to
    OR (p_from = 'DRAFT' AND p_to = 'REVIEW')
    OR (p_from = 'REVIEW' AND p_to IN ('DRAFT', 'APPROVED'))
    OR (p_from = 'APPROVED' AND p_to IN ('EFFECTIVE', 'REVOKED'))
    OR (p_from = 'EFFECTIVE' AND p_to IN ('DEPRECATED', 'REVOKED'))
    OR (p_from = 'DEPRECATED' AND p_to = 'REVOKED')
$function$;

CREATE OR REPLACE FUNCTION public.app_commodity_profile_guard_profile()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF EXISTS (
      SELECT 1
      FROM public."commodity_profile_versions" v
      WHERE v."profileId" = OLD."id"
    ) THEN
      RAISE EXCEPTION USING
        ERRCODE = '23503',
        MESSAGE = 'PC_PROFILE_DELETE_DENIED: profile has version history';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW."id" IS DISTINCT FROM OLD."id"
      OR NEW."canonicalCode" IS DISTINCT FROM OLD."canonicalCode"
      OR NEW."archetype" IS DISTINCT FROM OLD."archetype"
      OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt"
      OR NEW."createdByUserId" IS DISTINCT FROM OLD."createdByUserId"
    THEN
      RAISE EXCEPTION USING
        ERRCODE = '23000',
        MESSAGE = 'PC_PROFILE_IDENTITY_IMMUTABLE: create a new profile identity';
    END IF;

    IF NEW."version" <> OLD."version" + 1 THEN
      RAISE EXCEPTION USING
        ERRCODE = '40001',
        MESSAGE = 'PC_PROFILE_VERSION_CONFLICT: expected optimistic version increment';
    END IF;
  END IF;

  RETURN NEW;
END
$function$;

CREATE OR REPLACE FUNCTION public.app_commodity_profile_guard_version()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_overlap_id text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."status" <> 'DRAFT' THEN
      RAISE EXCEPTION USING
        ERRCODE = '23000',
        MESSAGE = 'PC_PROFILE_VERSION_DELETE_DENIED: published history is immutable';
    END IF;
    RETURN OLD;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(NEW."profileId", 0));

  IF TG_OP = 'UPDATE' THEN
    IF NEW."id" IS DISTINCT FROM OLD."id"
      OR NEW."profileId" IS DISTINCT FROM OLD."profileId"
      OR NEW."sequence" IS DISTINCT FROM OLD."sequence"
      OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt"
      OR NEW."createdByUserId" IS DISTINCT FROM OLD."createdByUserId"
    THEN
      RAISE EXCEPTION USING
        ERRCODE = '23000',
        MESSAGE = 'PC_PROFILE_VERSION_IDENTITY_IMMUTABLE';
    END IF;

    IF NOT public.app_commodity_profile_valid_transition(OLD."status", NEW."status") THEN
      RAISE EXCEPTION USING
        ERRCODE = '23000',
        MESSAGE = format('PC_PROFILE_TRANSITION_DENIED: %s -> %s', OLD."status", NEW."status");
    END IF;

    IF OLD."status" <> 'DRAFT' AND (
      NEW."content" IS DISTINCT FROM OLD."content"
      OR NEW."contentHash" IS DISTINCT FROM OLD."contentHash"
      OR NEW."contentHashAlgorithm" IS DISTINCT FROM OLD."contentHashAlgorithm"
    ) THEN
      RAISE EXCEPTION USING
        ERRCODE = '23000',
        MESSAGE = 'PC_PROFILE_VERSION_IMMUTABLE: create a new version';
    END IF;

    IF OLD."status" = 'DRAFT'
      AND NEW."content" IS DISTINCT FROM OLD."content"
      AND NEW."contentHash" IS NOT DISTINCT FROM OLD."contentHash"
    THEN
      RAISE EXCEPTION USING
        ERRCODE = '23000',
        MESSAGE = 'PC_PROFILE_HASH_STALE: content change requires a new SHA-256';
    END IF;

    IF NEW."version" <> OLD."version" + 1 THEN
      RAISE EXCEPTION USING
        ERRCODE = '40001',
        MESSAGE = 'PC_PROFILE_VERSION_CONFLICT: expected optimistic version increment';
    END IF;
  END IF;

  IF NEW."status" IN ('APPROVED', 'EFFECTIVE', 'DEPRECATED', 'REVOKED') AND (
    NEW."approvedByUserId" IS NULL
    OR NEW."approvedAt" IS NULL
    OR length(btrim(COALESCE(NEW."approvalReason", ''))) = 0
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'PC_PROFILE_APPROVAL_EVIDENCE_REQUIRED';
  END IF;

  IF NEW."status" = 'EFFECTIVE' AND NEW."effectiveFrom" IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'PC_PROFILE_EFFECTIVE_FROM_REQUIRED';
  END IF;

  IF NEW."status" = 'DEPRECATED' AND NEW."effectiveTo" IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'PC_PROFILE_EFFECTIVE_TO_REQUIRED';
  END IF;

  IF NEW."status" IN ('APPROVED', 'EFFECTIVE') AND NEW."effectiveFrom" IS NOT NULL THEN
    SELECT existing."id"
      INTO v_overlap_id
    FROM public."commodity_profile_versions" existing
    WHERE existing."profileId" = NEW."profileId"
      AND existing."id" <> NEW."id"
      AND existing."status" IN ('APPROVED', 'EFFECTIVE')
      AND tstzrange(
        existing."effectiveFrom",
        COALESCE(existing."effectiveTo", 'infinity'::timestamptz),
        '[)'
      ) && tstzrange(
        NEW."effectiveFrom",
        COALESCE(NEW."effectiveTo", 'infinity'::timestamptz),
        '[)'
      )
    LIMIT 1;

    IF v_overlap_id IS NOT NULL THEN
      RAISE EXCEPTION USING
        ERRCODE = '23P01',
        MESSAGE = format('PC_PROFILE_EFFECTIVE_OVERLAP: conflicts with %s', v_overlap_id);
    END IF;
  END IF;

  RETURN NEW;
END
$function$;

CREATE OR REPLACE FUNCTION public.app_commodity_profile_transition_append_only()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
BEGIN
  RAISE EXCEPTION USING
    ERRCODE = '23000',
    MESSAGE = 'PC_PROFILE_TRANSITION_IMMUTABLE: transition history is append-only';
END
$function$;

CREATE TRIGGER commodity_profiles_guard
BEFORE UPDATE OR DELETE ON public."commodity_profiles"
FOR EACH ROW EXECUTE FUNCTION public.app_commodity_profile_guard_profile();

CREATE TRIGGER commodity_profile_versions_guard
BEFORE INSERT OR UPDATE OR DELETE ON public."commodity_profile_versions"
FOR EACH ROW EXECUTE FUNCTION public.app_commodity_profile_guard_version();

CREATE TRIGGER commodity_profile_transitions_append_only
BEFORE UPDATE OR DELETE ON public."commodity_profile_transitions"
FOR EACH ROW EXECUTE FUNCTION public.app_commodity_profile_transition_append_only();

ALTER TABLE public."commodity_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."commodity_profiles" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."commodity_profile_versions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."commodity_profile_versions" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."commodity_profile_transitions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."commodity_profile_transitions" FORCE ROW LEVEL SECURITY;

CREATE POLICY commodity_profiles_select ON public."commodity_profiles"
FOR SELECT USING (
  public.app_rls_context_ready()
  AND (
    public.app_rls_privileged()
    OR EXISTS (
      SELECT 1
      FROM public."commodity_profile_versions" v
      WHERE v."profileId" = "commodity_profiles"."id"
        AND v."status" = 'EFFECTIVE'
        AND v."effectiveFrom" <= CURRENT_TIMESTAMP
        AND (v."effectiveTo" IS NULL OR CURRENT_TIMESTAMP < v."effectiveTo")
    )
  )
);

CREATE POLICY commodity_profiles_write ON public."commodity_profiles"
FOR ALL USING (
  public.app_rls_context_ready() AND public.app_rls_privileged()
) WITH CHECK (
  public.app_rls_context_ready() AND public.app_rls_privileged()
);

CREATE POLICY commodity_profile_versions_select ON public."commodity_profile_versions"
FOR SELECT USING (
  public.app_rls_context_ready()
  AND (
    public.app_rls_privileged()
    OR (
      "status" = 'EFFECTIVE'
      AND "effectiveFrom" <= CURRENT_TIMESTAMP
      AND ("effectiveTo" IS NULL OR CURRENT_TIMESTAMP < "effectiveTo")
    )
  )
);

CREATE POLICY commodity_profile_versions_write ON public."commodity_profile_versions"
FOR ALL USING (
  public.app_rls_context_ready() AND public.app_rls_privileged()
) WITH CHECK (
  public.app_rls_context_ready() AND public.app_rls_privileged()
);

CREATE POLICY commodity_profile_transitions_select ON public."commodity_profile_transitions"
FOR SELECT USING (
  public.app_rls_context_ready() AND public.app_rls_privileged()
);

CREATE POLICY commodity_profile_transitions_write ON public."commodity_profile_transitions"
FOR INSERT WITH CHECK (
  public.app_rls_context_ready() AND public.app_rls_privileged()
);

REVOKE ALL ON FUNCTION public.app_commodity_profile_valid_transition(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_commodity_profile_guard_profile() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_commodity_profile_guard_version() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_commodity_profile_transition_append_only() FROM PUBLIC;
