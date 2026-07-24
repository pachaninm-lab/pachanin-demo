BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.public_organization_connection_requests (
  id text PRIMARY KEY,
  "requestNumber" text NOT NULL,
  status varchar(24) NOT NULL DEFAULT 'NEW',
  locale varchar(2) NOT NULL,
  "organizationName" text NOT NULL,
  inn varchar(12) NOT NULL,
  "contactName" text NOT NULL,
  position text NOT NULL,
  phone varchar(32) NOT NULL,
  email varchar(254) NOT NULL,
  "organizationRole" varchar(48) NOT NULL,
  scenario varchar(48) NOT NULL,
  "consentVersion" varchar(64) NOT NULL,
  "consentedAt" timestamptz(3) NOT NULL,
  "payloadHash" char(64) NOT NULL,
  "idempotencyKey" varchar(128) NOT NULL,
  "correlationId" varchar(128) NOT NULL,
  source varchar(48) NOT NULL DEFAULT 'PUBLIC_PLATFORM_V7',
  "auditEventId" text NOT NULL,
  "outboxEntryId" text NOT NULL,
  "retentionUntil" timestamptz(3) NOT NULL,
  "createdAt" timestamptz(3) NOT NULL DEFAULT now(),
  "updatedAt" timestamptz(3) NOT NULL DEFAULT now(),
  CONSTRAINT public_org_connection_requests_number_key UNIQUE ("requestNumber"),
  CONSTRAINT public_org_connection_requests_idempotency_key UNIQUE ("idempotencyKey"),
  CONSTRAINT public_org_connection_requests_audit_key UNIQUE ("auditEventId"),
  CONSTRAINT public_org_connection_requests_outbox_key UNIQUE ("outboxEntryId"),
  CONSTRAINT public_org_connection_requests_status_check CHECK (status IN ('NEW', 'IN_REVIEW', 'CONTACTED', 'CLOSED', 'REJECTED')),
  CONSTRAINT public_org_connection_requests_locale_check CHECK (locale IN ('ru', 'en', 'zh')),
  CONSTRAINT public_org_connection_requests_inn_check CHECK (inn ~ '^[0-9]{10}([0-9]{2})?$'),
  CONSTRAINT public_org_connection_requests_payload_hash_check CHECK ("payloadHash" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT public_org_connection_requests_consent_check CHECK ("consentVersion" <> '' AND "consentedAt" <= now()),
  CONSTRAINT public_org_connection_requests_retention_check CHECK ("retentionUntil" > "createdAt"),
  CONSTRAINT public_org_connection_requests_audit_fkey FOREIGN KEY ("auditEventId")
    REFERENCES public.audit_events(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT public_org_connection_requests_outbox_fkey FOREIGN KEY ("outboxEntryId")
    REFERENCES public.outbox_entries(id) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS public_org_connection_requests_status_created_idx
  ON public.public_organization_connection_requests (status, "createdAt" DESC, id);
CREATE INDEX IF NOT EXISTS public_org_connection_requests_inn_created_idx
  ON public.public_organization_connection_requests (inn, "createdAt" DESC);
CREATE INDEX IF NOT EXISTS public_org_connection_requests_email_created_idx
  ON public.public_organization_connection_requests (email, "createdAt" DESC);
CREATE INDEX IF NOT EXISTS public_org_connection_requests_payload_hash_idx
  ON public.public_organization_connection_requests ("payloadHash");
CREATE INDEX IF NOT EXISTS public_org_connection_requests_retention_idx
  ON public.public_organization_connection_requests ("retentionUntil");

ALTER TABLE public.public_organization_connection_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_organization_connection_requests FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.public_organization_connection_requests FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.lookup_public_organization_connection_request(
  p_idempotency_key text,
  p_payload_hash text
)
RETURNS TABLE (
  request_number text,
  request_status text,
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

  RETURN QUERY SELECT stored."requestNumber", stored.status, TRUE, stored."correlationId";
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
  request_status text,
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
    RETURN QUERY SELECT stored."requestNumber", stored.status, TRUE, stored."correlationId";
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

  RETURN QUERY SELECT v_request_number, 'NEW'::text, FALSE, p_correlation_id;
END
$function$;

DROP POLICY IF EXISTS public_org_intake_owner_select ON public.public_organization_connection_requests;
DROP POLICY IF EXISTS public_org_intake_owner_insert ON public.public_organization_connection_requests;
CREATE POLICY public_org_intake_owner_select
ON public.public_organization_connection_requests FOR SELECT
USING (current_user = pg_get_userbyid((SELECT relowner FROM pg_class WHERE oid = 'public.public_organization_connection_requests'::regclass)));
CREATE POLICY public_org_intake_owner_insert
ON public.public_organization_connection_requests FOR INSERT
WITH CHECK (
  current_user = pg_get_userbyid((SELECT relowner FROM pg_class WHERE oid = 'public.public_organization_connection_requests'::regclass))
  AND source = 'PUBLIC_PLATFORM_V7'
);

DROP POLICY IF EXISTS public_org_intake_audit_insert ON public.audit_events;
CREATE POLICY public_org_intake_audit_insert
ON public.audit_events FOR INSERT
WITH CHECK (
  current_user = pg_get_userbyid((SELECT relowner FROM pg_class WHERE oid = 'public.audit_events'::regclass))
  AND "tenantId" IS NULL
  AND "orgId" IS NULL
  AND "dealId" IS NULL
  AND "disputeId" IS NULL
  AND action = 'public:organization-intake:create'
  AND "actorUserId" = 'public:organization-intake'
  AND "actorRole" = 'PUBLIC'
  AND "objectType" = 'PublicOrganizationConnectionRequest'
  AND "objectId" LIKE 'public-org-request-%'
  AND outcome = 'SUCCESS'
);

DROP POLICY IF EXISTS public_org_intake_outbox_insert ON public.outbox_entries;
CREATE POLICY public_org_intake_outbox_insert
ON public.outbox_entries FOR INSERT
WITH CHECK (
  current_user = pg_get_userbyid((SELECT relowner FROM pg_class WHERE oid = 'public.outbox_entries'::regclass))
  AND "dealId" IS NULL
  AND type = 'PUBLIC_ORGANIZATION_CONNECTION_REQUESTED'
  AND status = 'PENDING'
  AND "triggeredByUserId" IS NULL
  AND "idempotencyKey" LIKE 'public-org-intake:%'
  AND payload ->> 'source' = 'PUBLIC_PLATFORM_V7'
  AND NOT (payload ?| ARRAY['organizationName','inn','contactName','position','phone','email','payloadHash'])
);

REVOKE ALL ON FUNCTION public.lookup_public_organization_connection_request(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_public_organization_connection_request(text, text, text, text, text, text, text, text, text, text, text, text, text) FROM PUBLIC;

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

COMMENT ON TABLE public.public_organization_connection_requests IS
  'Pre-tenant public organization connection requests. Does not create Organization, User, membership, role or tenant authority.';
COMMENT ON FUNCTION public.create_public_organization_connection_request(text, text, text, text, text, text, text, text, text, text, text, text, text) IS
  'Least-privilege pre-tenant command boundary. Atomically persists request, non-PII audit and non-PII outbox event.';

COMMIT;
