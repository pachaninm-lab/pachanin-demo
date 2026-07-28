-- PC-CROP-08I: durable outbound ACK decision, dispatch and receipt authority.
-- Additive only. Provider connectivity and production activation remain NOT_ATTESTED.

CREATE TABLE public."fgis_grain_acknowledgements" (
  "id" text PRIMARY KEY,
  "tenantId" text NOT NULL,
  "organizationId" text NOT NULL,
  "inboxEntryId" text NOT NULL UNIQUE,
  "inboundTransportOperation" text NOT NULL,
  "inboundMessageId" text NOT NULL,
  "inboundReferenceMessageId" text,
  "inboundResponseCode" text NOT NULL,
  "verifiedPayloadFingerprint" character(64) NOT NULL,
  "ackPolicyVersion" text NOT NULL,
  "ackPolicyHash" character(64) NOT NULL,
  "decision" text NOT NULL,
  "reasonCode" text NOT NULL,
  "commandId" text,
  "messageId" text,
  "referenceMessageId" text,
  "ackEnvelopeReference" text,
  "ackEnvelopeSha256" character(64),
  "ackEnvelopeSizeBytes" integer,
  "ackMessageDataId" text,
  "providerConfigurationReference" text,
  "outboundOutboxEntryId" text UNIQUE,
  "exchangeId" text UNIQUE,
  "auditEventId" text,
  "eventOutboxEntryId" text,
  "state" text NOT NULL,
  "reconciliationReason" text,
  "reconciliationDetectedAt" timestamptz,
  "version" bigint NOT NULL DEFAULT 0,
  "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  "updatedAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT "fgis_grain_ack_org_fk"
    FOREIGN KEY ("organizationId") REFERENCES public."organizations"("id")
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT "fgis_grain_ack_inbox_fk"
    FOREIGN KEY ("inboxEntryId") REFERENCES public."regulatory_integration_inbox_entries"("id")
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT "fgis_grain_ack_dispatch_outbox_fk"
    FOREIGN KEY ("outboundOutboxEntryId") REFERENCES public."outbox_entries"("id")
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT "fgis_grain_ack_exchange_fk"
    FOREIGN KEY ("exchangeId") REFERENCES public."fgis_grain_exchanges"("id")
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT "fgis_grain_ack_audit_fk"
    FOREIGN KEY ("auditEventId") REFERENCES public."audit_events"("id")
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT "fgis_grain_ack_event_outbox_fk"
    FOREIGN KEY ("eventOutboxEntryId") REFERENCES public."outbox_entries"("id")
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT "fgis_grain_ack_state_ck"
    CHECK ("state" IN (
      'NOT_REQUIRED',
      'ACK_PENDING',
      'ACK_DISPATCH_REQUESTED',
      'ACK_TRANSPORT_ACCEPTED',
      'RECONCILIATION_REQUIRED'
    )),
  CONSTRAINT "fgis_grain_ack_decision_ck"
    CHECK ("decision" IN ('REQUIRED', 'NOT_REQUIRED')),
  CONSTRAINT "fgis_grain_ack_reason_ck"
    CHECK ("reasonCode" IN (
      'ACK_REQUIRED_VERIFIED_MESSAGE',
      'ACK_NOT_REQUIRED_ACK_OF_ACK',
      'ACK_NOT_REQUIRED_QUEUE_EMPTY',
      'ACK_NOT_REQUIRED_IGNORED',
      'ACK_NOT_REQUIRED_POLICY',
      'ACK_RECONCILIATION_FINGERPRINT_MISMATCH',
      'ACK_RECONCILIATION_POLICY_MISMATCH',
      'ACK_RECONCILIATION_IDENTITY_MISMATCH'
    )),
  CONSTRAINT "fgis_grain_ack_transport_ck"
    CHECK ("inboundTransportOperation" IN ('SendRequest', 'SendResponse', 'Ack')),
  CONSTRAINT "fgis_grain_ack_response_code_ck"
    CHECK ("inboundResponseCode" IN ('success', 'accepted', 'queue-is-empty', 'ignored')),
  CONSTRAINT "fgis_grain_ack_fingerprint_ck"
    CHECK ("verifiedPayloadFingerprint" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "fgis_grain_ack_policy_hash_ck"
    CHECK ("ackPolicyHash" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "fgis_grain_ack_envelope_hash_ck"
    CHECK ("ackEnvelopeSha256" IS NULL OR "ackEnvelopeSha256" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "fgis_grain_ack_version_ck" CHECK ("version" >= 0),
  CONSTRAINT "fgis_grain_ack_required_authority_ck"
    CHECK (
      "decision" <> 'REQUIRED'
      OR (
        "commandId" IS NOT NULL
        AND "messageId" IS NOT NULL
        AND "referenceMessageId" IS NOT NULL
        AND "ackEnvelopeReference" IS NOT NULL
        AND "ackEnvelopeSha256" IS NOT NULL
        AND "ackEnvelopeSizeBytes" > 0
        AND "ackMessageDataId" IS NOT NULL
        AND "providerConfigurationReference" IS NOT NULL
        AND "outboundOutboxEntryId" IS NOT NULL
        AND "exchangeId" IS NOT NULL
      )
    ),
  CONSTRAINT "fgis_grain_ack_not_required_authority_ck"
    CHECK (
      "decision" <> 'NOT_REQUIRED'
      OR (
        "state" IN ('NOT_REQUIRED', 'RECONCILIATION_REQUIRED')
        AND "commandId" IS NULL
        AND "messageId" IS NULL
        AND "referenceMessageId" IS NULL
        AND "ackEnvelopeReference" IS NULL
        AND "ackEnvelopeSha256" IS NULL
        AND "ackEnvelopeSizeBytes" IS NULL
        AND "ackMessageDataId" IS NULL
        AND "providerConfigurationReference" IS NULL
        AND "outboundOutboxEntryId" IS NULL
        AND "exchangeId" IS NULL
      )
    )
);

CREATE UNIQUE INDEX "fgis_grain_ack_tenant_org_inbox_key"
  ON public."fgis_grain_acknowledgements" ("tenantId", "organizationId", "inboxEntryId");
CREATE UNIQUE INDEX "fgis_grain_ack_command_key"
  ON public."fgis_grain_acknowledgements" ("tenantId", "organizationId", "commandId")
  WHERE "commandId" IS NOT NULL;
CREATE UNIQUE INDEX "fgis_grain_ack_message_key"
  ON public."fgis_grain_acknowledgements" ("tenantId", "organizationId", "messageId")
  WHERE "messageId" IS NOT NULL;
CREATE INDEX "fgis_grain_ack_state_idx"
  ON public."fgis_grain_acknowledgements"
  ("tenantId", "organizationId", "state", "updatedAt" DESC, "id");
CREATE INDEX "fgis_grain_ack_inbound_message_idx"
  ON public."fgis_grain_acknowledgements"
  ("tenantId", "organizationId", "inboundMessageId");
CREATE INDEX "fgis_grain_ack_correlation_idx"
  ON public."fgis_grain_acknowledgements" ("inboxEntryId", "exchangeId");

CREATE OR REPLACE FUNCTION public.reject_fgis_grain_ack_identity_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF OLD."tenantId" IS DISTINCT FROM NEW."tenantId"
     OR OLD."organizationId" IS DISTINCT FROM NEW."organizationId"
     OR OLD."inboxEntryId" IS DISTINCT FROM NEW."inboxEntryId"
     OR OLD."inboundTransportOperation" IS DISTINCT FROM NEW."inboundTransportOperation"
     OR OLD."inboundMessageId" IS DISTINCT FROM NEW."inboundMessageId"
     OR OLD."inboundReferenceMessageId" IS DISTINCT FROM NEW."inboundReferenceMessageId"
     OR OLD."inboundResponseCode" IS DISTINCT FROM NEW."inboundResponseCode"
     OR OLD."verifiedPayloadFingerprint" IS DISTINCT FROM NEW."verifiedPayloadFingerprint"
     OR OLD."ackPolicyVersion" IS DISTINCT FROM NEW."ackPolicyVersion"
     OR OLD."ackPolicyHash" IS DISTINCT FROM NEW."ackPolicyHash"
     OR OLD."decision" IS DISTINCT FROM NEW."decision"
     OR OLD."commandId" IS DISTINCT FROM NEW."commandId"
     OR OLD."messageId" IS DISTINCT FROM NEW."messageId"
     OR OLD."referenceMessageId" IS DISTINCT FROM NEW."referenceMessageId"
     OR OLD."ackEnvelopeReference" IS DISTINCT FROM NEW."ackEnvelopeReference"
     OR OLD."ackEnvelopeSha256" IS DISTINCT FROM NEW."ackEnvelopeSha256"
     OR OLD."ackEnvelopeSizeBytes" IS DISTINCT FROM NEW."ackEnvelopeSizeBytes"
     OR OLD."ackMessageDataId" IS DISTINCT FROM NEW."ackMessageDataId"
     OR OLD."providerConfigurationReference" IS DISTINCT FROM NEW."providerConfigurationReference"
     OR OLD."outboundOutboxEntryId" IS DISTINCT FROM NEW."outboundOutboxEntryId"
     OR OLD."exchangeId" IS DISTINCT FROM NEW."exchangeId"
     OR OLD."createdAt" IS DISTINCT FROM NEW."createdAt"
  THEN
    RAISE EXCEPTION 'FGIS Grain ACK identity/evidence is immutable'
      USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reject_fgis_grain_ack_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  RAISE EXCEPTION 'FGIS Grain ACK authority cannot be deleted'
    USING ERRCODE = '55000';
END;
$function$;

CREATE TRIGGER "fgis_grain_ack_identity_no_update"
BEFORE UPDATE ON public."fgis_grain_acknowledgements"
FOR EACH ROW EXECUTE FUNCTION public.reject_fgis_grain_ack_identity_mutation();

CREATE TRIGGER "fgis_grain_ack_no_delete"
BEFORE DELETE ON public."fgis_grain_acknowledgements"
FOR EACH ROW EXECUTE FUNCTION public.reject_fgis_grain_ack_delete();

ALTER TABLE public."fgis_grain_acknowledgements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."fgis_grain_acknowledgements" FORCE ROW LEVEL SECURITY;

CREATE POLICY "fgis_grain_ack_select_policy"
ON public."fgis_grain_acknowledgements"
FOR SELECT
USING (
  current_user IN ('app_runtime', 'app_service')
  AND public.app_rls_context_ready()
  AND current_setting('app.current_role', true)
    IN ('ADMIN', 'COMPLIANCE_OFFICER', 'OPERATOR', 'EXECUTIVE')
  AND "tenantId" = current_setting('app.current_tenant_id', true)
  AND "organizationId" = current_setting('app.current_org_id', true)
);

CREATE OR REPLACE FUNCTION public.fgis_grain_ack_uuid_v1(p_seed text)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
SET search_path = pg_catalog, public
AS $function$
  WITH digest_hex AS (
    SELECT encode(digest(convert_to(p_seed, 'UTF8'), 'sha256'), 'hex') AS h
  )
  SELECT
    substr(h, 1, 8) || '-' ||
    substr(h, 9, 4) || '-' ||
    '1' || substr(h, 14, 3) || '-' ||
    '8' || substr(h, 18, 3) || '-' ||
    substr(h, 21, 12)
  FROM digest_hex
$function$;

CREATE OR REPLACE FUNCTION public.emit_fgis_grain_ack_event(
  p_event_type text,
  p_acknowledgement_id text,
  p_inbox_entry_id text,
  p_exchange_id text,
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
       'FGIS_GRAIN_ACK_NOT_REQUIRED',
       'FGIS_GRAIN_ACK_REQUESTED',
       'FGIS_GRAIN_ACK_TRANSPORT_ACCEPTED',
       'FGIS_GRAIN_ACK_RECONCILIATION_REQUIRED'
     )
     OR char_length(p_acknowledgement_id) < 3
     OR char_length(p_inbox_entry_id) < 3
     OR char_length(p_tenant_id) < 1
     OR char_length(p_organization_id) < 1
     OR char_length(p_actor_user_id) < 3
     OR char_length(p_actor_role) < 2
     OR char_length(p_reason) NOT BETWEEN 12 AND 1000
     OR char_length(p_correlation_id) < 3
     OR char_length(p_idempotency_key) NOT BETWEEN 3 AND 255
  THEN
    RAISE EXCEPTION 'FGIS_ACK_EVENT_AUTHORITY_INVALID'
      USING ERRCODE = '22023';
  END IF;

  v_payload := jsonb_build_object(
    'schemaVersion', 'pc-crop.fgis-grain-ack-event.v1',
    'eventType', p_event_type,
    'acknowledgementId', p_acknowledgement_id,
    'inboxEntryId', p_inbox_entry_id,
    'exchangeId', p_exchange_id,
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
      RAISE EXCEPTION 'FGIS_ACK_EVENT_IDEMPOTENCY_MISMATCH'
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

  v_audit_id := 'fgis-ack-audit-' || gen_random_uuid()::text;
  v_outbox_id := 'fgis-ack-event-' || gen_random_uuid()::text;
  v_material := jsonb_build_object(
    'id', v_audit_id,
    'action', p_event_type,
    'actorUserId', p_actor_user_id,
    'actorRole', p_actor_role,
    'tenantId', p_tenant_id,
    'orgId', p_organization_id,
    'objectType', 'FGIS_GRAIN_ACKNOWLEDGEMENT',
    'objectId', p_acknowledgement_id,
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
    p_tenant_id, p_organization_id, 'FGIS_GRAIN_ACKNOWLEDGEMENT',
    p_acknowledgement_id, p_before, p_after, 'SUCCESS', p_reason,
    v_payload, p_correlation_id, p_idempotency_key, v_hash, v_prev_hash,
    clock_timestamp()
  );

  INSERT INTO public."outbox_entries" (
    "id", "type", "dealId", "payload", "status", "triggeredByUserId",
    "idempotencyKey", "maxRetries", "retryCount", "nextRetryAt",
    "correlationId", "auditId", "createdAt"
  ) VALUES (
    v_outbox_id, p_event_type, NULL, v_payload, 'PENDING', p_actor_user_id,
    p_idempotency_key, 5, 0, clock_timestamp(), p_correlation_id,
    v_audit_id, clock_timestamp()
  );

  RETURN jsonb_build_object(
    'auditEventId', v_audit_id,
    'outboxEntryId', v_outbox_id,
    'replayed', false
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_fgis_grain_acknowledgement(
  p_inbox_entry_id text,
  p_expected_inbox_version bigint,
  p_inbound_transport_operation text,
  p_inbound_message_id text,
  p_inbound_reference_message_id text,
  p_inbound_response_code text,
  p_verified_payload_fingerprint text,
  p_ack_envelope_reference text,
  p_ack_envelope_sha256 text,
  p_ack_envelope_size_bytes integer,
  p_ack_message_data_id text,
  p_provider_configuration_reference text,
  p_correlation_id text,
  p_causation_id text,
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
  v_inbox record;
  v_existing public."fgis_grain_acknowledgements"%ROWTYPE;
  v_required boolean;
  v_reason_code text;
  v_ack_id text;
  v_command_id text;
  v_message_id text;
  v_dispatch_outbox_id text;
  v_exchange_id text;
  v_event jsonb;
  v_payload jsonb;
  v_policy_hash constant text := '113c1937f42f7746fc0bbedd58378586ca6e7678393dd1db471768c4f2e3f05c';
  v_policy_version constant text := 'fgis-zerno-1.0.23-ack-policy.v1';
  v_before jsonb;
  v_after jsonb;
  v_config_id text;
  v_config record;
  v_gate_count integer;
BEGIN
  IF current_user NOT IN ('app_runtime', 'app_service')
     OR NOT public.app_rls_context_ready()
     OR v_actor_role NOT IN ('ADMIN', 'COMPLIANCE_OFFICER')
  THEN
    RAISE EXCEPTION 'ACK_MUTATION_FORBIDDEN'
      USING ERRCODE = '42501';
  END IF;
  IF char_length(p_inbox_entry_id) < 3
     OR p_expected_inbox_version < 0
     OR p_inbound_transport_operation NOT IN ('SendRequest', 'SendResponse', 'Ack')
     OR p_inbound_response_code NOT IN ('success', 'accepted', 'queue-is-empty', 'ignored')
     OR p_inbound_message_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-1[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     OR (p_inbound_reference_message_id IS NOT NULL
       AND p_inbound_reference_message_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-1[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
     OR p_verified_payload_fingerprint !~ '^[a-f0-9]{64}$'
     OR char_length(p_correlation_id) < 3
     OR char_length(p_idempotency_key) NOT BETWEEN 3 AND 160
     OR char_length(p_reason) NOT BETWEEN 12 AND 1000
  THEN
    RAISE EXCEPTION 'ACK_COMMAND_INVALID'
      USING ERRCODE = '22023';
  END IF;

  SELECT i.*
  INTO v_inbox
  FROM public."regulatory_integration_inbox_entries" i
  WHERE i."id" = p_inbox_entry_id
    AND i."tenantId" = v_tenant_id
    AND i."organizationId" = v_org_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ACK_INBOX_AUTHORITY_MISSING'
      USING ERRCODE = 'P0002';
  END IF;
  IF v_inbox."version" <> p_expected_inbox_version
     OR v_inbox."state" NOT IN ('VERIFIED', 'PROCESSING', 'PROCESSED')
     OR v_inbox."signatureStatus" <> 'VERIFIED'
     OR v_inbox."adapterCode" <> 'FGIS_ZERNO'
     OR v_inbox."adapterVersion" <> '1.0.23'
     OR v_inbox."schemaVersion" <> '1.0.23'
     OR v_inbox."mappingVersion" <> 'fgis-zerno-1.0.23-catalog.v1'
     OR COALESCE((v_inbox."verificationResult" ->> 'verified')::boolean, false) IS NOT TRUE
     OR v_inbox."verificationResult" ->> 'schemaVersion' <> '1.0.23'
     OR v_inbox."verificationResult" ->> 'mappingVersion' <> 'fgis-zerno-1.0.23-catalog.v1'
     OR v_inbox."verificationResult" ->> 'transportOperation' <> p_inbound_transport_operation
     OR v_inbox."verificationResult" ->> 'messageId' <> p_inbound_message_id
     OR NULLIF(v_inbox."verificationResult" ->> 'referenceMessageId', '')
       IS DISTINCT FROM p_inbound_reference_message_id
     OR v_inbox."verificationResult" ->> 'responseCode' <> p_inbound_response_code
     OR v_inbox."verificationResult" ->> 'payloadFingerprint' <> p_verified_payload_fingerprint
     OR v_inbox."rawBodySha256" <> p_verified_payload_fingerprint
  THEN
    RAISE EXCEPTION 'ACK_INBOX_AUTHORITY_INVALID'
      USING ERRCODE = '22023';
  END IF;

  v_required := p_inbound_transport_operation IN ('SendRequest', 'SendResponse')
    AND p_inbound_response_code IN ('success', 'accepted');
  v_reason_code := CASE
    WHEN p_inbound_transport_operation = 'Ack' THEN 'ACK_NOT_REQUIRED_ACK_OF_ACK'
    WHEN p_inbound_response_code = 'queue-is-empty' THEN 'ACK_NOT_REQUIRED_QUEUE_EMPTY'
    WHEN p_inbound_response_code = 'ignored' THEN 'ACK_NOT_REQUIRED_IGNORED'
    WHEN v_required THEN 'ACK_REQUIRED_VERIFIED_MESSAGE'
    ELSE 'ACK_NOT_REQUIRED_POLICY'
  END;

  IF v_required THEN
    IF p_ack_envelope_reference !~ '^object-store://[A-Za-z0-9][A-Za-z0-9:_.@/-]{2,500}$'
       OR p_ack_envelope_sha256 !~ '^[a-f0-9]{64}$'
       OR p_ack_envelope_size_bytes IS NULL OR p_ack_envelope_size_bytes <= 0
       OR p_ack_message_data_id !~ '^[A-Za-z_][A-Za-z0-9._-]{0,127}$'
       OR p_provider_configuration_reference !~ '^config://[A-Za-z0-9][A-Za-z0-9:_.@/-]{2,500}$'
    THEN
      RAISE EXCEPTION 'ACK_ENVELOPE_REQUIRED'
        USING ERRCODE = '22023';
    END IF;
    v_config_id := regexp_replace(p_provider_configuration_reference, '^config://', '');
    SELECT c.* INTO v_config
    FROM public."fgis_grain_provider_configurations" c
    WHERE c."id" = v_config_id
      AND c."tenantId" = v_tenant_id
      AND c."organizationId" = v_org_id
      AND c."adapterCode" = 'FGIS_ZERNO'
      AND c."apiVersion" = '1.0.23'
      AND c."mappingVersion" = 'fgis-zerno-1.0.23-catalog.v1'
      AND c."signingPolicyVersion" = 'fgis-zerno-1.0.23-signing-policy.v1'
      AND c."status" = 'TEST_APPROVED'
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'ACK_PROVIDER_CONFIGURATION_INVALID'
        USING ERRCODE = '22023';
    END IF;
    SELECT count(DISTINCT a."gate") INTO v_gate_count
    FROM public."fgis_grain_provider_attestations" a
    WHERE a."configurationId" = v_config."id"
      AND a."configurationVersion" = v_config."version"
      AND a."decision" = 'APPROVED'
      AND a."validUntil" > clock_timestamp()
      AND a."gate" IN ('OWNER', 'SECURITY', 'LEGAL', 'OPERATIONS');
    IF v_gate_count <> 4 THEN
      RAISE EXCEPTION 'ACK_PROVIDER_ATTESTATION_INVALID'
        USING ERRCODE = '22023';
    END IF;
  ELSE
    IF p_ack_envelope_reference IS NOT NULL
       OR p_ack_envelope_sha256 IS NOT NULL
       OR p_ack_envelope_size_bytes IS NOT NULL
       OR p_ack_message_data_id IS NOT NULL
       OR p_provider_configuration_reference IS NOT NULL
    THEN
      RAISE EXCEPTION 'ACK_ENVELOPE_FORBIDDEN'
        USING ERRCODE = '22023';
    END IF;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(
    'fgis-grain-ack:' || v_tenant_id || ':' || v_org_id || ':' || p_inbox_entry_id,
    0
  ));

  SELECT a.* INTO v_existing
  FROM public."fgis_grain_acknowledgements" a
  WHERE a."inboxEntryId" = p_inbox_entry_id
  FOR UPDATE;
  IF FOUND THEN
    IF v_existing."tenantId" = v_tenant_id
       AND v_existing."organizationId" = v_org_id
       AND v_existing."inboundTransportOperation" = p_inbound_transport_operation
       AND v_existing."inboundMessageId" = p_inbound_message_id
       AND v_existing."inboundReferenceMessageId" IS NOT DISTINCT FROM p_inbound_reference_message_id
       AND v_existing."inboundResponseCode" = p_inbound_response_code
       AND v_existing."verifiedPayloadFingerprint" = p_verified_payload_fingerprint
       AND v_existing."ackPolicyVersion" = v_policy_version
       AND v_existing."ackPolicyHash" = v_policy_hash
       AND v_existing."decision" = CASE WHEN v_required THEN 'REQUIRED' ELSE 'NOT_REQUIRED' END
       AND v_existing."ackEnvelopeReference" IS NOT DISTINCT FROM p_ack_envelope_reference
       AND v_existing."ackEnvelopeSha256" IS NOT DISTINCT FROM p_ack_envelope_sha256
       AND v_existing."ackEnvelopeSizeBytes" IS NOT DISTINCT FROM p_ack_envelope_size_bytes
       AND v_existing."ackMessageDataId" IS NOT DISTINCT FROM p_ack_message_data_id
       AND v_existing."providerConfigurationReference" IS NOT DISTINCT FROM p_provider_configuration_reference
    THEN
      RETURN jsonb_build_object(
        'schemaVersion', 'pc-crop.fgis-grain-ack-result.v1',
        'kind', CASE WHEN v_existing."state" = 'NOT_REQUIRED' THEN 'NOT_REQUIRED' ELSE 'REPLAY' END,
        'acknowledgementId', v_existing."id",
        'inboxEntryId', v_existing."inboxEntryId",
        'state', v_existing."state",
        'decision', v_existing."decision",
        'reasonCode', v_existing."reasonCode",
        'commandId', v_existing."commandId",
        'messageId', v_existing."messageId",
        'referenceMessageId', v_existing."referenceMessageId",
        'outboxEntryId', v_existing."outboundOutboxEntryId",
        'exchangeId', v_existing."exchangeId",
        'auditEventId', v_existing."auditEventId",
        'eventOutboxEntryId', v_existing."eventOutboxEntryId",
        'correlationId', p_correlation_id,
        'policyVersion', v_existing."ackPolicyVersion",
        'policyHash', v_existing."ackPolicyHash",
        'operationalStatus', 'NOT_ATTESTED'
      );
    END IF;

    v_before := to_jsonb(v_existing);
    UPDATE public."fgis_grain_acknowledgements"
    SET "state" = 'RECONCILIATION_REQUIRED',
        "reasonCode" = CASE
          WHEN v_existing."ackPolicyVersion" <> v_policy_version
            OR v_existing."ackPolicyHash" <> v_policy_hash
          THEN 'ACK_RECONCILIATION_POLICY_MISMATCH'
          WHEN v_existing."verifiedPayloadFingerprint" <> p_verified_payload_fingerprint
          THEN 'ACK_RECONCILIATION_FINGERPRINT_MISMATCH'
          ELSE 'ACK_RECONCILIATION_IDENTITY_MISMATCH'
        END,
        "reconciliationReason" = p_reason,
        "reconciliationDetectedAt" = clock_timestamp(),
        "version" = "version" + 1,
        "updatedAt" = clock_timestamp()
    WHERE "id" = v_existing."id"
    RETURNING to_jsonb(public."fgis_grain_acknowledgements".*) INTO v_after;
    v_event := public.emit_fgis_grain_ack_event(
      'FGIS_GRAIN_ACK_RECONCILIATION_REQUIRED',
      v_existing."id", p_inbox_entry_id, v_existing."exchangeId",
      v_tenant_id, v_org_id, v_actor_id, v_actor_role, p_reason,
      p_correlation_id,
      'fgis-ack-reconciliation-' || encode(digest(convert_to(v_existing."id" || ':' || p_verified_payload_fingerprint, 'UTF8'), 'sha256'), 'hex'),
      v_before, v_after,
      jsonb_build_object('policyVersion', v_policy_version, 'policyHash', v_policy_hash)
    );
    RETURN jsonb_build_object(
      'schemaVersion', 'pc-crop.fgis-grain-ack-result.v1',
      'kind', 'RECONCILIATION_REQUIRED',
      'acknowledgementId', v_existing."id",
      'inboxEntryId', p_inbox_entry_id,
      'state', 'RECONCILIATION_REQUIRED',
      'decision', v_existing."decision",
      'reasonCode', v_after ->> 'reasonCode',
      'commandId', v_existing."commandId",
      'messageId', v_existing."messageId",
      'referenceMessageId', v_existing."referenceMessageId",
      'outboxEntryId', v_existing."outboundOutboxEntryId",
      'exchangeId', v_existing."exchangeId",
      'auditEventId', v_event ->> 'auditEventId',
      'eventOutboxEntryId', v_event ->> 'outboxEntryId',
      'correlationId', p_correlation_id,
      'policyVersion', v_policy_version,
      'policyHash', v_policy_hash,
      'operationalStatus', 'NOT_ATTESTED'
    );
  END IF;

  v_ack_id := 'fgis-ack-' || gen_random_uuid()::text;
  IF NOT v_required THEN
    v_after := jsonb_build_object(
      'id', v_ack_id,
      'state', 'NOT_REQUIRED',
      'decision', 'NOT_REQUIRED',
      'reasonCode', v_reason_code,
      'policyVersion', v_policy_version,
      'policyHash', v_policy_hash
    );
    v_event := public.emit_fgis_grain_ack_event(
      'FGIS_GRAIN_ACK_NOT_REQUIRED',
      v_ack_id, p_inbox_entry_id, NULL,
      v_tenant_id, v_org_id, v_actor_id, v_actor_role, p_reason,
      p_correlation_id,
      'fgis-ack-not-required-' || encode(digest(convert_to(v_tenant_id || ':' || v_org_id || ':' || p_inbox_entry_id || ':' || v_policy_hash, 'UTF8'), 'sha256'), 'hex'),
      NULL, v_after,
      jsonb_build_object(
        'reasonCode', v_reason_code,
        'transportOperation', p_inbound_transport_operation,
        'responseCode', p_inbound_response_code,
        'policyVersion', v_policy_version,
        'policyHash', v_policy_hash
      )
    );
    INSERT INTO public."fgis_grain_acknowledgements" (
      "id", "tenantId", "organizationId", "inboxEntryId",
      "inboundTransportOperation", "inboundMessageId",
      "inboundReferenceMessageId", "inboundResponseCode",
      "verifiedPayloadFingerprint", "ackPolicyVersion", "ackPolicyHash",
      "decision", "reasonCode", "auditEventId", "eventOutboxEntryId",
      "state", "version", "createdAt", "updatedAt"
    ) VALUES (
      v_ack_id, v_tenant_id, v_org_id, p_inbox_entry_id,
      p_inbound_transport_operation, p_inbound_message_id,
      p_inbound_reference_message_id, p_inbound_response_code,
      p_verified_payload_fingerprint, v_policy_version, v_policy_hash,
      'NOT_REQUIRED', v_reason_code, v_event ->> 'auditEventId',
      v_event ->> 'outboxEntryId', 'NOT_REQUIRED', 0,
      clock_timestamp(), clock_timestamp()
    );
    RETURN jsonb_build_object(
      'schemaVersion', 'pc-crop.fgis-grain-ack-result.v1',
      'kind', 'NOT_REQUIRED',
      'acknowledgementId', v_ack_id,
      'inboxEntryId', p_inbox_entry_id,
      'state', 'NOT_REQUIRED',
      'decision', 'NOT_REQUIRED',
      'reasonCode', v_reason_code,
      'commandId', NULL,
      'messageId', NULL,
      'referenceMessageId', NULL,
      'outboxEntryId', NULL,
      'exchangeId', NULL,
      'auditEventId', v_event ->> 'auditEventId',
      'eventOutboxEntryId', v_event ->> 'outboxEntryId',
      'correlationId', p_correlation_id,
      'policyVersion', v_policy_version,
      'policyHash', v_policy_hash,
      'operationalStatus', 'NOT_ATTESTED'
    );
  END IF;

  v_command_id := 'fgis-ack-command-' || encode(digest(convert_to(
    v_tenant_id || chr(31) || v_org_id || chr(31) || p_inbox_entry_id || chr(31) || v_policy_hash,
    'UTF8'
  ), 'sha256'), 'hex');
  v_message_id := public.fgis_grain_ack_uuid_v1(
    v_tenant_id || chr(31) || v_org_id || chr(31) || p_inbox_entry_id || chr(31) || v_policy_hash
  );
  v_after := jsonb_build_object(
    'id', v_ack_id,
    'state', 'ACK_DISPATCH_REQUESTED',
    'decision', 'REQUIRED',
    'reasonCode', v_reason_code,
    'commandId', v_command_id,
    'messageId', v_message_id,
    'referenceMessageId', p_inbound_message_id,
    'policyVersion', v_policy_version,
    'policyHash', v_policy_hash
  );
  v_event := public.emit_fgis_grain_ack_event(
    'FGIS_GRAIN_ACK_REQUESTED',
    v_ack_id, p_inbox_entry_id, NULL,
    v_tenant_id, v_org_id, v_actor_id, v_actor_role, p_reason,
    p_correlation_id,
    'fgis-ack-requested-' || encode(digest(convert_to(v_ack_id || ':' || v_policy_hash, 'UTF8'), 'sha256'), 'hex'),
    NULL, v_after,
    jsonb_build_object(
      'reasonCode', v_reason_code,
      'transportOperation', 'Ack',
      'referenceMessageId', p_inbound_message_id,
      'policyVersion', v_policy_version,
      'policyHash', v_policy_hash
    )
  );

  v_payload := jsonb_build_object(
    'schemaVersion', 'pc-crop.fgis-grain-outbound-dispatch.v1',
    'adapterCode', 'FGIS_ZERNO',
    'apiVersion', '1.0.23',
    'mappingVersion', 'fgis-zerno-1.0.23-catalog.v1',
    'signingPolicyVersion', 'fgis-zerno-1.0.23-signing-policy.v1',
    'tenantId', v_tenant_id,
    'organizationId', v_org_id,
    'commandId', v_command_id,
    'transportOperation', 'Ack',
    'businessOperationCode', NULL,
    'messageId', v_message_id,
    'referenceMessageId', p_inbound_message_id,
    'messageDataId', p_ack_message_data_id,
    'unsignedEnvelopeReference', p_ack_envelope_reference,
    'unsignedEnvelopeSha256', p_ack_envelope_sha256,
    'unsignedEnvelopeSizeBytes', p_ack_envelope_size_bytes,
    'messageDataSha256', p_ack_envelope_sha256,
    'providerConfigurationReference', p_provider_configuration_reference,
    'correlationId', p_correlation_id,
    'causationId', p_causation_id
  );
  v_dispatch_outbox_id := 'fgis-ack-dispatch-' || gen_random_uuid()::text;
  INSERT INTO public."outbox_entries" (
    "id", "type", "dealId", "payload", "status", "triggeredByUserId",
    "idempotencyKey", "maxRetries", "retryCount", "nextRetryAt",
    "correlationId", "auditId", "createdAt"
  ) VALUES (
    v_dispatch_outbox_id, 'FGIS_GRAIN_OUTBOUND_DISPATCH_REQUESTED', NULL,
    v_payload, 'PENDING', v_actor_id,
    'fgis-ack-dispatch-' || encode(digest(convert_to(v_tenant_id || ':' || v_org_id || ':' || p_inbox_entry_id || ':' || v_policy_hash, 'UTF8'), 'sha256'), 'hex'),
    5, 0, clock_timestamp(), p_correlation_id,
    v_event ->> 'auditEventId', clock_timestamp()
  );

  SELECT e."id" INTO v_exchange_id
  FROM public."fgis_grain_exchanges" e
  WHERE e."outboundOutboxEntryId" = v_dispatch_outbox_id;
  IF v_exchange_id IS NULL THEN
    RAISE EXCEPTION 'ACK_EXCHANGE_BINDING_MISSING'
      USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public."fgis_grain_acknowledgements" (
    "id", "tenantId", "organizationId", "inboxEntryId",
    "inboundTransportOperation", "inboundMessageId",
    "inboundReferenceMessageId", "inboundResponseCode",
    "verifiedPayloadFingerprint", "ackPolicyVersion", "ackPolicyHash",
    "decision", "reasonCode", "commandId", "messageId",
    "referenceMessageId", "ackEnvelopeReference", "ackEnvelopeSha256",
    "ackEnvelopeSizeBytes", "ackMessageDataId",
    "providerConfigurationReference", "outboundOutboxEntryId", "exchangeId",
    "auditEventId", "eventOutboxEntryId", "state", "version",
    "createdAt", "updatedAt"
  ) VALUES (
    v_ack_id, v_tenant_id, v_org_id, p_inbox_entry_id,
    p_inbound_transport_operation, p_inbound_message_id,
    p_inbound_reference_message_id, p_inbound_response_code,
    p_verified_payload_fingerprint, v_policy_version, v_policy_hash,
    'REQUIRED', v_reason_code, v_command_id, v_message_id,
    p_inbound_message_id, p_ack_envelope_reference, p_ack_envelope_sha256,
    p_ack_envelope_size_bytes, p_ack_message_data_id,
    p_provider_configuration_reference, v_dispatch_outbox_id, v_exchange_id,
    v_event ->> 'auditEventId', v_event ->> 'outboxEntryId',
    'ACK_DISPATCH_REQUESTED', 0, clock_timestamp(), clock_timestamp()
  );

  RETURN jsonb_build_object(
    'schemaVersion', 'pc-crop.fgis-grain-ack-result.v1',
    'kind', 'CREATED',
    'acknowledgementId', v_ack_id,
    'inboxEntryId', p_inbox_entry_id,
    'state', 'ACK_DISPATCH_REQUESTED',
    'decision', 'REQUIRED',
    'reasonCode', v_reason_code,
    'commandId', v_command_id,
    'messageId', v_message_id,
    'referenceMessageId', p_inbound_message_id,
    'outboxEntryId', v_dispatch_outbox_id,
    'exchangeId', v_exchange_id,
    'auditEventId', v_event ->> 'auditEventId',
    'eventOutboxEntryId', v_event ->> 'outboxEntryId',
    'correlationId', p_correlation_id,
    'policyVersion', v_policy_version,
    'policyHash', v_policy_hash,
    'operationalStatus', 'NOT_ATTESTED'
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_fgis_grain_ack_transport_acceptance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_ack public."fgis_grain_acknowledgements"%ROWTYPE;
  v_before jsonb;
  v_after jsonb;
  v_event jsonb;
BEGIN
  IF NEW."transportOperation" <> 'Ack'
     OR NEW."state" <> 'TRANSPORT_ACCEPTED'
     OR OLD."state" = 'TRANSPORT_ACCEPTED'
  THEN
    RETURN NEW;
  END IF;
  SELECT a.* INTO v_ack
  FROM public."fgis_grain_acknowledgements" a
  WHERE a."exchangeId" = NEW."id"
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;
  IF v_ack."state" = 'ACK_TRANSPORT_ACCEPTED' THEN
    RETURN NEW;
  END IF;
  v_before := to_jsonb(v_ack);
  IF v_ack."state" <> 'ACK_DISPATCH_REQUESTED' THEN
    UPDATE public."fgis_grain_acknowledgements"
    SET "state" = 'RECONCILIATION_REQUIRED',
        "reasonCode" = 'ACK_RECONCILIATION_IDENTITY_MISMATCH',
        "reconciliationReason" = 'ACK exchange reached transport acceptance from an invalid acknowledgement state',
        "reconciliationDetectedAt" = clock_timestamp(),
        "version" = "version" + 1,
        "updatedAt" = clock_timestamp()
    WHERE "id" = v_ack."id"
    RETURNING to_jsonb(public."fgis_grain_acknowledgements".*) INTO v_after;
    PERFORM public.emit_fgis_grain_ack_event(
      'FGIS_GRAIN_ACK_RECONCILIATION_REQUIRED', v_ack."id",
      v_ack."inboxEntryId", NEW."id", v_ack."tenantId",
      v_ack."organizationId", 'fgis-outbox-worker', 'SYSTEM',
      'ACK transport acceptance conflicted with the durable acknowledgement state',
      NEW."correlationId", 'fgis-ack-transport-reconciliation-' || v_ack."id",
      v_before, v_after,
      jsonb_build_object('exchangeState', NEW."state", 'exchangeVersion', NEW."version")
    );
    RETURN NEW;
  END IF;

  UPDATE public."fgis_grain_acknowledgements"
  SET "state" = 'ACK_TRANSPORT_ACCEPTED',
      "version" = "version" + 1,
      "updatedAt" = clock_timestamp()
  WHERE "id" = v_ack."id"
  RETURNING to_jsonb(public."fgis_grain_acknowledgements".*) INTO v_after;
  v_event := public.emit_fgis_grain_ack_event(
    'FGIS_GRAIN_ACK_TRANSPORT_ACCEPTED', v_ack."id",
    v_ack."inboxEntryId", NEW."id", v_ack."tenantId",
    v_ack."organizationId", 'fgis-outbox-worker', 'SYSTEM',
    'Провайдер подтвердил транспортный приём исходящего ACK; квитанция сохранена до завершения outbox',
    NEW."correlationId", 'fgis-ack-transport-accepted-' || v_ack."id",
    v_before, v_after,
    jsonb_build_object(
      'providerMessageId', NEW."providerMessageId",
      'transportResponseCode', NEW."transportResponseCode",
      'transportAcceptedAt', NEW."transportAcceptedAt",
      'exchangeVersion', NEW."version"
    )
  );
  RETURN NEW;
END;
$function$;

CREATE TRIGGER "fgis_grain_exchange_sync_ack_acceptance"
AFTER UPDATE OF "state" ON public."fgis_grain_exchanges"
FOR EACH ROW
WHEN (NEW."transportOperation" = 'Ack' AND NEW."state" = 'TRANSPORT_ACCEPTED')
EXECUTE FUNCTION public.sync_fgis_grain_ack_transport_acceptance();

REVOKE ALL ON TABLE public."fgis_grain_acknowledgements" FROM PUBLIC;
REVOKE ALL ON TABLE public."fgis_grain_acknowledgements" FROM app_runtime;
REVOKE ALL ON TABLE public."fgis_grain_acknowledgements" FROM app_outbox;
GRANT SELECT ON TABLE public."fgis_grain_acknowledgements" TO app_runtime;
GRANT SELECT ON TABLE public."fgis_grain_acknowledgements" TO app_service;

REVOKE ALL ON FUNCTION public.fgis_grain_ack_uuid_v1(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.emit_fgis_grain_ack_event(
  text,text,text,text,text,text,text,text,text,text,text,jsonb,jsonb,jsonb
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_fgis_grain_acknowledgement(
  text,bigint,text,text,text,text,text,text,text,integer,text,text,text,text,text,text
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_fgis_grain_ack_transport_acceptance() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_fgis_grain_acknowledgement(
  text,bigint,text,text,text,text,text,text,text,integer,text,text,text,text,text,text
) TO app_runtime, app_service;
