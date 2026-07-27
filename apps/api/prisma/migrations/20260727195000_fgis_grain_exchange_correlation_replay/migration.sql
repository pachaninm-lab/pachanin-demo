-- Exact replay must be readable after the original inbox lease has been
-- consumed. Divergent reuse of a processed inbox fails closed without mutating
-- accepted evidence.
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
  v_replay_outbox_id text;
  v_replay_audit_id text;
  v_replay_correlation_id text;
  v_replay_idempotency_key text;
  v_replay_reason text;
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

  -- Processed exact replay is independent of the consumed lease and optimistic
  -- version, but every immutable authority field must still match.
  IF v_inbox."linkedDomainOperationType" = 'FGIS_GRAIN_EXCHANGE'
     AND v_inbox."linkedDomainOperationId" IS NOT NULL
  THEN
    SELECT * INTO v_exchange
    FROM public."fgis_grain_exchanges" e
    WHERE e."id" = v_inbox."linkedDomainOperationId"
      AND e."tenantId" = v_tenant_id
      AND e."organizationId" = v_org_id
    FOR UPDATE;
    IF FOUND
       AND v_inbox."state" = 'PROCESSED'
       AND v_exchange."state" = 'RESPONSE_RECEIVED'
       AND v_exchange."responseInboxEntryId" = p_inbox_entry_id
       AND v_exchange."responseProviderMessageId" = p_provider_message_id
       AND v_exchange."responseReferenceMessageId" = p_reference_message_id
       AND v_exchange."responseFingerprint" = p_response_fingerprint
       AND v_exchange."responseOccurredAt" = p_provider_occurred_at
       AND v_inbox."externalEventId" = p_provider_message_id
       AND v_inbox."causationId" IS NOT DISTINCT FROM p_reference_message_id
       AND v_inbox."rawBodySha256" = p_raw_body_sha256
       AND v_inbox."occurredAt" = p_provider_occurred_at
    THEN
      SELECT o."id", o."auditId", o."correlationId", o."idempotencyKey", a."reason"
      INTO v_replay_outbox_id, v_replay_audit_id, v_replay_correlation_id,
           v_replay_idempotency_key, v_replay_reason
      FROM public."outbox_entries" o
      JOIN public."audit_events" a ON a."id" = o."auditId"
      WHERE o."id" = v_inbox."outboxEntryId";
      IF v_replay_outbox_id IS NULL
         OR v_replay_audit_id IS NULL
         OR v_replay_correlation_id IS DISTINCT FROM p_correlation_id
         OR v_replay_idempotency_key IS DISTINCT FROM p_idempotency_key
         OR v_replay_reason IS DISTINCT FROM p_reason
      THEN
        RAISE EXCEPTION 'FGIS_EXCHANGE_REPLAY_EVIDENCE_INVALID'
          USING ERRCODE = '55000';
      END IF;
      RETURN jsonb_build_object(
        'schemaVersion', 'pc-crop.fgis-grain-exchange-event.v1',
        'kind', 'REPLAY',
        'exchangeId', v_exchange."id",
        'inboxEntryId', p_inbox_entry_id,
        'auditEventId', v_replay_audit_id,
        'outboxEntryId', v_replay_outbox_id,
        'correlationId', v_replay_correlation_id,
        'reasonCode', NULL,
        'operationalStatus', 'NOT_ATTESTED'
      );
    END IF;
    RAISE EXCEPTION 'FGIS_EXCHANGE_REPLAY_MISMATCH'
      USING ERRCODE = '23505';
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

  IF v_exchange."state" <> 'TRANSPORT_ACCEPTED'
     OR v_exchange."responseInboxEntryId" IS NOT NULL
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
