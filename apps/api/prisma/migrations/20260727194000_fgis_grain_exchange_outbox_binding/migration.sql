-- Bind every canonical FGIS dispatch outbox row to exactly one durable exchange
-- inside the same PostgreSQL transaction. This closes the API/crash gap without
-- introducing a second queue or relay.
CREATE OR REPLACE FUNCTION public.bind_fgis_grain_exchange_from_outbox()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_fingerprint text;
BEGIN
  IF NEW."type" <> 'FGIS_GRAIN_OUTBOUND_DISPATCH_REQUESTED' THEN
    RETURN NEW;
  END IF;
  IF NEW."payload" ->> 'schemaVersion' <> 'pc-crop.fgis-grain-outbound-dispatch.v1'
     OR NEW."payload" ->> 'adapterCode' <> 'FGIS_ZERNO'
     OR NEW."payload" ->> 'apiVersion' <> '1.0.23'
     OR NEW."payload" ->> 'mappingVersion' <> 'fgis-zerno-1.0.23-catalog.v1'
     OR NEW."payload" ->> 'signingPolicyVersion' <> 'fgis-zerno-1.0.23-signing-policy.v1'
     OR COALESCE(NEW."payload" ->> 'tenantId', '') = ''
     OR COALESCE(NEW."payload" ->> 'organizationId', '') = ''
     OR COALESCE(NEW."payload" ->> 'commandId', '') = ''
     OR COALESCE(NEW."payload" ->> 'messageId', '') = ''
     OR COALESCE(NEW."payload" ->> 'correlationId', '') = ''
     OR COALESCE(NEW."payload" ->> 'transportOperation', '') = ''
  THEN
    RAISE EXCEPTION 'FGIS_EXCHANGE_OUTBOX_AUTHORITY_MISMATCH'
      USING ERRCODE = '22023';
  END IF;
  v_fingerprint := public.fgis_grain_dispatch_payload_fingerprint(NEW."payload");
  INSERT INTO public."fgis_grain_exchanges" (
    "id", "tenantId", "organizationId", "outboundOutboxEntryId",
    "commandId", "messageId", "correlationId", "transportOperation",
    "businessOperationCode", "dispatchPayloadFingerprint", "state"
  ) VALUES (
    'fgis-exchange-' || gen_random_uuid()::text,
    NEW."payload" ->> 'tenantId',
    NEW."payload" ->> 'organizationId',
    NEW."id",
    NEW."payload" ->> 'commandId',
    NEW."payload" ->> 'messageId',
    NEW."payload" ->> 'correlationId',
    NEW."payload" ->> 'transportOperation',
    NEW."payload" ->> 'businessOperationCode',
    v_fingerprint,
    'DISPATCH_PENDING'
  );
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS "outbox_bind_fgis_grain_exchange" ON public."outbox_entries";
CREATE TRIGGER "outbox_bind_fgis_grain_exchange"
AFTER INSERT ON public."outbox_entries"
FOR EACH ROW
WHEN (NEW."type" = 'FGIS_GRAIN_OUTBOUND_DISPATCH_REQUESTED')
EXECUTE FUNCTION public.bind_fgis_grain_exchange_from_outbox();

-- Forward-only backfill for dispatch rows produced before PC-CROP-08H. Exact
-- identity constraints deliberately fail if two historical rows claim one
-- message/command authority.
INSERT INTO public."fgis_grain_exchanges" (
  "id", "tenantId", "organizationId", "outboundOutboxEntryId",
  "commandId", "messageId", "correlationId", "transportOperation",
  "businessOperationCode", "dispatchPayloadFingerprint", "state",
  "createdAt", "updatedAt"
)
SELECT
  'fgis-exchange-' || gen_random_uuid()::text,
  o."payload" ->> 'tenantId',
  o."payload" ->> 'organizationId',
  o."id",
  o."payload" ->> 'commandId',
  o."payload" ->> 'messageId',
  o."payload" ->> 'correlationId',
  o."payload" ->> 'transportOperation',
  o."payload" ->> 'businessOperationCode',
  public.fgis_grain_dispatch_payload_fingerprint(o."payload"),
  CASE
    WHEN o."status" = 'SENT' THEN 'RECONCILIATION_REQUIRED'
    ELSE 'DISPATCH_PENDING'
  END,
  o."createdAt",
  clock_timestamp()
FROM public."outbox_entries" o
WHERE o."type" = 'FGIS_GRAIN_OUTBOUND_DISPATCH_REQUESTED'
  AND o."payload" ->> 'schemaVersion' = 'pc-crop.fgis-grain-outbound-dispatch.v1'
  AND o."payload" ->> 'adapterCode' = 'FGIS_ZERNO'
  AND o."payload" ->> 'apiVersion' = '1.0.23'
  AND NOT EXISTS (
    SELECT 1 FROM public."fgis_grain_exchanges" e
    WHERE e."outboundOutboxEntryId" = o."id"
  );

REVOKE ALL ON FUNCTION public.bind_fgis_grain_exchange_from_outbox() FROM PUBLIC;
