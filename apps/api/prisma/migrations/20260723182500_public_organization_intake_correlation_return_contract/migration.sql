BEGIN;

-- PostgreSQL PL/pgSQL RETURN QUERY requires every returned expression to match
-- the declared TABLE return type exactly. The persisted correlationId column is
-- varchar(128), while the stable public function contract exposes text.
-- Preserve the public contract and cast the stored value explicitly.

CREATE OR REPLACE FUNCTION public.lookup_public_organization_connection_request(
  p_idempotency_key text,
  p_payload_hash text
)
RETURNS TABLE (
  request_number text,
  request_status varchar(24),
  replay boolean,
  correlation_id text
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = pg_catalog, public
AS $function$
DECLARE
  stored public.public_organization_connection_requests%ROWTYPE;
BEGIN
  IF p_idempotency_key !~ '^[A-Za-z0-9._:-]{16,128}$'
    OR p_payload_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PUBLIC_INTAKE_LOOKUP_INVALID';
  END IF;

  SELECT * INTO stored
  FROM public.public_organization_connection_requests request
  WHERE request."idempotencyKey" = p_idempotency_key;

  IF NOT FOUND THEN
    RETURN;
  END IF;
  IF stored."payloadHash" <> p_payload_hash THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'IDEMPOTENCY_PAYLOAD_MISMATCH';
  END IF;

  RETURN QUERY
  SELECT
    stored."requestNumber",
    stored.status,
    TRUE,
    stored."correlationId"::text;
END
$function$;

CREATE OR REPLACE FUNCTION public.create_public_organization_connection_request(
  p_organization_name text,
  p_inn text,
  p_contact_name text,
  p_position text,
  p_phone text,
  p_email text,
  p_organization_role text,
  p_scenario text,
  p_locale text,
  p_consent_version text,
  p_payload_hash text,
  p_idempotency_key text,
  p_correlation_id text
)
RETURNS TABLE (
  request_number text,
  request_status varchar(24),
  replay boolean,
  correlation_id text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  stored public.public_organization_connection_requests%ROWTYPE;
  v_request_id text := 'public-org-request-' || gen_random_uuid()::text;
  v_audit_id text := 'audit-' || gen_random_uuid()::text;
  v_outbox_id text := 'outbox-' || gen_random_uuid()::text;
  v_request_number text := 'PC-' || to_char(transaction_timestamp(), 'YYYYMMDD') || '-' || upper(encode(gen_random_bytes(6), 'hex'));
  v_created_at timestamptz(3) := transaction_timestamp();
  v_retention_until timestamptz(3) := transaction_timestamp() + interval '180 days';
  v_event jsonb;
BEGIN
  IF p_organization_name IS NULL OR length(btrim(p_organization_name)) NOT BETWEEN 2 AND 200
    OR p_inn !~ '^[0-9]{10}([0-9]{2})?$'
    OR p_contact_name IS NULL OR length(btrim(p_contact_name)) NOT BETWEEN 2 AND 160
    OR p_position IS NULL OR length(btrim(p_position)) NOT BETWEEN 2 AND 160
    OR p_phone IS NULL OR length(p_phone) NOT BETWEEN 7 AND 32
    OR p_email IS NULL OR length(p_email) > 254
    OR p_organization_role NOT IN ('PRODUCER_SELLER','BUYER_PROCESSOR','LOGISTICS','STORAGE_ELEVATOR','LAB_SURVEYOR','BANK_FINANCE','PUBLIC_INDUSTRY_PARTNER')
    OR p_scenario NOT IN ('DEAL_EXECUTION','LOGISTICS_ACCEPTANCE','QUALITY_LAB','DOCUMENTS_EVIDENCE','FINANCE_SETTLEMENT','EXTERNAL_INTEGRATION')
    OR p_locale NOT IN ('ru','en','zh')
    OR p_consent_version <> 'public-organization-connect-v1'
    OR p_payload_hash !~ '^[0-9a-f]{64}$'
    OR p_idempotency_key !~ '^[A-Za-z0-9._:-]{16,128}$'
    OR p_correlation_id !~ '^[A-Za-z0-9._:-]{8,128}$' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PUBLIC_INTAKE_COMMAND_INVALID';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_idempotency_key, 0));

  SELECT * INTO stored
  FROM public.public_organization_connection_requests request
  WHERE request."idempotencyKey" = p_idempotency_key;

  IF FOUND THEN
    IF stored."payloadHash" <> p_payload_hash THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'IDEMPOTENCY_PAYLOAD_MISMATCH';
    END IF;
    RETURN QUERY
    SELECT
      stored."requestNumber",
      stored.status,
      TRUE,
      stored."correlationId"::text;
    RETURN;
  END IF;

  v_event := jsonb_build_object(
    'requestId', v_request_id,
    'requestNumber', v_request_number,
    'status', 'NEW',
    'source', 'PUBLIC_PLATFORM_V7',
    'locale', p_locale,
    'organizationRole', p_organization_role,
    'scenario', p_scenario,
    'consentVersion', p_consent_version,
    'createdAt', v_created_at
  );

  INSERT INTO public.audit_events (
    id, action, "actorUserId", "actorRole", "objectType", "objectId",
    outcome, metadata, "correlationId", hash, "prevHash", "createdAt"
  ) VALUES (
    v_audit_id,
    'public:organization-intake:create',
    'public:organization-intake',
    'PUBLIC',
    'PublicOrganizationConnectionRequest',
    v_request_id,
    'SUCCESS',
    v_event,
    p_correlation_id,
    '',
    NULL,
    v_created_at
  );

  INSERT INTO public.outbox_entries (
    id, type, payload, status, "triggeredByUserId", "idempotencyKey",
    "maxRetries", "retryCount", "nextRetryAt", "correlationId", "auditId", "createdAt"
  ) VALUES (
    v_outbox_id,
    'PUBLIC_ORGANIZATION_CONNECTION_REQUESTED',
    v_event,
    'PENDING',
    NULL,
    'public-org-intake:' || p_idempotency_key,
    5,
    0,
    v_created_at,
    p_correlation_id,
    v_audit_id,
    v_created_at
  );

  INSERT INTO public.public_organization_connection_requests (
    id, "requestNumber", status, locale, "organizationName", inn,
    "contactName", position, phone, email, "organizationRole", scenario,
    "consentVersion", "consentedAt", "payloadHash", "idempotencyKey",
    "correlationId", source, "auditEventId", "outboxEntryId",
    "retentionUntil", "createdAt", "updatedAt"
  ) VALUES (
    v_request_id,
    v_request_number,
    'NEW',
    p_locale,
    btrim(p_organization_name),
    p_inn,
    btrim(p_contact_name),
    btrim(p_position),
    p_phone,
    lower(p_email),
    p_organization_role,
    p_scenario,
    p_consent_version,
    v_created_at,
    p_payload_hash,
    p_idempotency_key,
    p_correlation_id,
    'PUBLIC_PLATFORM_V7',
    v_audit_id,
    v_outbox_id,
    v_retention_until,
    v_created_at,
    v_created_at
  );

  RETURN QUERY SELECT v_request_number, 'NEW'::varchar(24), FALSE, p_correlation_id;
END
$function$;

REVOKE ALL ON FUNCTION public.lookup_public_organization_connection_request(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_public_organization_connection_request(
  text, text, text, text, text, text, text, text, text, text, text, text, text
) FROM PUBLIC;

DO $public_org_intake_grants$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_deal') THEN
    GRANT EXECUTE ON FUNCTION public.lookup_public_organization_connection_request(text, text) TO app_deal;
    GRANT EXECUTE ON FUNCTION public.create_public_organization_connection_request(text, text, text, text, text, text, text, text, text, text, text, text, text) TO app_deal;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_service') THEN
    GRANT EXECUTE ON FUNCTION public.lookup_public_organization_connection_request(text, text) TO app_service;
    GRANT EXECUTE ON FUNCTION public.create_public_organization_connection_request(text, text, text, text, text, text, text, text, text, text, text, text, text) TO app_service;
  END IF;
END
$public_org_intake_grants$;

COMMENT ON FUNCTION public.lookup_public_organization_connection_request(text, text)
  IS 'Least-privilege idempotency lookup. Stored varchar correlation identifiers are explicitly returned through the stable text contract.';
COMMENT ON FUNCTION public.create_public_organization_connection_request(
  text, text, text, text, text, text, text, text, text, text, text, text, text
) IS 'Least-privilege pre-tenant command boundary. Atomically persists request, non-PII audit and non-PII outbox event.';

COMMIT;
