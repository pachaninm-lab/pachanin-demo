-- Preserve the exact accepted FGIS 1.0.23 GOST algorithm URI without
-- rewriting the legacy compact identifier column. The migration is additive
-- and remains compatible with application rollback.
ALTER TABLE public."regulatory_integration_inbox_entries"
  ADD COLUMN "signatureAlgorithmUri" text;

ALTER TABLE public."regulatory_integration_inbox_entries"
  ADD CONSTRAINT "regulatory_integration_inbox_signature_algorithm_uri_ck"
  CHECK (
    "signatureAlgorithmUri" IS NULL
    OR (
      char_length("signatureAlgorithmUri") BETWEEN 1 AND 1024
      AND "signatureAlgorithmUri" !~ '[[:cntrl:]]'
    )
  );

-- Existing verified FGIS 1.0.23 inbox rows already carry the accepted compact
-- GOST identifier. Materialize the exact official URI for those rows before
-- the projection repository starts enforcing the two-field authority tuple.
UPDATE public."regulatory_integration_inbox_entries"
SET "signatureAlgorithmUri" =
  'urn:ietf:params:xml:ns:cpxmlsec:algorithms:gostr34102012-gostr34112012-256'
WHERE "signatureAlgorithmUri" IS NULL
  AND "adapterCode" = 'FGIS_ZERNO'
  AND "adapterVersion" = '1.0.23'
  AND "provider" = 'FGIS_ZERNO'
  AND "schemaVersion" = '1.0.23'
  AND "signatureStatus" = 'VERIFIED'
  AND "signatureAlgorithm" = 'GOST3410_2012_256';

-- The existing inbox receive path intentionally keeps the compact code as its
-- transport contract. This database boundary deterministically derives the
-- pinned URI for new rows and for rows that become VERIFIED later, preventing
-- null authority without broadening the accepted algorithm set.
CREATE OR REPLACE FUNCTION public.materialize_fgis_grain_signature_algorithm_uri()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW."signatureAlgorithmUri" IS NULL
     AND NEW."adapterCode" = 'FGIS_ZERNO'
     AND NEW."adapterVersion" = '1.0.23'
     AND NEW."provider" = 'FGIS_ZERNO'
     AND NEW."schemaVersion" = '1.0.23'
     AND NEW."signatureStatus" = 'VERIFIED'
     AND NEW."signatureAlgorithm" = 'GOST3410_2012_256'
  THEN
    NEW."signatureAlgorithmUri" :=
      'urn:ietf:params:xml:ns:cpxmlsec:algorithms:gostr34102012-gostr34112012-256';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER "regulatory_integration_inbox_materialize_fgis_signature_uri"
BEFORE INSERT OR UPDATE OF
  "adapterCode",
  "adapterVersion",
  "provider",
  "schemaVersion",
  "signatureStatus",
  "signatureAlgorithm",
  "signatureAlgorithmUri"
ON public."regulatory_integration_inbox_entries"
FOR EACH ROW
EXECUTE FUNCTION public.materialize_fgis_grain_signature_algorithm_uri();

-- Serialize both existing and first-time SDIZ identifier/number claims.
-- Ordering with the C collation prevents deadlocks across overlapping batches.
CREATE OR REPLACE FUNCTION public.lock_fgis_grain_sdiz_projection_keys(p_keys text[])
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
DECLARE
  lock_key text;
  key_count integer;
BEGIN
  key_count := COALESCE(cardinality(p_keys), 0);
  IF key_count < 1 OR key_count > 400 THEN
    RAISE EXCEPTION 'FGIS SDIZ lock key count must be between 1 and 400'
      USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM unnest(p_keys) AS incoming(value)
    WHERE value IS NULL OR char_length(value) < 1 OR char_length(value) > 1024
  ) THEN
    RAISE EXCEPTION 'FGIS SDIZ lock key is invalid'
      USING ERRCODE = '22023';
  END IF;
  FOR lock_key IN
    SELECT DISTINCT value COLLATE "C" AS value
    FROM unnest(p_keys) AS incoming(value)
    ORDER BY value
  LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended(lock_key, 0));
  END LOOP;
