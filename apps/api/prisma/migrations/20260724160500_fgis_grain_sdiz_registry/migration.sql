CREATE TABLE public."fgis_grain_sdiz_projection_batches" (
  "id" text PRIMARY KEY,
  "tenantId" text NOT NULL,
  "organizationId" text NOT NULL,
  "sourceInboxEntryId" text NOT NULL UNIQUE,
  "provider" text NOT NULL DEFAULT 'FGIS_ZERNO',
  "schemaVersion" text NOT NULL DEFAULT '1.0.23',
  "mappingVersion" text NOT NULL DEFAULT 'fgis-zerno-1.0.23-catalog.v1',
  "messageId" text NOT NULL,
  "referenceMessageId" text NOT NULL,
  "rawBodySha256" char(64) NOT NULL,
  "evidenceReference" text NOT NULL,
  "batchFingerprint" char(64) NOT NULL,
  "recordCount" integer NOT NULL,
  "providerOccurredMin" timestamptz(3) NOT NULL,
  "providerOccurredMax" timestamptz(3) NOT NULL,
  "auditId" text NOT NULL,
  "outboxEntryId" text NOT NULL,
  "appliedByWorkerId" text NOT NULL,
  "appliedAt" timestamptz(3) NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT "fgis_grain_sdiz_batch_org_fk"
    FOREIGN KEY ("organizationId") REFERENCES public."organizations"("id")
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT "fgis_grain_sdiz_batch_inbox_fk"
    FOREIGN KEY ("sourceInboxEntryId")
    REFERENCES public."regulatory_integration_inbox_entries"("id")
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT "fgis_grain_sdiz_batch_outbox_fk"
    FOREIGN KEY ("outboxEntryId") REFERENCES public."outbox_entries"("id")
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT "fgis_grain_sdiz_batch_provider_ck"
    CHECK ("provider" = 'FGIS_ZERNO'),
  CONSTRAINT "fgis_grain_sdiz_batch_schema_ck"
    CHECK ("schemaVersion" = '1.0.23'),
  CONSTRAINT "fgis_grain_sdiz_batch_mapping_ck"
    CHECK ("mappingVersion" = 'fgis-zerno-1.0.23-catalog.v1'),
  CONSTRAINT "fgis_grain_sdiz_batch_raw_hash_ck"
    CHECK ("rawBodySha256" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "fgis_grain_sdiz_batch_fingerprint_ck"
    CHECK ("batchFingerprint" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "fgis_grain_sdiz_batch_count_ck"
    CHECK ("recordCount" BETWEEN 1 AND 500),
  CONSTRAINT "fgis_grain_sdiz_batch_time_ck"
    CHECK ("providerOccurredMin" <= "providerOccurredMax")
);

CREATE INDEX "fgis_grain_sdiz_batch_tenant_org_applied_idx"
  ON public."fgis_grain_sdiz_projection_batches"
  ("tenantId", "organizationId", "appliedAt" DESC, "id");
CREATE INDEX "fgis_grain_sdiz_batch_message_idx"
  ON public."fgis_grain_sdiz_projection_batches"
  ("tenantId", "organizationId", "messageId");

CREATE TABLE public."fgis_grain_sdiz_records" (
  "id" text PRIMARY KEY,
  "tenantId" text NOT NULL,
  "organizationId" text NOT NULL,
  "providerSdizId" text NOT NULL,
  "sdizNumber" text NOT NULL,
  "status" text NOT NULL,
  "lotNumber" text,
  "createLotNumber" text,
  "correctedBySdizNumber" text,
  "correctedSdizNumber" text,
  "extinctionId" text,
  "extinctionRefusalId" text,
  "providerMessageId" text NOT NULL,
  "providerReferenceMessageId" text NOT NULL,
  "providerOccurredAt" timestamptz(3) NOT NULL,
  "sourceInboxEntryId" text NOT NULL,
  "sourceBatchId" text NOT NULL,
  "sourceRawBodySha256" char(64) NOT NULL,
  "sourceEvidenceReference" text NOT NULL,
  "recordFingerprint" char(64) NOT NULL,
  "version" bigint NOT NULL DEFAULT 0,
  "createdAt" timestamptz(3) NOT NULL DEFAULT clock_timestamp(),
  "updatedAt" timestamptz(3) NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT "fgis_grain_sdiz_record_org_fk"
    FOREIGN KEY ("organizationId") REFERENCES public."organizations"("id")
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT "fgis_grain_sdiz_record_inbox_fk"
    FOREIGN KEY ("sourceInboxEntryId")
    REFERENCES public."regulatory_integration_inbox_entries"("id")
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT "fgis_grain_sdiz_record_batch_fk"
    FOREIGN KEY ("sourceBatchId")
    REFERENCES public."fgis_grain_sdiz_projection_batches"("id")
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT "fgis_grain_sdiz_record_status_ck"
    CHECK ("status" IN (
      'CREATED', 'SUBSCRIBED', 'CANCELED', 'EXTINGUISHED',
      'SUBSCRIBED_CONFIRMED'
    )),
  CONSTRAINT "fgis_grain_sdiz_record_source_hash_ck"
    CHECK ("sourceRawBodySha256" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "fgis_grain_sdiz_record_fingerprint_ck"
    CHECK ("recordFingerprint" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "fgis_grain_sdiz_record_version_ck"
    CHECK ("version" >= 0),
  CONSTRAINT "fgis_grain_sdiz_record_tenant_org_provider_key"
    UNIQUE ("tenantId", "organizationId", "providerSdizId"),
  CONSTRAINT "fgis_grain_sdiz_record_tenant_org_number_key"
    UNIQUE ("tenantId", "organizationId", "sdizNumber")
);

CREATE INDEX "fgis_grain_sdiz_record_lot_idx"
  ON public."fgis_grain_sdiz_records"
  ("tenantId", "organizationId", "lotNumber")
  WHERE "lotNumber" IS NOT NULL;
CREATE INDEX "fgis_grain_sdiz_record_status_idx"
  ON public."fgis_grain_sdiz_records"
  ("tenantId", "organizationId", "status", "providerOccurredAt" DESC);
CREATE INDEX "fgis_grain_sdiz_record_source_idx"
  ON public."fgis_grain_sdiz_records" ("sourceInboxEntryId");

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

CREATE OR REPLACE FUNCTION public.touch_fgis_grain_sdiz_record()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  NEW."updatedAt" := clock_timestamp();
  RETURN NEW;
END;
$function$;

CREATE TRIGGER "fgis_grain_sdiz_records_touch_updated_at"
BEFORE UPDATE ON public."fgis_grain_sdiz_records"
FOR EACH ROW EXECUTE FUNCTION public.touch_fgis_grain_sdiz_record();

ALTER TABLE public."fgis_grain_sdiz_projection_batches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."fgis_grain_sdiz_projection_batches" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."fgis_grain_sdiz_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."fgis_grain_sdiz_records" FORCE ROW LEVEL SECURITY;

CREATE POLICY "fgis_grain_sdiz_batch_tenant_org_policy"
ON public."fgis_grain_sdiz_projection_batches"
FOR ALL
USING (
  "tenantId" = current_setting('app.current_tenant_id', true)
  AND "organizationId" = current_setting('app.current_org_id', true)
)
WITH CHECK (
  "tenantId" = current_setting('app.current_tenant_id', true)
  AND "organizationId" = current_setting('app.current_org_id', true)
);

CREATE POLICY "fgis_grain_sdiz_record_tenant_org_policy"
ON public."fgis_grain_sdiz_records"
FOR ALL
USING (
  "tenantId" = current_setting('app.current_tenant_id', true)
  AND "organizationId" = current_setting('app.current_org_id', true)
)
WITH CHECK (
  "tenantId" = current_setting('app.current_tenant_id', true)
  AND "organizationId" = current_setting('app.current_org_id', true)
);
