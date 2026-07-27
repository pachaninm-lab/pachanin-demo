-- PC-CROP-08H: durable FGIS Grain exchange/receipt and verified response
-- correlation authority. This migration is additive and intentionally keeps
-- provider connectivity NOT_ATTESTED.

CREATE TABLE public."fgis_grain_exchanges" (
  "id" text PRIMARY KEY,
  "tenantId" text NOT NULL,
  "organizationId" text NOT NULL,
  "outboundOutboxEntryId" text NOT NULL UNIQUE,
  "commandId" text NOT NULL,
  "messageId" text NOT NULL,
  "correlationId" text NOT NULL,
  "transportOperation" text NOT NULL,
  "businessOperationCode" text,
  "dispatchPayloadFingerprint" character(64) NOT NULL,
  "state" text NOT NULL DEFAULT 'DISPATCH_PENDING',
  "providerMessageId" text,
  "transportResponseCode" text,
  "httpStatus" integer,
  "transportResponseBodySha256" character(64),
  "transportAcceptedAt" timestamptz,
  "responseInboxEntryId" text UNIQUE,
  "responseProviderMessageId" text,
  "responseReferenceMessageId" text,
  "responseFingerprint" character(64),
  "responseOccurredAt" timestamptz,
  "reconciliationReason" text,
  "reconciliationDetectedAt" timestamptz,
  "version" bigint NOT NULL DEFAULT 0,
  "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  "updatedAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT "fgis_grain_exchange_org_fk"
    FOREIGN KEY ("organizationId") REFERENCES public."organizations"("id")
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT "fgis_grain_exchange_outbox_fk"
    FOREIGN KEY ("outboundOutboxEntryId") REFERENCES public."outbox_entries"("id")
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT "fgis_grain_exchange_response_inbox_fk"
    FOREIGN KEY ("responseInboxEntryId") REFERENCES public."regulatory_integration_inbox_entries"("id")
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT "fgis_grain_exchange_state_ck"
    CHECK ("state" IN (
      'DISPATCH_PENDING',
      'TRANSPORT_ACCEPTED',
      'RESPONSE_RECEIVED',
      'RECONCILIATION_REQUIRED'
    )),
  CONSTRAINT "fgis_grain_exchange_dispatch_hash_ck"
    CHECK ("dispatchPayloadFingerprint" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "fgis_grain_exchange_transport_hash_ck"
    CHECK (
      "transportResponseBodySha256" IS NULL
      OR "transportResponseBodySha256" ~ '^[a-f0-9]{64}$'
    ),
  CONSTRAINT "fgis_grain_exchange_response_hash_ck"
    CHECK (
      "responseFingerprint" IS NULL
      OR "responseFingerprint" ~ '^[a-f0-9]{64}$'
    ),
  CONSTRAINT "fgis_grain_exchange_http_status_ck"
    CHECK ("httpStatus" IS NULL OR "httpStatus" BETWEEN 100 AND 599),
  CONSTRAINT "fgis_grain_exchange_version_ck"
    CHECK ("version" >= 0),
  CONSTRAINT "fgis_grain_exchange_transport_state_ck"
    CHECK (
      "state" = 'DISPATCH_PENDING'
      OR "state" = 'RECONCILIATION_REQUIRED'
      OR (
        "transportResponseCode" IN ('success', 'accepted')
        AND "transportAcceptedAt" IS NOT NULL
      )
    ),
  CONSTRAINT "fgis_grain_exchange_response_state_ck"
    CHECK (
      "state" <> 'RESPONSE_RECEIVED'
      OR (
        "responseInboxEntryId" IS NOT NULL
        AND "responseProviderMessageId" IS NOT NULL
        AND "responseReferenceMessageId" IS NOT NULL
        AND "responseFingerprint" IS NOT NULL
        AND "responseOccurredAt" IS NOT NULL
      )
    )
);

CREATE UNIQUE INDEX "fgis_grain_exchange_message_key"
  ON public."fgis_grain_exchanges" ("tenantId", "organizationId", "messageId");
CREATE UNIQUE INDEX "fgis_grain_exchange_command_key"
  ON public."fgis_grain_exchanges" ("tenantId", "organizationId", "commandId");
CREATE INDEX "fgis_grain_exchange_state_idx"
  ON public."fgis_grain_exchanges"
  ("tenantId", "organizationId", "state", "updatedAt" DESC, "id");
CREATE INDEX "fgis_grain_exchange_correlation_idx"
  ON public."fgis_grain_exchanges" ("correlationId");
CREATE INDEX "fgis_grain_exchange_provider_message_idx"
  ON public."fgis_grain_exchanges"
  ("tenantId", "organizationId", "providerMessageId");

CREATE OR REPLACE FUNCTION public.reject_fgis_grain_exchange_identity_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF OLD."tenantId" IS DISTINCT FROM NEW."tenantId"
     OR OLD."organizationId" IS DISTINCT FROM NEW."organizationId"
     OR OLD."outboundOutboxEntryId" IS DISTINCT FROM NEW."outboundOutboxEntryId"
     OR OLD."commandId" IS DISTINCT FROM NEW."commandId"
     OR OLD."messageId" IS DISTINCT FROM NEW."messageId"
     OR OLD."correlationId" IS DISTINCT FROM NEW."correlationId"
     OR OLD."transportOperation" IS DISTINCT FROM NEW."transportOperation"
     OR OLD."businessOperationCode" IS DISTINCT FROM NEW."businessOperationCode"
     OR OLD."dispatchPayloadFingerprint" IS DISTINCT FROM NEW."dispatchPayloadFingerprint"
     OR OLD."createdAt" IS DISTINCT FROM NEW."createdAt"
  THEN
    RAISE EXCEPTION 'FGIS Grain exchange identity is immutable'
      USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reject_fgis_grain_exchange_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  RAISE EXCEPTION 'FGIS Grain exchange evidence cannot be deleted'
    USING ERRCODE = '55000';
END;
$function$;

CREATE TRIGGER "fgis_grain_exchange_identity_no_update"
BEFORE UPDATE ON public."fgis_grain_exchanges"
FOR EACH ROW EXECUTE FUNCTION public.reject_fgis_grain_exchange_identity_mutation();

CREATE TRIGGER "fgis_grain_exchange_no_delete"
BEFORE DELETE ON public."fgis_grain_exchanges"
FOR EACH ROW EXECUTE FUNCTION public.reject_fgis_grain_exchange_delete();

ALTER TABLE public."fgis_grain_exchanges" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."fgis_grain_exchanges" FORCE ROW LEVEL SECURITY;

CREATE POLICY "fgis_grain_exchange_select_policy"
ON public."fgis_grain_exchanges"
FOR SELECT
USING (
  current_user IN ('app_runtime', 'app_service')
  AND public.app_rls_context_ready()
  AND current_setting('app.current_role', true)
    IN ('ADMIN', 'COMPLIANCE_OFFICER', 'EXECUTIVE')
  AND "tenantId" = current_setting('app.current_tenant_id', true)
  AND "organizationId" = current_setting('app.current_org_id', true)
);

-- The canonical payload fingerprint is shared with the TypeScript contract.
-- ASCII unit separator prevents field-boundary ambiguity.
CREATE OR REPLACE FUNCTION public.fgis_grain_dispatch_payload_fingerprint(p_payload jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
SET search_path = pg_catalog, public
AS $function$
  SELECT encode(
    digest(
      convert_to(
        concat_ws(
          chr(31),
          COALESCE(p_payload ->> 'schemaVersion', ''),
          COALESCE(p_payload ->> 'adapterCode', ''),
          COALESCE(p_payload ->> 'apiVersion', ''),
          COALESCE(p_payload ->> 'mappingVersion', ''),
          COALESCE(p_payload ->> 'signingPolicyVersion', ''),
          COALESCE(p_payload ->> 'tenantId', ''),
          COALESCE(p_payload ->> 'organizationId', ''),
          COALESCE(p_payload ->> 'commandId', ''),
          COALESCE(p_payload ->> 'transportOperation', ''),
          COALESCE(p_payload ->> 'businessOperationCode', ''),
          COALESCE(p_payload ->> 'messageId', ''),
          COALESCE(p_payload ->> 'referenceMessageId', ''),
          COALESCE(p_payload ->> 'messageDataId', ''),
          COALESCE(p_payload ->> 'unsignedEnvelopeReference', ''),
          COALESCE(p_payload ->> 'unsignedEnvelopeSha256', ''),
          COALESCE(p_payload ->> 'unsignedEnvelopeSizeBytes', ''),
          COALESCE(p_payload ->> 'messageDataSha256', ''),
          COALESCE(p_payload ->> 'providerConfigurationReference', ''),
          COALESCE(p_payload ->> 'correlationId', ''),
          COALESCE(p_payload ->> 'causationId', '')
        ),
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  )
$function$;

CREATE OR REPLACE FUNCTION public.emit_fgis_grain_exchange_event(
  p_event_type text,
  p_object_id text,
  p_exchange_id text,
  p_inbox_entry_id text,
  p_tenant_id text,
  p_organization_id text,
  p_actor_user_id text,
  p_actor_role text,
  p_reason text,
  p_correlation_id text,
  p_idempotency_key text,
  p_before jsonb,
  p_after jsonb,
  p_metadata jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_audit_id text;
  v_outbox_id text;
  v_existing record;
  v_prev_hash text;
  v_hash text;
  v_payload jsonb;
  v_material jsonb;
BEGIN
  IF p_event_type NOT IN (
       'FGIS_GRAIN_TRANSPORT_RECEIPT_ACCEPTED',
       'FGIS_GRAIN_VERIFIED_RESPONSE_CORRELATED',
       'FGIS_GRAIN_RESPONSE_RECONCILIATION_REQUIRED'
     )
     OR char_length(p_object_id) < 3
     OR char_length(p_tenant_id) < 1
     OR char_length(p_organization_id) < 1
     OR char_length(p_actor_user_id) < 3
     OR char_length(p_actor_role) < 2
     OR char_length(p_reason) NOT BETWEEN 12 AND 1000
     OR char_length(p_correlation_id) < 3
     OR char_length(p_idempotency_key) NOT BETWEEN 3 AND 255
  THEN
    RAISE EXCEPTION 'FGIS exchange event authority is invalid'
      USING ERRCODE = '22023';
  END IF;

  v_payload := jsonb_build_object(
    'schemaVersion', 'pc-crop.fgis-grain-exchange-event.v1',
    'eventType', p_event_type,
    'exchangeId', p_exchange_id,
    'inboxEntryId', p_inbox_entry_id,
    'tenantId', p_tenant_id,
    'organizationId', p_organization_id,
    'correlationId', p_correlation_id,
    'metadata', COALESCE(p_metadata, '{}'::jsonb),
    'operationalStatus', 'NOT_ATTESTED'
  );

  SELECT o."id", o."auditId", o."type", o."payload", o."correlationId"
  INTO v_existing
  FROM public."outbox_entries" o
  WHERE o."idempotencyKey" = p_idempotency_key
  FOR UPDATE;
  IF FOUND THEN
    IF v_existing."type" <> p_event_type
       OR v_existing."payload" <> v_payload
       OR v_existing."correlationId" <> p_correlation_id
       OR v_existing."auditId" IS NULL
    THEN
      RAISE EXCEPTION 'FGIS exchange event idempotency mismatch'
        USING ERRCODE = '23505';
    END IF;
    RETURN jsonb_build_object(
      'auditEventId', v_existing."auditId",
      'outboxEntryId', v_existing."id",
      'replayed', true
    );
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('public.audit_events.global-head', 0));
  SELECT a."hash"
  INTO v_prev_hash
  FROM public."audit_events" a
  ORDER BY a."createdAt" DESC, a."id" DESC
  LIMIT 1
  FOR UPDATE;

  v_audit_id := 'fgis-exchange-audit-' || gen_random_uuid()::text;
  v_outbox_id := 'fgis-exchange-outbox-' || gen_random_uuid()::text;
  v_material := jsonb_build_object(
    'id', v_audit_id,
    'action', p_event_type,
    'actorUserId', p_actor_user_id,
    'actorRole', p_actor_role,
    'tenantId', p_tenant_id,
    'orgId', p_organization_id,
    'objectType', 'FGIS_GRAIN_EXCHANGE',
    'objectId', p_object_id,
    'beforeState', COALESCE(p_before, '{}'::jsonb),
    'afterState', COALESCE(p_after, '{}'::jsonb),
    'metadata', v_payload,
    'correlationId', p_correlation_id,
    'runtimeIdempotencyKey', p_idempotency_key,
    'prevHash', v_prev_hash
  );
  v_hash := encode(digest(convert_to(v_material::text, 'UTF8'), 'sha256'), 'hex');

  INSERT INTO public."audit_events" (
    "id", "action", "actorUserId", "actorRole", "tenantId", "orgId",
    "objectType", "objectId", "beforeState", "afterState", "outcome",
    "reason", "metadata", "correlationId", "runtimeIdempotencyKey",
    "hash", "prevHash", "createdAt"
  ) VALUES (
    v_audit_id, p_event_type, p_actor_user_id, p_actor_role,
    p_tenant_id, p_organization_id, 'FGIS_GRAIN_EXCHANGE', p_object_id,
    p_before, p_after, 'SUCCESS', p_reason, v_payload, p_correlation_id,
    p_idempotency_key, v_hash, v_prev_hash, clock_timestamp()
  );

  INSERT INTO public."outbox_entries" (
    "id", "type", "payload", "status", "triggeredByUserId",
    "idempotencyKey", "maxRetries", "retryCount", "nextRetryAt",
    "correlationId", "auditId", "createdAt"
  ) VALUES (
    v_outbox_id, p_event_type, v_payload, 'PENDING', p_actor_user_id,
    p_idempotency_key, 8, 0, clock_timestamp(), p_correlation_id,
    v_audit_id, clock_timestamp()
  );

  RETURN jsonb_build_object(
    'auditEventId', v_audit_id,
    'outboxEntryId', v_outbox_id,
    'replayed', false
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_fgis_grain_exchange(
  p_exchange_id text,
  p_outbox_entry_id text,
  p_dispatch_payload_fingerprint text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_payload jsonb;
  v_type text;
  v_status text;
  v_tenant_id text := current_setting('app.current_tenant_id', true);
  v_org_id text := current_setting('app.current_org_id', true);
  v_role text := current_setting('app.current_role', true);
  v_existing public."fgis_grain_exchanges"%ROWTYPE;
  v_expected_fingerprint text;
BEGIN
  IF NOT public.app_rls_context_ready()
     OR v_role NOT IN ('ADMIN', 'COMPLIANCE_OFFICER')
  THEN
    RAISE EXCEPTION 'FGIS_EXCHANGE_MUTATION_FORBIDDEN'
      USING ERRCODE = '42501';
  END IF;
  IF p_exchange_id IS NULL OR char_length(p_exchange_id) < 3
     OR p_outbox_entry_id IS NULL OR char_length(p_outbox_entry_id) < 3
     OR p_dispatch_payload_fingerprint !~ '^[a-f0-9]{64}$'
  THEN
    RAISE EXCEPTION 'FGIS_EXCHANGE_CREATE_INVALID'
      USING ERRCODE = '22023';
  END IF;

  SELECT o."payload", o."type", o."status"
  INTO v_payload, v_type, v_status
  FROM public."outbox_entries" o
  WHERE o."id" = p_outbox_entry_id
  FOR UPDATE;
  IF NOT FOUND OR v_type <> 'FGIS_GRAIN_OUTBOUND_DISPATCH_REQUESTED' THEN
    RAISE EXCEPTION 'FGIS_EXCHANGE_OUTBOX_NOT_FOUND'
      USING ERRCODE = 'P0002';
  END IF;

  v_expected_fingerprint := public.fgis_grain_dispatch_payload_fingerprint(v_payload);
  IF v_expected_fingerprint <> p_dispatch_payload_fingerprint
     OR v_payload ->> 'tenantId' <> v_tenant_id
     OR v_payload ->> 'organizationId' <> v_org_id
     OR v_payload ->> 'schemaVersion' <> 'pc-crop.fgis-grain-outbound-dispatch.v1'
     OR v_payload ->> 'adapterCode' <> 'FGIS_ZERNO'
     OR v_payload ->> 'apiVersion' <> '1.0.23'
     OR v_payload ->> 'mappingVersion' <> 'fgis-zerno-1.0.23-catalog.v1'
     OR v_payload ->> 'signingPolicyVersion' <> 'fgis-zerno-1.0.23-signing-policy.v1'
     OR COALESCE(v_payload ->> 'commandId', '') = ''
     OR COALESCE(v_payload ->> 'messageId', '') = ''
     OR COALESCE(v_payload ->> 'correlationId', '') = ''
     OR COALESCE(v_payload ->> 'transportOperation', '') = ''
  THEN
    RAISE EXCEPTION 'FGIS_EXCHANGE_OUTBOX_AUTHORITY_MISMATCH'
      USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_existing
  FROM public."fgis_grain_exchanges" e
  WHERE e."outboundOutboxEntryId" = p_outbox_entry_id
  FOR UPDATE;
  IF FOUND THEN
    IF v_existing."tenantId" <> v_tenant_id
       OR v_existing."organizationId" <> v_org_id
       OR v_existing."commandId" <> v_payload ->> 'commandId'
       OR v_existing."messageId" <> v_payload ->> 'messageId'
       OR v_existing."correlationId" <> v_payload ->> 'correlationId'
       OR v_existing."transportOperation" <> v_payload ->> 'transportOperation'
       OR v_existing."businessOperationCode" IS DISTINCT FROM v_payload ->> 'businessOperationCode'
       OR v_existing."dispatchPayloadFingerprint" <> p_dispatch_payload_fingerprint
    THEN
      RAISE EXCEPTION 'FGIS_EXCHANGE_REPLAY_MISMATCH'
        USING ERRCODE = '23505';
    END IF;
    RETURN jsonb_build_object(
      'schemaVersion', 'pc-crop.fgis-grain-exchange-event.v1',
      'kind', 'REPLAY',
      'exchangeId', v_existing."id",
      'state', v_existing."state",
      'dispatchPayloadFingerprint', v_existing."dispatchPayloadFingerprint",
      'operationalStatus', 'NOT_ATTESTED'
    );
  END IF;

  IF v_status <> 'PENDING' THEN
    RAISE EXCEPTION 'FGIS_EXCHANGE_NEW_OUTBOX_NOT_PENDING'
      USING ERRCODE = '55000';
  END IF;

  INSERT INTO public."fgis_grain_exchanges" (
    "id", "tenantId", "organizationId", "outboundOutboxEntryId",
    "commandId", "messageId", "correlationId", "transportOperation",
    "businessOperationCode", "dispatchPayloadFingerprint", "state"
  ) VALUES (
    p_exchange_id, v_tenant_id, v_org_id, p_outbox_entry_id,
    v_payload ->> 'commandId', v_payload ->> 'messageId',
    v_payload ->> 'correlationId', v_payload ->> 'transportOperation',
    v_payload ->> 'businessOperationCode', p_dispatch_payload_fingerprint,
    'DISPATCH_PENDING'
  );

  RETURN jsonb_build_object(
    'schemaVersion', 'pc-crop.fgis-grain-exchange-event.v1',
    'kind', 'CREATED',
    'exchangeId', p_exchange_id,
    'state', 'DISPATCH_PENDING',
    'dispatchPayloadFingerprint', p_dispatch_payload_fingerprint,
    'operationalStatus', 'NOT_ATTESTED'
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.inspect_fgis_grain_exchange_dispatch(
  p_outbox_entry_id text,
  p_lease_token text,
  p_dispatch_payload_fingerprint text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_exchange public."fgis_grain_exchanges"%ROWTYPE;
  v_outbox record;
  v_kind text;
BEGIN
  SELECT o."status", o."leaseToken", o."leaseExpiresAt", o."type", o."payload"
  INTO v_outbox
  FROM public."outbox_entries" o
  WHERE o."id" = p_outbox_entry_id
  FOR UPDATE;
  IF NOT FOUND
     OR v_outbox."type" <> 'FGIS_GRAIN_OUTBOUND_DISPATCH_REQUESTED'
     OR v_outbox."status" <> 'PROCESSING'
     OR v_outbox."leaseToken" IS DISTINCT FROM p_lease_token
     OR v_outbox."leaseExpiresAt" IS NULL
     OR v_outbox."leaseExpiresAt" < clock_timestamp()
  THEN
    RAISE EXCEPTION 'FGIS_EXCHANGE_OUTBOX_LEASE_INVALID'
      USING ERRCODE = '55000';
  END IF;

  SELECT * INTO v_exchange
  FROM public."fgis_grain_exchanges" e
  WHERE e."outboundOutboxEntryId" = p_outbox_entry_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FGIS_EXCHANGE_AUTHORITY_MISSING'
      USING ERRCODE = 'P0002';
  END IF;
  IF v_exchange."dispatchPayloadFingerprint" <> p_dispatch_payload_fingerprint
     OR public.fgis_grain_dispatch_payload_fingerprint(v_outbox."payload")
       <> p_dispatch_payload_fingerprint
  THEN
    RAISE EXCEPTION 'FGIS_EXCHANGE_DISPATCH_FINGERPRINT_MISMATCH'
      USING ERRCODE = '22023';
  END IF;

  v_kind := CASE
    WHEN v_exchange."state" = 'DISPATCH_PENDING' THEN 'SEND'
    WHEN v_exchange."state" IN ('TRANSPORT_ACCEPTED', 'RESPONSE_RECEIVED') THEN 'SKIP_TRANSPORT'
    ELSE 'RECONCILIATION_REQUIRED'
  END;
  RETURN jsonb_build_object(
    'schemaVersion', 'pc-crop.fgis-grain-exchange-event.v1',
    'kind', v_kind,
    'exchangeId', v_exchange."id",
    'state', v_exchange."state",
    'dispatchPayloadFingerprint', v_exchange."dispatchPayloadFingerprint",
    'providerMessageId', v_exchange."providerMessageId",
    'transportAcceptedAt', v_exchange."transportAcceptedAt",
    'operationalStatus', 'NOT_ATTESTED'
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.record_fgis_grain_transport_receipt(
  p_outbox_entry_id text,
  p_lease_token text,
  p_dispatch_payload_fingerprint text,
  p_provider_message_id text,
  p_transport_response_code text,
  p_http_status integer,
  p_response_body_sha256 text,
  p_accepted_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_exchange public."fgis_grain_exchanges"%ROWTYPE;
  v_outbox record;
  v_event jsonb;
  v_idempotency text;
  v_before jsonb;
  v_after jsonb;
BEGIN
  IF p_transport_response_code NOT IN ('success', 'accepted')
     OR p_accepted_at IS NULL
     OR (p_provider_message_id IS NOT NULL AND char_length(p_provider_message_id) NOT BETWEEN 3 AND 255)
     OR (p_http_status IS NOT NULL AND p_http_status NOT BETWEEN 100 AND 599)
     OR (p_response_body_sha256 IS NOT NULL AND p_response_body_sha256 !~ '^[a-f0-9]{64}$')
  THEN
    RAISE EXCEPTION 'FGIS_EXCHANGE_TRANSPORT_RECEIPT_INVALID'
      USING ERRCODE = '22023';
  END IF;

  SELECT o."status", o."leaseToken", o."leaseExpiresAt", o."type", o."payload"
  INTO v_outbox
  FROM public."outbox_entries" o
  WHERE o."id" = p_outbox_entry_id
  FOR UPDATE;
  IF NOT FOUND
     OR v_outbox."type" <> 'FGIS_GRAIN_OUTBOUND_DISPATCH_REQUESTED'
     OR v_outbox."status" <> 'PROCESSING'
     OR v_outbox."leaseToken" IS DISTINCT FROM p_lease_token
     OR v_outbox."leaseExpiresAt" IS NULL
     OR v_outbox."leaseExpiresAt" < clock_timestamp()
  THEN
    RAISE EXCEPTION 'FGIS_EXCHANGE_OUTBOX_LEASE_INVALID'
      USING ERRCODE = '55000';
  END IF;

  SELECT * INTO v_exchange
  FROM public."fgis_grain_exchanges" e
  WHERE e."outboundOutboxEntryId" = p_outbox_entry_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FGIS_EXCHANGE_AUTHORITY_MISSING'
      USING ERRCODE = 'P0002';
  END IF;
  IF v_exchange."dispatchPayloadFingerprint" <> p_dispatch_payload_fingerprint
     OR public.fgis_grain_dispatch_payload_fingerprint(v_outbox."payload")
       <> p_dispatch_payload_fingerprint
  THEN
    RAISE EXCEPTION 'FGIS_EXCHANGE_DISPATCH_FINGERPRINT_MISMATCH'
      USING ERRCODE = '22023';
  END IF;

  IF v_exchange."state" IN ('TRANSPORT_ACCEPTED', 'RESPONSE_RECEIVED') THEN
    IF v_exchange."providerMessageId" IS NOT DISTINCT FROM p_provider_message_id
       AND v_exchange."transportResponseCode" = p_transport_response_code
       AND v_exchange."httpStatus" IS NOT DISTINCT FROM p_http_status
       AND v_exchange."transportResponseBodySha256" IS NOT DISTINCT FROM p_response_body_sha256
    THEN
      RETURN jsonb_build_object(
        'schemaVersion', 'pc-crop.fgis-grain-exchange-event.v1',
        'kind', 'REPLAY',
        'exchangeId', v_exchange."id",
        'state', v_exchange."state",
        'operationalStatus', 'NOT_ATTESTED'
      );
    END IF;

    v_before := to_jsonb(v_exchange);
    UPDATE public."fgis_grain_exchanges"
    SET "state" = 'RECONCILIATION_REQUIRED',
        "reconciliationReason" = 'TRANSPORT_RECEIPT_DIVERGENCE',
        "reconciliationDetectedAt" = clock_timestamp(),
        "version" = "version" + 1,
        "updatedAt" = clock_timestamp()
    WHERE "id" = v_exchange."id";
    SELECT to_jsonb(e) INTO v_after
    FROM public."fgis_grain_exchanges" e WHERE e."id" = v_exchange."id";
    v_idempotency := 'fgis-exchange-reconcile-' || encode(digest(convert_to(
      v_exchange."id" || chr(31) || 'TRANSPORT_RECEIPT_DIVERGENCE' || chr(31)
      || COALESCE(p_response_body_sha256, ''), 'UTF8'), 'sha256'), 'hex');
    v_event := public.emit_fgis_grain_exchange_event(
      'FGIS_GRAIN_RESPONSE_RECONCILIATION_REQUIRED', v_exchange."id",
      v_exchange."id", NULL, v_exchange."tenantId", v_exchange."organizationId",
      'system:outbox-worker', 'SYSTEM',
      'Divergent transport receipt requires governed reconciliation',
      v_exchange."correlationId", v_idempotency, v_before, v_after,
      jsonb_build_object(
        'reasonCode', 'TRANSPORT_RECEIPT_DIVERGENCE',
        'incomingProviderMessageId', p_provider_message_id,
        'incomingResponseBodySha256', p_response_body_sha256
      )
    );
    RETURN jsonb_build_object(
      'schemaVersion', 'pc-crop.fgis-grain-exchange-event.v1',
      'kind', 'RECONCILIATION_REQUIRED',
      'exchangeId', v_exchange."id",
      'state', 'RECONCILIATION_REQUIRED',
      'auditEventId', v_event ->> 'auditEventId',
      'outboxEntryId', v_event ->> 'outboxEntryId',
      'reasonCode', 'TRANSPORT_RECEIPT_DIVERGENCE',
      'operationalStatus', 'NOT_ATTESTED'
    );
  END IF;

  IF v_exchange."state" = 'RECONCILIATION_REQUIRED' THEN
    RETURN jsonb_build_object(
      'schemaVersion', 'pc-crop.fgis-grain-exchange-event.v1',
      'kind', 'RECONCILIATION_REQUIRED',
      'exchangeId', v_exchange."id",
      'state', v_exchange."state",
      'reasonCode', v_exchange."reconciliationReason",
      'operationalStatus', 'NOT_ATTESTED'
    );
  END IF;

  v_before := to_jsonb(v_exchange);
  UPDATE public."fgis_grain_exchanges"
  SET "state" = 'TRANSPORT_ACCEPTED',
      "providerMessageId" = p_provider_message_id,
      "transportResponseCode" = p_transport_response_code,
      "httpStatus" = p_http_status,
      "transportResponseBodySha256" = p_response_body_sha256,
      "transportAcceptedAt" = p_accepted_at,
      "version" = "version" + 1,
      "updatedAt" = clock_timestamp()
  WHERE "id" = v_exchange."id"
    AND "state" = 'DISPATCH_PENDING';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FGIS_EXCHANGE_RECEIPT_STATE_RACE'
      USING ERRCODE = '40001';
  END IF;
  SELECT to_jsonb(e) INTO v_after
  FROM public."fgis_grain_exchanges" e WHERE e."id" = v_exchange."id";
  v_idempotency := 'fgis-exchange-transport-' || encode(digest(convert_to(
    v_exchange."id" || chr(31) || COALESCE(p_provider_message_id, '') || chr(31)
    || p_transport_response_code || chr(31) || COALESCE(p_response_body_sha256, ''),
    'UTF8'), 'sha256'), 'hex');
  v_event := public.emit_fgis_grain_exchange_event(
    'FGIS_GRAIN_TRANSPORT_RECEIPT_ACCEPTED', v_exchange."id", v_exchange."id",
    NULL, v_exchange."tenantId", v_exchange."organizationId",
    'system:outbox-worker', 'SYSTEM',
    'Provider transport acceptance persisted before canonical outbox completion',
    v_exchange."correlationId", v_idempotency, v_before, v_after,
    jsonb_build_object(
      'providerMessageId', p_provider_message_id,
      'transportResponseCode', p_transport_response_code,
      'httpStatus', p_http_status,
      'responseBodySha256', p_response_body_sha256,
      'acceptedAt', p_accepted_at
    )
  );
  RETURN jsonb_build_object(
    'schemaVersion', 'pc-crop.fgis-grain-exchange-event.v1',
    'kind', 'RECORDED',
    'exchangeId', v_exchange."id",
    'state', 'TRANSPORT_ACCEPTED',
    'auditEventId', v_event ->> 'auditEventId',
    'outboxEntryId', v_event ->> 'outboxEntryId',
    'operationalStatus', 'NOT_ATTESTED'
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.reconcile_fgis_grain_exchange_response(
  p_exchange_id text,
  p_inbox_entry_id text,
  p_reason_code text,
  p_correlation_id text,
  p_idempotency_key text,
  p_reason text,
  p_metadata jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_tenant_id text := current_setting('app.current_tenant_id', true);
  v_org_id text := current_setting('app.current_org_id', true);
  v_actor_id text := current_setting('app.current_user_id', true);
  v_actor_role text := current_setting('app.current_role', true);
  v_before jsonb;
  v_after jsonb;
  v_event jsonb;
  v_object_id text := COALESCE(p_exchange_id, p_inbox_entry_id);
BEGIN
  IF p_exchange_id IS NOT NULL THEN
    SELECT to_jsonb(e) INTO v_before
    FROM public."fgis_grain_exchanges" e
    WHERE e."id" = p_exchange_id
      AND e."tenantId" = v_tenant_id
      AND e."organizationId" = v_org_id
    FOR UPDATE;
    IF v_before IS NULL THEN
      RAISE EXCEPTION 'FGIS_EXCHANGE_NOT_ACCESSIBLE'
        USING ERRCODE = 'P0002';
    END IF;
    UPDATE public."fgis_grain_exchanges"
    SET "state" = 'RECONCILIATION_REQUIRED',
        "reconciliationReason" = p_reason_code,
        "reconciliationDetectedAt" = clock_timestamp(),
        "version" = "version" + 1,
        "updatedAt" = clock_timestamp()
    WHERE "id" = p_exchange_id
      AND "state" <> 'RECONCILIATION_REQUIRED';
    SELECT to_jsonb(e) INTO v_after
    FROM public."fgis_grain_exchanges" e WHERE e."id" = p_exchange_id;
  ELSE
    v_before := '{}'::jsonb;
    v_after := jsonb_build_object('state', 'RECONCILIATION_REQUIRED');
  END IF;

  UPDATE public."regulatory_integration_inbox_entries"
  SET "state" = 'QUARANTINED',
      "lastErrorCode" = p_reason_code,
      "lastErrorCategory" = 'PERMANENT',
      "leaseOwner" = NULL,
      "leaseExpiresAt" = NULL,
      "nextAttemptAt" = NULL,
      "version" = "version" + 1,
      "updatedAt" = clock_timestamp()
  WHERE "id" = p_inbox_entry_id
    AND "tenantId" = v_tenant_id
    AND "organizationId" = v_org_id;

  v_event := public.emit_fgis_grain_exchange_event(
    'FGIS_GRAIN_RESPONSE_RECONCILIATION_REQUIRED', v_object_id, p_exchange_id,
    p_inbox_entry_id, v_tenant_id, v_org_id, v_actor_id, v_actor_role,
    p_reason, p_correlation_id, p_idempotency_key, v_before, v_after,
    COALESCE(p_metadata, '{}'::jsonb) || jsonb_build_object('reasonCode', p_reason_code)
  );

  UPDATE public."regulatory_integration_inbox_entries"
  SET "outboxEntryId" = v_event ->> 'outboxEntryId'
  WHERE "id" = p_inbox_entry_id
    AND "tenantId" = v_tenant_id
    AND "organizationId" = v_org_id;

  RETURN jsonb_build_object(
    'schemaVersion', 'pc-crop.fgis-grain-exchange-event.v1',
    'kind', 'RECONCILIATION_REQUIRED',
    'exchangeId', p_exchange_id,
    'inboxEntryId', p_inbox_entry_id,
    'auditEventId', v_event ->> 'auditEventId',
    'outboxEntryId', v_event ->> 'outboxEntryId',
    'correlationId', p_correlation_id,
    'reasonCode', p_reason_code,
    'operationalStatus', 'NOT_ATTESTED'
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.correlate_fgis_grain_exchange_response(
  p_inbox_entry_id text,
  p_worker_id text,
  p_expected_inbox_version bigint,
  p_provider_message_id text,
  p_reference_message_id text,
  p_raw_body_sha256 text,
  p_response_fingerprint text,
  p_provider_occurred_at timestamptz,
  p_correlation_id text,
  p_idempotency_key text,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_tenant_id text := current_setting('app.current_tenant_id', true);
  v_org_id text := current_setting('app.current_org_id', true);
  v_actor_id text := current_setting('app.current_user_id', true);
  v_actor_role text := current_setting('app.current_role', true);
  v_inbox public."regulatory_integration_inbox_entries"%ROWTYPE;
  v_exchange public."fgis_grain_exchanges"%ROWTYPE;
  v_before jsonb;
  v_after jsonb;
  v_event jsonb;
  v_conflict_key text;
BEGIN
  IF NOT public.app_rls_context_ready()
     OR v_actor_role NOT IN ('ADMIN', 'COMPLIANCE_OFFICER')
  THEN
    RAISE EXCEPTION 'FGIS_EXCHANGE_MUTATION_FORBIDDEN'
      USING ERRCODE = '42501';
  END IF;
  IF p_raw_body_sha256 !~ '^[a-f0-9]{64}$'
     OR p_response_fingerprint !~ '^[a-f0-9]{64}$'
     OR char_length(p_reason) NOT BETWEEN 12 AND 1000
     OR char_length(p_idempotency_key) NOT BETWEEN 3 AND 255
  THEN
    RAISE EXCEPTION 'FGIS_EXCHANGE_CORRELATION_INPUT_INVALID'
      USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(
    'fgis-exchange-response:' || v_tenant_id || ':' || v_org_id || ':' || p_reference_message_id,
    0
  ));
  SELECT * INTO v_inbox
  FROM public."regulatory_integration_inbox_entries" i
  WHERE i."id" = p_inbox_entry_id
    AND i."tenantId" = v_tenant_id
    AND i."organizationId" = v_org_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FGIS_EXCHANGE_INBOX_NOT_FOUND'
      USING ERRCODE = 'P0002';
  END IF;
  IF v_inbox."version" <> p_expected_inbox_version
     OR v_inbox."state" <> 'PROCESSING'
     OR v_inbox."leaseOwner" IS DISTINCT FROM p_worker_id
     OR v_inbox."leaseExpiresAt" IS NULL
     OR v_inbox."leaseExpiresAt" < clock_timestamp()
  THEN
    RAISE EXCEPTION 'FGIS_EXCHANGE_INBOX_LEASE_OR_VERSION_INVALID'
      USING ERRCODE = '55000';
  END IF;

  v_conflict_key := p_idempotency_key || ':reconciliation';
  IF v_inbox."provider" <> 'FGIS_ZERNO'
     OR v_inbox."adapterCode" <> 'FGIS_ZERNO'
     OR v_inbox."adapterVersion" <> '1.0.23'
     OR v_inbox."schemaVersion" <> '1.0.23'
     OR v_inbox."mappingVersion" <> 'fgis-zerno-1.0.23-catalog.v1'
     OR v_inbox."signatureStatus" <> 'VERIFIED'
     OR v_inbox."signatureAlgorithm" <> 'GOST3410_2012_256'
     OR v_inbox."signatureAlgorithmUri" <>
       'urn:ietf:params:xml:ns:cpxmlsec:algorithms:gostr34102012-gostr34112012-256'
     OR COALESCE(v_inbox."verificationResult" ->> 'verified', 'false') <> 'true'
     OR v_inbox."verificationResult" ->> 'schemaVersion' <> '1.0.23'
     OR v_inbox."verificationResult" ->> 'mappingVersion' <>
       'fgis-zerno-1.0.23-catalog.v1'
     OR v_inbox."externalEventId" <> p_provider_message_id
     OR v_inbox."causationId" IS DISTINCT FROM p_reference_message_id
     OR v_inbox."rawBodySha256" <> p_raw_body_sha256
     OR v_inbox."occurredAt" <> p_provider_occurred_at
  THEN
    RETURN public.reconcile_fgis_grain_exchange_response(
      NULL, p_inbox_entry_id, 'INBOUND_AUTHORITY_MISMATCH', p_correlation_id,
      v_conflict_key, p_reason,
      jsonb_build_object(
        'providerMessageId', p_provider_message_id,
        'referenceMessageId', p_reference_message_id,
        'rawBodySha256', p_raw_body_sha256,
        'responseFingerprint', p_response_fingerprint
      )
    );
  END IF;

  SELECT * INTO v_exchange
  FROM public."fgis_grain_exchanges" e
  WHERE e."tenantId" = v_tenant_id
    AND e."organizationId" = v_org_id
    AND e."messageId" = p_reference_message_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN public.reconcile_fgis_grain_exchange_response(
      NULL, p_inbox_entry_id, 'UNKNOWN_OUTBOUND_MESSAGE', p_correlation_id,
      v_conflict_key, p_reason,
      jsonb_build_object(
        'providerMessageId', p_provider_message_id,
        'referenceMessageId', p_reference_message_id,
        'rawBodySha256', p_raw_body_sha256,
        'responseFingerprint', p_response_fingerprint
      )
    );
  END IF;

  IF v_exchange."state" = 'RESPONSE_RECEIVED'
     AND v_exchange."responseInboxEntryId" = p_inbox_entry_id
     AND v_exchange."responseProviderMessageId" = p_provider_message_id
     AND v_exchange."responseReferenceMessageId" = p_reference_message_id
     AND v_exchange."responseFingerprint" = p_response_fingerprint
     AND v_exchange."responseOccurredAt" = p_provider_occurred_at
     AND v_inbox."linkedDomainOperationType" = 'FGIS_GRAIN_EXCHANGE'
     AND v_inbox."linkedDomainOperationId" = v_exchange."id"
  THEN
    SELECT o."id", o."auditId" INTO v_event
    FROM public."outbox_entries" o
    WHERE o."id" = v_inbox."outboxEntryId";
    RETURN jsonb_build_object(
      'schemaVersion', 'pc-crop.fgis-grain-exchange-event.v1',
      'kind', 'REPLAY',
      'exchangeId', v_exchange."id",
      'inboxEntryId', p_inbox_entry_id,
      'auditEventId', v_event ->> 'auditId',
      'outboxEntryId', v_event ->> 'id',
      'correlationId', p_correlation_id,
      'reasonCode', NULL,
      'operationalStatus', 'NOT_ATTESTED'
    );
  END IF;

  IF v_exchange."state" <> 'TRANSPORT_ACCEPTED'
     OR v_exchange."responseInboxEntryId" IS NOT NULL
     OR v_inbox."linkedDomainOperationId" IS NOT NULL
  THEN
    RETURN public.reconcile_fgis_grain_exchange_response(
      v_exchange."id", p_inbox_entry_id, 'RESPONSE_CORRELATION_CONFLICT',
      p_correlation_id, v_conflict_key, p_reason,
      jsonb_build_object(
        'providerMessageId', p_provider_message_id,
        'referenceMessageId', p_reference_message_id,
        'rawBodySha256', p_raw_body_sha256,
        'responseFingerprint', p_response_fingerprint,
        'existingState', v_exchange."state"
      )
    );
  END IF;

  v_before := to_jsonb(v_exchange);
  UPDATE public."fgis_grain_exchanges"
  SET "state" = 'RESPONSE_RECEIVED',
      "responseInboxEntryId" = p_inbox_entry_id,
      "responseProviderMessageId" = p_provider_message_id,
      "responseReferenceMessageId" = p_reference_message_id,
      "responseFingerprint" = p_response_fingerprint,
      "responseOccurredAt" = p_provider_occurred_at,
      "version" = "version" + 1,
      "updatedAt" = clock_timestamp()
  WHERE "id" = v_exchange."id"
    AND "state" = 'TRANSPORT_ACCEPTED'
    AND "responseInboxEntryId" IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FGIS_EXCHANGE_RESPONSE_CORRELATION_RACE'
      USING ERRCODE = '40001';
  END IF;
  SELECT to_jsonb(e) INTO v_after
  FROM public."fgis_grain_exchanges" e WHERE e."id" = v_exchange."id";

  v_event := public.emit_fgis_grain_exchange_event(
    'FGIS_GRAIN_VERIFIED_RESPONSE_CORRELATED', v_exchange."id", v_exchange."id",
    p_inbox_entry_id, v_tenant_id, v_org_id, v_actor_id, v_actor_role,
    p_reason, p_correlation_id, p_idempotency_key, v_before, v_after,
    jsonb_build_object(
      'providerMessageId', p_provider_message_id,
      'referenceMessageId', p_reference_message_id,
      'rawBodySha256', p_raw_body_sha256,
      'responseFingerprint', p_response_fingerprint,
      'providerOccurredAt', p_provider_occurred_at,
      'evidenceReference', v_inbox."evidenceReference"
    )
  );

  UPDATE public."regulatory_integration_inbox_entries"
  SET "state" = 'PROCESSED',
      "linkedDomainOperationType" = 'FGIS_GRAIN_EXCHANGE',
      "linkedDomainOperationId" = v_exchange."id",
      "outboxEntryId" = v_event ->> 'outboxEntryId',
      "leaseOwner" = NULL,
      "leaseExpiresAt" = NULL,
      "nextAttemptAt" = NULL,
      "lastErrorCode" = NULL,
      "lastErrorCategory" = NULL,
      "lastErrorDetailReference" = NULL,
      "version" = "version" + 1,
      "updatedAt" = clock_timestamp()
  WHERE "id" = p_inbox_entry_id
    AND "tenantId" = v_tenant_id
    AND "organizationId" = v_org_id
    AND "state" = 'PROCESSING'
    AND "leaseOwner" = p_worker_id
    AND "leaseExpiresAt" >= clock_timestamp()
    AND "version" = p_expected_inbox_version;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FGIS_EXCHANGE_INBOX_LEASE_LOST_AT_COMMIT'
      USING ERRCODE = '40001';
  END IF;

  RETURN jsonb_build_object(
    'schemaVersion', 'pc-crop.fgis-grain-exchange-event.v1',
    'kind', 'CORRELATED',
    'exchangeId', v_exchange."id",
    'inboxEntryId', p_inbox_entry_id,
    'auditEventId', v_event ->> 'auditEventId',
    'outboxEntryId', v_event ->> 'outboxEntryId',
    'correlationId', p_correlation_id,
    'reasonCode', NULL,
    'operationalStatus', 'NOT_ATTESTED'
  );
END;
$function$;

REVOKE ALL ON TABLE public."fgis_grain_exchanges" FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fgis_grain_dispatch_payload_fingerprint(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.emit_fgis_grain_exchange_event(
  text,text,text,text,text,text,text,text,text,text,text,jsonb,jsonb,jsonb
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_fgis_grain_exchange(text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.inspect_fgis_grain_exchange_dispatch(text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_fgis_grain_transport_receipt(
  text,text,text,text,text,integer,text,timestamptz
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reconcile_fgis_grain_exchange_response(
  text,text,text,text,text,text,jsonb
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.correlate_fgis_grain_exchange_response(
  text,text,bigint,text,text,text,text,timestamptz,text,text,text
) FROM PUBLIC;

DO $fgis_exchange_grants$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_runtime') THEN
    GRANT SELECT ON TABLE public."fgis_grain_exchanges" TO app_runtime;
    GRANT EXECUTE ON FUNCTION public.create_fgis_grain_exchange(text,text,text) TO app_runtime;
    GRANT EXECUTE ON FUNCTION public.correlate_fgis_grain_exchange_response(
      text,text,bigint,text,text,text,text,timestamptz,text,text,text
    ) TO app_runtime;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_service') THEN
    GRANT SELECT ON TABLE public."fgis_grain_exchanges" TO app_service;
    GRANT EXECUTE ON FUNCTION public.create_fgis_grain_exchange(text,text,text) TO app_service;
    GRANT EXECUTE ON FUNCTION public.inspect_fgis_grain_exchange_dispatch(text,text,text) TO app_service;
    GRANT EXECUTE ON FUNCTION public.record_fgis_grain_transport_receipt(
      text,text,text,text,text,integer,text,timestamptz
    ) TO app_service;
    GRANT EXECUTE ON FUNCTION public.correlate_fgis_grain_exchange_response(
      text,text,bigint,text,text,text,text,timestamptz,text,text,text
    ) TO app_service;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_outbox') THEN
    GRANT EXECUTE ON FUNCTION public.inspect_fgis_grain_exchange_dispatch(text,text,text) TO app_outbox;
    GRANT EXECUTE ON FUNCTION public.record_fgis_grain_transport_receipt(
      text,text,text,text,text,integer,text,timestamptz
    ) TO app_outbox;
  END IF;
END
$fgis_exchange_grants$;

REVOKE INSERT, UPDATE, DELETE ON TABLE public."fgis_grain_exchanges"
FROM app_runtime, app_service, app_outbox;