END;
$function$;

-- Preserve the existing global audit-chain row lock without granting the
-- restricted runtime principal UPDATE authority over immutable audit rows.
CREATE OR REPLACE FUNCTION public.lock_fgis_grain_sdiz_audit_head()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  latest_hash text;
BEGIN
  SELECT a."hash"
  INTO latest_hash
  FROM public."audit_events" AS a
  ORDER BY a."createdAt" DESC, a."id" DESC
  LIMIT 1
  FOR UPDATE;
  RETURN COALESCE(latest_hash, '');
END;
$function$;

REVOKE ALL ON FUNCTION public.lock_fgis_grain_sdiz_projection_keys(text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.lock_fgis_grain_sdiz_audit_head() FROM PUBLIC;

DO $fgis_sdiz_function_grants$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_runtime') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.lock_fgis_grain_sdiz_projection_keys(text[]) TO app_runtime';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.lock_fgis_grain_sdiz_audit_head() TO app_runtime';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_service') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.lock_fgis_grain_sdiz_projection_keys(text[]) TO app_service';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.lock_fgis_grain_sdiz_audit_head() TO app_service';
  END IF;
END
$fgis_sdiz_function_grants$;

CREATE TABLE public."fgis_grain_sdiz_projection_batches" (
  "id" text PRIMARY KEY,
  "tenantId" text NOT NULL,
  "organizationId" text NOT NULL,
  "sourceInboxEntryId" text NOT NULL UNIQUE,
  "sourceRawBodySha256" text NOT NULL,
  "sourceEvidenceReference" text NOT NULL,
  "providerMessageId" text NOT NULL,
  "providerReferenceMessageId" text,
  "providerOccurredAt" timestamptz NOT NULL,
  "batchFingerprint" text NOT NULL,
  "recordCount" integer NOT NULL,
  "auditEventId" text NOT NULL UNIQUE,
  "outboxEntryId" text NOT NULL UNIQUE,
  "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT "fgis_grain_sdiz_batch_org_fk"
    FOREIGN KEY ("organizationId") REFERENCES public."organizations"("id")
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT "fgis_grain_sdiz_batch_inbox_fk"
    FOREIGN KEY ("sourceInboxEntryId") REFERENCES public."regulatory_integration_inbox_entries"("id")
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT "fgis_grain_sdiz_batch_audit_fk"
    FOREIGN KEY ("auditEventId") REFERENCES public."audit_events"("id")
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT "fgis_grain_sdiz_batch_outbox_fk"
    FOREIGN KEY ("outboxEntryId") REFERENCES public."outbox_entries"("id")
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT "fgis_grain_sdiz_batch_hash_ck"
    CHECK ("sourceRawBodySha256" ~ '^[a-f0-9]{64}$' AND "batchFingerprint" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "fgis_grain_sdiz_batch_count_ck"
    CHECK ("recordCount" BETWEEN 1 AND 200)
);

CREATE UNIQUE INDEX "fgis_grain_sdiz_batch_identity_key"
  ON public."fgis_grain_sdiz_projection_batches"
  ("tenantId", "organizationId", "sourceInboxEntryId", "batchFingerprint");
CREATE INDEX "fgis_grain_sdiz_batch_provider_message_idx"
  ON public."fgis_grain_sdiz_projection_batches"
  ("tenantId", "organizationId", "providerMessageId");
CREATE INDEX "fgis_grain_sdiz_batch_created_idx"
  ON public."fgis_grain_sdiz_projection_batches" ("createdAt" DESC, "id");

CREATE TABLE public."fgis_grain_sdiz_projections" (
  "id" text PRIMARY KEY,
  "tenantId" text NOT NULL,
  "organizationId" text NOT NULL,
  "sdizId" text NOT NULL,
  "sdizNumber" text NOT NULL,
  "lotNumber" text,
  "createLotNumber" text,
  "correctedBySdizNumber" text,
  "correctedSdizNumber" text,
  "extinctionId" text,
  "extinctionRefusalId" text,
  "status" text NOT NULL,
  "providerMessageId" text NOT NULL,
  "providerReferenceMessageId" text,
  "providerOccurredAt" timestamptz NOT NULL,
  "payloadFingerprint" text NOT NULL,
  "sourceInboxEntryId" text NOT NULL,
  "projectionBatchId" text NOT NULL,
  "version" bigint NOT NULL DEFAULT 0,
  "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  "updatedAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT "fgis_grain_sdiz_projection_org_fk"
    FOREIGN KEY ("organizationId") REFERENCES public."organizations"("id")
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT "fgis_grain_sdiz_projection_inbox_fk"
    FOREIGN KEY ("sourceInboxEntryId") REFERENCES public."regulatory_integration_inbox_entries"("id")
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT "fgis_grain_sdiz_projection_batch_fk"
    FOREIGN KEY ("projectionBatchId") REFERENCES public."fgis_grain_sdiz_projection_batches"("id")
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT "fgis_grain_sdiz_projection_status_ck"
    CHECK ("status" IN ('CREATED', 'SUBSCRIBED', 'CANCELED', 'EXTINGUISHED', 'SUBSCRIBED_CONFIRMED')),
  CONSTRAINT "fgis_grain_sdiz_projection_hash_ck"
    CHECK ("payloadFingerprint" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "fgis_grain_sdiz_projection_version_ck"
    CHECK ("version" >= 0),
  CONSTRAINT "fgis_grain_sdiz_projection_identity_key"
    UNIQUE ("tenantId", "organizationId", "sdizId")
);

CREATE UNIQUE INDEX "fgis_grain_sdiz_projection_number_key"
  ON public."fgis_grain_sdiz_projections"
  ("tenantId", "organizationId", "sdizNumber");
CREATE INDEX "fgis_grain_sdiz_projection_lot_idx"
  ON public."fgis_grain_sdiz_projections"
  ("tenantId", "organizationId", "lotNumber");
CREATE INDEX "fgis_grain_sdiz_projection_status_idx"
  ON public."fgis_grain_sdiz_projections"
  ("tenantId", "organizationId", "status", "providerOccurredAt" DESC);
CREATE INDEX "fgis_grain_sdiz_projection_source_idx"
  ON public."fgis_grain_sdiz_projections"
  ("sourceInboxEntryId", "projectionBatchId");
CREATE INDEX "fgis_grain_sdiz_projection_freshness_idx"
  ON public."fgis_grain_sdiz_projections"
  ("updatedAt" DESC, "id");

CREATE OR REPLACE FUNCTION public.reject_fgis_grain_sdiz_batch_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  RAISE EXCEPTION 'FGIS Grain SDIZ projection batches are immutable'
    USING ERRCODE = '55000';
END;
$function$;

CREATE TRIGGER "fgis_grain_sdiz_batches_no_update"
BEFORE UPDATE ON public."fgis_grain_sdiz_projection_batches"
FOR EACH ROW EXECUTE FUNCTION public.reject_fgis_grain_sdiz_batch_mutation();

CREATE TRIGGER "fgis_grain_sdiz_batches_no_delete"
BEFORE DELETE ON public."fgis_grain_sdiz_projection_batches"
FOR EACH ROW EXECUTE FUNCTION public.reject_fgis_grain_sdiz_batch_mutation();

ALTER TABLE public."fgis_grain_sdiz_projection_batches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."fgis_grain_sdiz_projection_batches" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."fgis_grain_sdiz_projections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."fgis_grain_sdiz_projections" FORCE ROW LEVEL SECURITY;

-- Read authority is broader than mutation authority, but both are bound
-- to a complete trusted RLS context and the canonical runtime principals.
CREATE POLICY "fgis_grain_sdiz_batch_select_policy"
ON public."fgis_grain_sdiz_projection_batches"
FOR SELECT
USING (
  current_user IN ('app_runtime', 'app_service')
  AND public.app_rls_context_ready()
  AND current_setting('app.current_role', true)
    IN ('ADMIN', 'COMPLIANCE_OFFICER', 'EXECUTIVE')
  AND "tenantId" = current_setting('app.current_tenant_id', true)
  AND "organizationId" = current_setting('app.current_org_id', true)
);

CREATE POLICY "fgis_grain_sdiz_batch_insert_policy"
ON public."fgis_grain_sdiz_projection_batches"
FOR INSERT
WITH CHECK (
  current_user IN ('app_runtime', 'app_service')
  AND public.app_rls_context_ready()
  AND current_setting('app.current_role', true)
    IN ('ADMIN', 'COMPLIANCE_OFFICER')
  AND "tenantId" = current_setting('app.current_tenant_id', true)
  AND "organizationId" = current_setting('app.current_org_id', true)
);

CREATE POLICY "fgis_grain_sdiz_projection_select_policy"
ON public."fgis_grain_sdiz_projections"
FOR SELECT
USING (
  current_user IN ('app_runtime', 'app_service')
  AND public.app_rls_context_ready()
  AND current_setting('app.current_role', true)
    IN ('ADMIN', 'COMPLIANCE_OFFICER', 'EXECUTIVE')
  AND "tenantId" = current_setting('app.current_tenant_id', true)
  AND "organizationId" = current_setting('app.current_org_id', true)
);

CREATE POLICY "fgis_grain_sdiz_projection_insert_policy"
ON public."fgis_grain_sdiz_projections"
FOR INSERT
WITH CHECK (
  current_user IN ('app_runtime', 'app_service')
  AND public.app_rls_context_ready()
  AND current_setting('app.current_role', true)
    IN ('ADMIN', 'COMPLIANCE_OFFICER')
  AND "tenantId" = current_setting('app.current_tenant_id', true)
  AND "organizationId" = current_setting('app.current_org_id', true)
);

CREATE POLICY "fgis_grain_sdiz_projection_update_policy"
ON public."fgis_grain_sdiz_projections"
FOR UPDATE
USING (
  current_user IN ('app_runtime', 'app_service')
  AND public.app_rls_context_ready()
  AND current_setting('app.current_role', true)
    IN ('ADMIN', 'COMPLIANCE_OFFICER')
  AND "tenantId" = current_setting('app.current_tenant_id', true)
  AND "organizationId" = current_setting('app.current_org_id', true)
)
WITH CHECK (
  current_user IN ('app_runtime', 'app_service')
  AND public.app_rls_context_ready()
  AND current_setting('app.current_role', true)
    IN ('ADMIN', 'COMPLIANCE_OFFICER')
  AND "tenantId" = current_setting('app.current_tenant_id', true)
  AND "organizationId" = current_setting('app.current_org_id', true)
);

-- New tables do not inherit historical GRANT ON ALL TABLES statements.
-- Materialize the least-privilege production grants when a canonical runtime
-- principal already exists at migration time; no DELETE authority is granted.
DO $fgis_sdiz_table_grants$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_runtime') THEN
    EXECUTE 'GRANT USAGE ON SCHEMA public TO app_runtime';
    EXECUTE 'GRANT SELECT, INSERT ON TABLE public."fgis_grain_sdiz_projection_batches" TO app_runtime';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE ON TABLE public."fgis_grain_sdiz_projections" TO app_runtime';
    EXECUTE 'REVOKE UPDATE, DELETE ON TABLE public."fgis_grain_sdiz_projection_batches" FROM app_runtime';
    EXECUTE 'REVOKE DELETE ON TABLE public."fgis_grain_sdiz_projections" FROM app_runtime';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_service') THEN
    EXECUTE 'GRANT USAGE ON SCHEMA public TO app_service';
    EXECUTE 'GRANT SELECT, INSERT ON TABLE public."fgis_grain_sdiz_projection_batches" TO app_service';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE ON TABLE public."fgis_grain_sdiz_projections" TO app_service';
    EXECUTE 'REVOKE UPDATE, DELETE ON TABLE public."fgis_grain_sdiz_projection_batches" FROM app_service';
    EXECUTE 'REVOKE DELETE ON TABLE public."fgis_grain_sdiz_projections" FROM app_service';
  END IF;
END
$fgis_sdiz_table_grants$;

-- Add a narrow non-Deal outbox boundary for the two canonical SDIZ events.
-- The generic Deal policy remains unchanged and all payload authority is bound
-- to the trusted transaction-local user, tenant, organization and role.
DROP POLICY IF EXISTS outbox_entries_fgis_sdiz_select ON public."outbox_entries";
CREATE POLICY outbox_entries_fgis_sdiz_select
ON public."outbox_entries"
FOR SELECT
TO PUBLIC
USING (
  current_user IN ('app_runtime', 'app_service')
  AND public.app_rls_context_ready()
  AND current_setting('app.current_role', true) IN ('ADMIN', 'COMPLIANCE_OFFICER')
  AND "dealId" IS NULL
  AND "auditId" IS NOT NULL
  AND jsonb_typeof("payload") = 'object'
  AND "payload"->>'schemaVersion' = 'pc-crop.fgis-grain-sdiz-projection-batch.v1'
  AND "payload"->>'tenantId' = current_setting('app.current_tenant_id', true)
  AND "payload"->>'organizationId' = current_setting('app.current_org_id', true)
  AND (
    ("type" = 'FGIS_GRAIN_SDIZ_PROJECTION_APPLIED' AND "payload"->>'kind' = 'APPLIED')
    OR
    ("type" = 'FGIS_GRAIN_SDIZ_PROJECTION_CONFLICT' AND "payload"->>'kind' = 'QUARANTINED')
  )
);

DROP POLICY IF EXISTS outbox_entries_fgis_sdiz_insert ON public."outbox_entries";
CREATE POLICY outbox_entries_fgis_sdiz_insert
ON public."outbox_entries"
FOR INSERT
TO PUBLIC
WITH CHECK (
  current_user IN ('app_runtime', 'app_service')
  AND public.app_rls_context_ready()
  AND current_setting('app.current_role', true) IN ('ADMIN', 'COMPLIANCE_OFFICER')
  AND "dealId" IS NULL
  AND "triggeredByUserId" = current_setting('app.current_user_id', true)
  AND "auditId" IS NOT NULL
  AND "correlationId" IS NOT NULL
  AND jsonb_typeof("payload") = 'object'
  AND "payload"->>'schemaVersion' = 'pc-crop.fgis-grain-sdiz-projection-batch.v1'
  AND "payload"->>'tenantId' = current_setting('app.current_tenant_id', true)
  AND "payload"->>'organizationId' = current_setting('app.current_org_id', true)
  AND NULLIF("payload"->>'inboxEntryId', '') IS NOT NULL
  AND starts_with(
    "idempotencyKey",
    'fgis-sdiz-projection:'
      || current_setting('app.current_tenant_id', true) || ':'
      || current_setting('app.current_org_id', true) || ':'
      || ("payload"->>'inboxEntryId') || ':'
  )
  AND (
    ("type" = 'FGIS_GRAIN_SDIZ_PROJECTION_APPLIED' AND "payload"->>'kind' = 'APPLIED')
    OR
    ("type" = 'FGIS_GRAIN_SDIZ_PROJECTION_CONFLICT' AND "payload"->>'kind' = 'QUARANTINED')
  )
);

