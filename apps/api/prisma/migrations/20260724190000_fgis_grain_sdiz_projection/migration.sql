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

CREATE POLICY "fgis_grain_sdiz_projection_tenant_org_policy"
ON public."fgis_grain_sdiz_projections"
FOR ALL
USING (
  "tenantId" = current_setting('app.current_tenant_id', true)
  AND "organizationId" = current_setting('app.current_org_id', true)
)
WITH CHECK (
  "tenantId" = current_setting('app.current_tenant_id', true)
  AND "organizationId" = current_setting('app.current_org_id', true)
);
