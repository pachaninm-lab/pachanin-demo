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

-- Projection writes are available only through this verified-inbox command boundary.
-- Runtime principals keep SELECT on the tables and cannot issue raw INSERT/UPDATE/DELETE.
CREATE OR REPLACE FUNCTION public.write_fgis_grain_sdiz_projection_batch(
  p_batch_id text,
  p_tenant_id text,
  p_organization_id text,
  p_inbox_entry_id text,
  p_worker_id text,
  p_expected_inbox_version bigint,
  p_provider_message_id text,
  p_provider_reference_message_id text,
  p_provider_occurred_at timestamptz,
  p_batch_fingerprint text,
  p_audit_event_id text,
  p_outbox_entry_id text,
  p_records jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  inbox_row public."regulatory_integration_inbox_entries"%ROWTYPE;
  record_value jsonb;
  previous_sdiz_id text;
  previous_sdiz_number text;
  seen_sdiz_ids text[] := ARRAY[]::text[];
  seen_sdiz_numbers text[] := ARRAY[]::text[];
  affected integer;
  written_count integer := 0;
BEGIN
  IF session_user NOT IN ('app_runtime', 'app_service')
     AND NOT COALESCE((
       SELECT role_row.rolsuper
       FROM pg_catalog.pg_roles AS role_row
       WHERE role_row.rolname = session_user
     ), false)
  THEN
    RAISE EXCEPTION 'FGIS SDIZ projection writer principal is denied'
      USING ERRCODE = '42501';
  END IF;

  IF NOT public.app_rls_context_ready()
     OR current_setting('app.current_role', true)
       NOT IN ('ADMIN', 'COMPLIANCE_OFFICER')
     OR p_tenant_id IS DISTINCT FROM current_setting('app.current_tenant_id', true)
     OR p_organization_id IS DISTINCT FROM current_setting('app.current_org_id', true)
  THEN
    RAISE EXCEPTION 'FGIS SDIZ trusted mutation context is denied'
      USING ERRCODE = '42501';
  END IF;

  IF p_batch_id IS NULL OR char_length(p_batch_id) NOT BETWEEN 1 AND 255
     OR p_inbox_entry_id IS NULL OR char_length(p_inbox_entry_id) NOT BETWEEN 1 AND 255
     OR p_worker_id IS NULL OR char_length(p_worker_id) NOT BETWEEN 1 AND 255
     OR p_provider_message_id IS NULL
     OR char_length(p_provider_message_id) NOT BETWEEN 1 AND 255
     OR (
       p_provider_reference_message_id IS NOT NULL
       AND char_length(p_provider_reference_message_id) NOT BETWEEN 1 AND 255
     )
     OR p_provider_occurred_at IS NULL
     OR p_expected_inbox_version < 0
     OR p_batch_fingerprint !~ '^[a-f0-9]{64}$'
     OR jsonb_typeof(p_records) IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_records) NOT BETWEEN 1 AND 200
  THEN
    RAISE EXCEPTION 'FGIS SDIZ controlled writer input is invalid'
      USING ERRCODE = '22023';
  END IF;

  SELECT inbox.*
  INTO inbox_row
  FROM public."regulatory_integration_inbox_entries" AS inbox
  WHERE inbox."id" = p_inbox_entry_id
    AND inbox."tenantId" = p_tenant_id
    AND inbox."organizationId" = p_organization_id
  FOR UPDATE;

  IF NOT FOUND
     OR inbox_row."state" <> 'PROCESSING'
     OR inbox_row."leaseOwner" IS DISTINCT FROM p_worker_id
     OR inbox_row."leaseExpiresAt" IS NULL
     OR inbox_row."leaseExpiresAt" < clock_timestamp()
     OR inbox_row."version" <> p_expected_inbox_version
     OR inbox_row."provider" <> 'FGIS_ZERNO'
     OR inbox_row."adapterCode" <> 'FGIS_ZERNO'
     OR inbox_row."adapterVersion" <> '1.0.23'
     OR inbox_row."schemaVersion" <> '1.0.23'
     OR inbox_row."mappingVersion" <> 'fgis-zerno-1.0.23-catalog.v1'
     OR inbox_row."signatureStatus" <> 'VERIFIED'
     OR inbox_row."signatureAlgorithm" <> 'GOST3410_2012_256'
     OR inbox_row."signatureAlgorithmUri"
       <> 'urn:ietf:params:xml:ns:cpxmlsec:algorithms:gostr34102012-gostr34112012-256'
     OR inbox_row."verificationResult"->'verified' <> 'true'::jsonb
     OR inbox_row."verificationResult"->>'schemaVersion' <> '1.0.23'
     OR inbox_row."verificationResult"->>'mappingVersion'
       <> 'fgis-zerno-1.0.23-catalog.v1'
     OR inbox_row."externalEventId" IS DISTINCT FROM p_provider_message_id
     OR inbox_row."causationId" IS DISTINCT FROM p_provider_reference_message_id
     OR inbox_row."occurredAt" IS DISTINCT FROM p_provider_occurred_at
  THEN
    RAISE EXCEPTION 'FGIS SDIZ verified inbox authority is invalid'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public."audit_events" AS audit
    JOIN public."outbox_entries" AS outbox
      ON outbox."auditId" = audit."id"
    WHERE audit."id" = p_audit_event_id
      AND audit."action" = 'FGIS_GRAIN_SDIZ_PROJECTION_APPLIED'
      AND audit."actorUserId" = current_setting('app.current_user_id', true)
      AND audit."actorRole"::text = current_setting('app.current_role', true)
      AND audit."tenantId" = p_tenant_id
      AND audit."orgId" = p_organization_id
      AND audit."objectType" = 'FGIS_GRAIN_SDIZ_PROJECTION_BATCH'
      AND audit."objectId" = p_batch_id
      AND audit."outcome" = 'SUCCESS'
      AND outbox."id" = p_outbox_entry_id
      AND outbox."type" = 'FGIS_GRAIN_SDIZ_PROJECTION_APPLIED'
      AND outbox."dealId" IS NULL
      AND outbox."status" = 'PENDING'
      AND outbox."triggeredByUserId" = current_setting('app.current_user_id', true)
      AND outbox."idempotencyKey" = audit."runtimeIdempotencyKey"
      AND outbox."correlationId" = audit."correlationId"
      AND outbox."payload" = audit."metadata"
      AND outbox."payload"->>'schemaVersion'
        = 'pc-crop.fgis-grain-sdiz-projection-batch.v1'
      AND outbox."payload"->>'kind' = 'APPLIED'
      AND outbox."payload"->>'projectionBatchId' = p_batch_id
      AND outbox."payload"->>'inboxEntryId' = p_inbox_entry_id
      AND outbox."payload"->>'tenantId' = p_tenant_id
      AND outbox."payload"->>'organizationId' = p_organization_id
      AND outbox."payload"->>'providerMessageId' = p_provider_message_id
      AND outbox."payload"->>'providerReferenceMessageId'
        IS NOT DISTINCT FROM p_provider_reference_message_id
      AND outbox."payload"->>'rawBodySha256' = inbox_row."rawBodySha256"
      AND outbox."payload"->>'batchFingerprint' = p_batch_fingerprint
      AND (outbox."payload"->>'recordCount')::integer = jsonb_array_length(p_records)
      AND (outbox."payload"->>'providerOccurredAt')::timestamptz
        = p_provider_occurred_at
  ) THEN
    RAISE EXCEPTION 'FGIS SDIZ audit/outbox authority is invalid'
      USING ERRCODE = '42501';
  END IF;

  FOR record_value IN
    SELECT incoming.value
    FROM jsonb_array_elements(p_records) WITH ORDINALITY AS incoming(value, ordinal)
    ORDER BY incoming.ordinal
  LOOP
    IF jsonb_typeof(record_value) IS DISTINCT FROM 'object'
       OR (SELECT count(*) FROM jsonb_object_keys(record_value)) <> 10
       OR EXISTS (
         SELECT 1
         FROM jsonb_object_keys(record_value) AS incoming_key(value)
         WHERE incoming_key.value NOT IN (
           'correctedBySdizNumber',
           'correctedSdizNumber',
           'createLotNumber',
           'extinctionId',
           'extinctionRefusalId',
           'lotNumber',
           'payloadFingerprint',
           'sdizId',
           'sdizNumber',
           'status'
         )
       )
       OR jsonb_typeof(record_value->'sdizId') IS DISTINCT FROM 'string'
       OR jsonb_typeof(record_value->'sdizNumber') IS DISTINCT FROM 'string'
       OR jsonb_typeof(record_value->'status') IS DISTINCT FROM 'string'
       OR jsonb_typeof(record_value->'payloadFingerprint') IS DISTINCT FROM 'string'
       OR COALESCE(jsonb_typeof(record_value->'lotNumber'), 'missing')
         NOT IN ('string', 'null')
       OR COALESCE(jsonb_typeof(record_value->'createLotNumber'), 'missing')
         NOT IN ('string', 'null')
       OR COALESCE(jsonb_typeof(record_value->'correctedBySdizNumber'), 'missing')
         NOT IN ('string', 'null')
       OR COALESCE(jsonb_typeof(record_value->'correctedSdizNumber'), 'missing')
         NOT IN ('string', 'null')
       OR COALESCE(jsonb_typeof(record_value->'extinctionId'), 'missing')
         NOT IN ('string', 'null')
       OR COALESCE(jsonb_typeof(record_value->'extinctionRefusalId'), 'missing')
         NOT IN ('string', 'null')
       OR char_length(record_value->>'sdizId') NOT BETWEEN 1 AND 255
       OR char_length(record_value->>'sdizNumber') NOT BETWEEN 1 AND 255
       OR record_value->>'status' NOT IN (
         'CREATED',
         'SUBSCRIBED',
         'CANCELED',
         'EXTINGUISHED',
         'SUBSCRIBED_CONFIRMED'
       )
       OR record_value->>'payloadFingerprint' !~ '^[a-f0-9]{64}$'
       OR EXISTS (
         SELECT 1
         FROM jsonb_each(record_value) AS optional_field(key, value)
         WHERE optional_field.key IN (
           'lotNumber',
           'createLotNumber',
           'correctedBySdizNumber',
           'correctedSdizNumber',
           'extinctionId',
           'extinctionRefusalId'
         )
           AND jsonb_typeof(optional_field.value) = 'string'
           AND char_length(optional_field.value #>> '{}') NOT BETWEEN 1 AND 255
       )
    THEN
      RAISE EXCEPTION 'FGIS SDIZ canonical record is invalid'
        USING ERRCODE = '22023';
    END IF;

    IF (record_value->>'sdizId') = ANY(seen_sdiz_ids)
       OR (record_value->>'sdizNumber') = ANY(seen_sdiz_numbers)
    THEN
      RAISE EXCEPTION 'FGIS SDIZ canonical record identity is duplicated'
        USING ERRCODE = '22023';
    END IF;

    IF previous_sdiz_id IS NOT NULL
       AND (
         previous_sdiz_id COLLATE "C" > (record_value->>'sdizId') COLLATE "C"
         OR (
           previous_sdiz_id = record_value->>'sdizId'
           AND previous_sdiz_number COLLATE "C"
             >= (record_value->>'sdizNumber') COLLATE "C"
         )
       )
    THEN
      RAISE EXCEPTION 'FGIS SDIZ canonical record ordering is invalid'
        USING ERRCODE = '22023';
    END IF;

    seen_sdiz_ids := array_append(seen_sdiz_ids, record_value->>'sdizId');
    seen_sdiz_numbers := array_append(seen_sdiz_numbers, record_value->>'sdizNumber');
    previous_sdiz_id := record_value->>'sdizId';
    previous_sdiz_number := record_value->>'sdizNumber';
  END LOOP;

  INSERT INTO public."fgis_grain_sdiz_projection_batches" (
    "id", "tenantId", "organizationId", "sourceInboxEntryId",
    "sourceRawBodySha256", "sourceEvidenceReference", "providerMessageId",
    "providerReferenceMessageId", "providerOccurredAt", "batchFingerprint",
    "recordCount", "auditEventId", "outboxEntryId"
  ) VALUES (
    p_batch_id, p_tenant_id, p_organization_id, p_inbox_entry_id,
    inbox_row."rawBodySha256", inbox_row."evidenceReference",
    p_provider_message_id, p_provider_reference_message_id,
    p_provider_occurred_at, p_batch_fingerprint, jsonb_array_length(p_records),
    p_audit_event_id, p_outbox_entry_id
  );

  FOR record_value IN
    SELECT incoming.value
    FROM jsonb_array_elements(p_records) WITH ORDINALITY AS incoming(value, ordinal)
    ORDER BY incoming.ordinal
  LOOP
    INSERT INTO public."fgis_grain_sdiz_projections" (
      "id", "tenantId", "organizationId", "sdizId", "sdizNumber", "lotNumber",
      "createLotNumber", "correctedBySdizNumber", "correctedSdizNumber",
      "extinctionId", "extinctionRefusalId", "status", "providerMessageId",
      "providerReferenceMessageId", "providerOccurredAt", "payloadFingerprint",
      "sourceInboxEntryId", "projectionBatchId", "version"
    ) VALUES (
      gen_random_uuid()::text, p_tenant_id, p_organization_id,
      record_value->>'sdizId', record_value->>'sdizNumber',
      record_value->>'lotNumber', record_value->>'createLotNumber',
      record_value->>'correctedBySdizNumber', record_value->>'correctedSdizNumber',
      record_value->>'extinctionId', record_value->>'extinctionRefusalId',
      record_value->>'status', p_provider_message_id,
      p_provider_reference_message_id, p_provider_occurred_at,
      record_value->>'payloadFingerprint', p_inbox_entry_id, p_batch_id, 0
    )
    ON CONFLICT ("tenantId", "organizationId", "sdizId") DO UPDATE
    SET "sdizNumber" = EXCLUDED."sdizNumber",
        "lotNumber" = EXCLUDED."lotNumber",
        "createLotNumber" = EXCLUDED."createLotNumber",
        "correctedBySdizNumber" = EXCLUDED."correctedBySdizNumber",
        "correctedSdizNumber" = EXCLUDED."correctedSdizNumber",
        "extinctionId" = EXCLUDED."extinctionId",
        "extinctionRefusalId" = EXCLUDED."extinctionRefusalId",
        "status" = EXCLUDED."status",
        "providerMessageId" = EXCLUDED."providerMessageId",
        "providerReferenceMessageId" = EXCLUDED."providerReferenceMessageId",
        "providerOccurredAt" = EXCLUDED."providerOccurredAt",
        "payloadFingerprint" = EXCLUDED."payloadFingerprint",
        "sourceInboxEntryId" = EXCLUDED."sourceInboxEntryId",
        "projectionBatchId" = EXCLUDED."projectionBatchId",
        "version" = public."fgis_grain_sdiz_projections"."version" + 1,
        "updatedAt" = clock_timestamp()
    WHERE public."fgis_grain_sdiz_projections"."providerOccurredAt"
            < EXCLUDED."providerOccurredAt"
       OR (
         public."fgis_grain_sdiz_projections"."providerOccurredAt"
           = EXCLUDED."providerOccurredAt"
         AND public."fgis_grain_sdiz_projections"."payloadFingerprint"
           = EXCLUDED."payloadFingerprint"
         AND public."fgis_grain_sdiz_projections"."sdizNumber"
           = EXCLUDED."sdizNumber"
         AND (
           public."fgis_grain_sdiz_projections"."providerMessageId"
             IS DISTINCT FROM EXCLUDED."providerMessageId"
           OR public."fgis_grain_sdiz_projections"."providerReferenceMessageId"
             IS DISTINCT FROM EXCLUDED."providerReferenceMessageId"
           OR public."fgis_grain_sdiz_projections"."sourceInboxEntryId"
             IS DISTINCT FROM EXCLUDED."sourceInboxEntryId"
           OR public."fgis_grain_sdiz_projections"."projectionBatchId"
             IS DISTINCT FROM EXCLUDED."projectionBatchId"
         )
       );

    GET DIAGNOSTICS affected = ROW_COUNT;
    IF affected <> 1 THEN
      RAISE EXCEPTION 'FGIS SDIZ projection monotonic write was not applied'
        USING ERRCODE = '40001';
    END IF;
    written_count := written_count + affected;
  END LOOP;

  RETURN written_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.write_fgis_grain_sdiz_projection_batch(
  text, text, text, text, text, bigint, text, text, timestamptz,
  text, text, text, jsonb
) FROM PUBLIC;
REVOKE INSERT, UPDATE, DELETE ON TABLE
  public."fgis_grain_sdiz_projection_batches",
  public."fgis_grain_sdiz_projections"
FROM PUBLIC;

-- New tables do not inherit historical GRANT ON ALL TABLES statements.
-- Runtime principals receive read access plus the controlled command function.
DO $fgis_sdiz_table_grants$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_runtime') THEN
    EXECUTE 'GRANT USAGE ON SCHEMA public TO app_runtime';
    EXECUTE 'GRANT SELECT ON TABLE public."fgis_grain_sdiz_projection_batches" TO app_runtime';
    EXECUTE 'GRANT SELECT ON TABLE public."fgis_grain_sdiz_projections" TO app_runtime';
    EXECUTE 'REVOKE INSERT, UPDATE, DELETE ON TABLE public."fgis_grain_sdiz_projection_batches" FROM app_runtime';
    EXECUTE 'REVOKE INSERT, UPDATE, DELETE ON TABLE public."fgis_grain_sdiz_projections" FROM app_runtime';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.write_fgis_grain_sdiz_projection_batch(text, text, text, text, text, bigint, text, text, timestamptz, text, text, text, jsonb) TO app_runtime';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_service') THEN
    EXECUTE 'GRANT USAGE ON SCHEMA public TO app_service';
    EXECUTE 'GRANT SELECT ON TABLE public."fgis_grain_sdiz_projection_batches" TO app_service';
    EXECUTE 'GRANT SELECT ON TABLE public."fgis_grain_sdiz_projections" TO app_service';
    EXECUTE 'REVOKE INSERT, UPDATE, DELETE ON TABLE public."fgis_grain_sdiz_projection_batches" FROM app_service';
    EXECUTE 'REVOKE INSERT, UPDATE, DELETE ON TABLE public."fgis_grain_sdiz_projections" FROM app_service';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.write_fgis_grain_sdiz_projection_batch(text, text, text, text, text, bigint, text, text, timestamptz, text, text, text, jsonb) TO app_service';
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

