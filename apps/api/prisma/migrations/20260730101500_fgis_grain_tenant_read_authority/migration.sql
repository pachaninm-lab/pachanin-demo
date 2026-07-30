CREATE OR REPLACE FUNCTION public.text_array_has_unique_elements(items text[])
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $function$
  SELECT cardinality(items) = (
    SELECT count(DISTINCT value)::integer
    FROM unnest(items) AS item(value)
  );
$function$;

CREATE TABLE public."fgis_grain_tenant_read_authorizations" (
  "id" text PRIMARY KEY,
  "tenantId" text NOT NULL,
  "organizationId" text NOT NULL,
  "configurationId" text NOT NULL,
  "configurationVersion" bigint NOT NULL,
  "allowedOperations" text[] NOT NULL,
  "authorizationReference" text NOT NULL,
  "status" text NOT NULL DEFAULT 'ACCESS_REQUIRED',
  "validUntil" timestamptz NOT NULL,
  "reason" text NOT NULL,
  "attestationEvidenceReference" text,
  "attestationValidUntil" timestamptz,
  "attestationJustification" text,
  "attestedByUserId" text,
  "version" bigint NOT NULL DEFAULT 0,
  "createdByUserId" text NOT NULL,
  "updatedByUserId" text NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  "updatedAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT "fgis_grain_tenant_read_auth_config_fk"
    FOREIGN KEY ("configurationId")
    REFERENCES public."fgis_grain_provider_configurations"("id")
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT "fgis_grain_tenant_read_auth_org_fk"
    FOREIGN KEY ("organizationId") REFERENCES public."organizations"("id")
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT "fgis_grain_tenant_read_auth_created_user_fk"
    FOREIGN KEY ("createdByUserId") REFERENCES public."users"("id")
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT "fgis_grain_tenant_read_auth_updated_user_fk"
    FOREIGN KEY ("updatedByUserId") REFERENCES public."users"("id")
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT "fgis_grain_tenant_read_auth_attested_user_fk"
    FOREIGN KEY ("attestedByUserId") REFERENCES public."users"("id")
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT "fgis_grain_tenant_read_auth_status_ck"
    CHECK ("status" IN (
      'ACCESS_REQUIRED',
      'AUTHORIZED_NOT_ATTESTED',
      'READ_ONLY_ATTESTED',
      'SUSPENDED',
      'REVOKED'
    )),
  CONSTRAINT "fgis_grain_tenant_read_auth_version_ck"
    CHECK ("version" >= 0 AND "configurationVersion" >= 0),
  CONSTRAINT "fgis_grain_tenant_read_auth_operations_ck"
    CHECK (
      cardinality("allowedOperations") > 0
      AND "allowedOperations" <@ ARRAY[
        'DICTIONARIES',
        'GET_LIST_GPB',
        'GET_LIST_GPB_DEBIT',
        'GET_LIST_GPB_EXTINCTION',
        'GET_LIST_GPB_EXTINCTION_REFUSAL',
        'GET_LIST_GPB_SDIZ',
        'GET_LIST_GM_APPLICATION',
        'GET_LIST_HARVESTED_CROP',
        'GET_LIST_PRIMARY_STORAGE_PLACE',
        'GET_LIST_RESEARCH',
        'GET_LIST_SAMPLES_PICKING',
        'GET_LIST_LOT',
        'GET_LIST_LOT_DEBIT',
        'GET_LIST_PURCHASE_FROM_INDIVIDUAL_DOC',
        'GET_LIST_EXTINCTION',
        'GET_LIST_EXTINCTION_REFUSAL',
        'GET_LIST_SDIZ',
        'GET_LIST_SDIZ_ELEVATOR',
        'GET_LIST_VED_CONTRACT'
      ]::text[]
      AND public.text_array_has_unique_elements("allowedOperations")
    ),
  CONSTRAINT "fgis_grain_tenant_read_auth_ttl_ck"
    CHECK ("validUntil" > "createdAt"),
  CONSTRAINT "fgis_grain_tenant_read_attestation_pair_ck"
    CHECK (
      ("attestationEvidenceReference" IS NULL
        AND "attestationValidUntil" IS NULL
        AND "attestationJustification" IS NULL
        AND "attestedByUserId" IS NULL)
      OR
      ("attestationEvidenceReference" IS NOT NULL
        AND "attestationValidUntil" IS NOT NULL
        AND "attestationJustification" IS NOT NULL
        AND "attestedByUserId" IS NOT NULL)
    ),
  CONSTRAINT "fgis_grain_tenant_read_auth_config_key"
    UNIQUE ("tenantId", "organizationId", "configurationId"),
  CONSTRAINT "fgis_grain_tenant_read_auth_tenant_key"
    UNIQUE ("id", "tenantId", "organizationId")
);

CREATE INDEX "fgis_grain_tenant_read_auth_status_idx"
  ON public."fgis_grain_tenant_read_authorizations"
  ("tenantId", "organizationId", "status", "validUntil");
CREATE INDEX "fgis_grain_tenant_read_auth_updated_idx"
  ON public."fgis_grain_tenant_read_authorizations"
  ("updatedAt" DESC, "id");

CREATE TABLE public."fgis_grain_tenant_read_audits" (
  "id" text PRIMARY KEY,
  "tenantId" text NOT NULL,
  "organizationId" text NOT NULL,
  "authorizationId" text NOT NULL,
  "authorizationVersion" bigint NOT NULL,
  "configurationId" text NOT NULL,
  "actorUserId" text NOT NULL,
  "actorRole" text NOT NULL,
  "operationCode" text NOT NULL,
  "correlationId" text NOT NULL,
  "idempotencyKey" text NOT NULL,
  "requestIdempotencyKey" text NOT NULL,
  "requestReference" text NOT NULL,
  "requestSha256" char(64) NOT NULL,
  "decision" text NOT NULL,
  "reasonCode" text NOT NULL,
  "providerRequestId" text,
  "responseReference" text,
  "responseSha256" char(64),
  "receivedAt" timestamptz,
  "hash" char(64) NOT NULL,
  "prevHash" char(64),
  "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT "fgis_grain_tenant_read_audit_auth_fk"
    FOREIGN KEY ("authorizationId", "tenantId", "organizationId")
    REFERENCES public."fgis_grain_tenant_read_authorizations"("id", "tenantId", "organizationId")
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT "fgis_grain_tenant_read_audit_config_fk"
    FOREIGN KEY ("configurationId")
    REFERENCES public."fgis_grain_provider_configurations"("id")
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT "fgis_grain_tenant_read_audit_org_fk"
    FOREIGN KEY ("organizationId") REFERENCES public."organizations"("id")
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT "fgis_grain_tenant_read_audit_user_fk"
    FOREIGN KEY ("actorUserId") REFERENCES public."users"("id")
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT "fgis_grain_tenant_read_audit_decision_ck"
    CHECK ("decision" IN ('AUTHORIZED', 'ATTESTED', 'DENIED', 'IN_FLIGHT', 'SUCCEEDED', 'FAILED')),
  CONSTRAINT "fgis_grain_tenant_read_audit_authorization_version_ck"
    CHECK ("authorizationVersion" >= 0),
  CONSTRAINT "fgis_grain_tenant_read_audit_request_hash_ck"
    CHECK ("requestSha256" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "fgis_grain_tenant_read_audit_response_hash_ck"
    CHECK ("responseSha256" IS NULL OR "responseSha256" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "fgis_grain_tenant_read_audit_hash_ck"
    CHECK ("hash" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "fgis_grain_tenant_read_audit_prev_hash_ck"
    CHECK ("prevHash" IS NULL OR "prevHash" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "fgis_grain_tenant_read_audit_provider_pair_ck"
    CHECK (
      ("providerRequestId" IS NULL
        AND "responseReference" IS NULL
        AND "responseSha256" IS NULL
        AND "receivedAt" IS NULL)
      OR
      ("providerRequestId" IS NOT NULL
        AND "responseReference" IS NOT NULL
        AND "responseSha256" IS NOT NULL
        AND "receivedAt" IS NOT NULL)
    ),
  CONSTRAINT "fgis_grain_tenant_read_audit_idempotency_key"
    UNIQUE ("tenantId", "organizationId", "idempotencyKey")
);

CREATE INDEX "fgis_grain_tenant_read_audit_auth_idx"
  ON public."fgis_grain_tenant_read_audits"
  ("authorizationId", "createdAt" DESC, "id" DESC);
CREATE INDEX "fgis_grain_tenant_read_audit_correlation_idx"
  ON public."fgis_grain_tenant_read_audits" ("correlationId");
CREATE INDEX "fgis_grain_tenant_read_audit_request_idx"
  ON public."fgis_grain_tenant_read_audits"
  ("tenantId", "organizationId", "requestIdempotencyKey", "createdAt" DESC);
CREATE INDEX "fgis_grain_tenant_read_audit_decision_idx"
  ON public."fgis_grain_tenant_read_audits"
  ("tenantId", "organizationId", "decision", "createdAt" DESC);

CREATE OR REPLACE FUNCTION public.fgis_grain_tenant_read_context_ready(
  require_mfa boolean
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
  SELECT public.app_rls_context_ready()
    AND EXISTS (
      SELECT 1
      FROM auth.sessions AS auth_session
      JOIN public."user_orgs" AS membership
        ON membership."id" = auth_session.membership_id
       AND membership."userId" = auth_session.user_id
       AND membership."organizationId" = auth_session.organization_id
      JOIN public."users" AS app_user
        ON app_user."id" = auth_session.user_id
      JOIN public."organizations" AS organization
        ON organization."id" = auth_session.organization_id
       AND organization."tenantId" = auth_session.tenant_id
      WHERE auth_session.id = current_setting('app.current_session_id', true)
        AND auth_session.user_id = current_setting('app.current_user_id', true)
        AND auth_session.organization_id = current_setting('app.current_org_id', true)
        AND auth_session.tenant_id = current_setting('app.current_tenant_id', true)
        AND membership."role" = current_setting('app.current_role', true)
        AND auth_session.status = 'ACTIVE'
        AND auth_session.revoked_at IS NULL
        AND auth_session.expires_at > statement_timestamp()
        AND app_user."status" = 'ACTIVE'
        AND app_user."deletedAt" IS NULL
        AND (
          NOT require_mfa
          OR (
            auth_session.mfa_verified_at IS NOT NULL
            AND auth_session.mfa_level IN ('TOTP', 'BACKUP')
          )
        )
    );
$function$;

CREATE OR REPLACE FUNCTION public.fgis_grain_tenant_read_provider_authority_valid(
  p_configuration_id text,
  p_configuration_version bigint
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public."fgis_grain_provider_configurations" AS configuration
    WHERE configuration."id" = p_configuration_id
      AND configuration."tenantId" = current_setting('app.current_tenant_id', true)
      AND configuration."organizationId" = current_setting('app.current_org_id', true)
      AND configuration."version" = p_configuration_version
      AND configuration."status" = 'TEST_APPROVED'
  )
  AND (
    SELECT count(*) = 4 AND count(DISTINCT latest."actorUserId") = 4
    FROM (
      SELECT DISTINCT ON (attestation."gate")
        attestation."gate",
        attestation."decision",
        attestation."configurationVersion",
        attestation."actorUserId",
        attestation."validUntil"
      FROM public."fgis_grain_provider_attestations" AS attestation
      WHERE attestation."configurationId" = p_configuration_id
        AND attestation."tenantId" = current_setting('app.current_tenant_id', true)
        AND attestation."organizationId" = current_setting('app.current_org_id', true)
      ORDER BY attestation."gate", attestation."createdAt" DESC, attestation."id" DESC
    ) AS latest
    WHERE latest."gate" IN ('OWNER', 'SECURITY', 'LEGAL', 'OPERATIONS')
      AND latest."decision" = 'APPROVED'
      AND latest."configurationVersion" = p_configuration_version
      AND latest."validUntil" > statement_timestamp()
  );
$function$;

CREATE OR REPLACE FUNCTION public.write_fgis_grain_tenant_read_authorization(
  p_authorization_id text,
  p_configuration_id text,
  p_configuration_version bigint,
  p_allowed_operations text[],
  p_authorization_reference text,
  p_valid_until timestamptz,
  p_reason text,
  p_expected_version bigint
)
RETURNS TABLE(authorization_id text, authorization_version bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  current_row public."fgis_grain_tenant_read_authorizations"%ROWTYPE;
BEGIN
  IF session_user NOT IN ('app_runtime', 'app_service')
     AND NOT COALESCE((
       SELECT role_row.rolsuper
       FROM pg_catalog.pg_roles AS role_row
       WHERE role_row.rolname = session_user
     ), false)
  THEN
    RAISE EXCEPTION 'FGIS Grain tenant-read command principal is denied'
      USING ERRCODE = '42501';
  END IF;

  IF NOT public.fgis_grain_tenant_read_context_ready(true)
     OR current_setting('app.current_role', true)
       NOT IN ('EXECUTIVE', 'ADMIN', 'COMPLIANCE_OFFICER')
  THEN
    RAISE EXCEPTION 'FGIS Grain tenant-read authorization context is denied'
      USING ERRCODE = '42501';
  END IF;

  IF NOT public.fgis_grain_tenant_read_provider_authority_valid(
    p_configuration_id,
    p_configuration_version
  ) THEN
    RAISE EXCEPTION 'FGIS Grain provider authority is missing or stale'
      USING ERRCODE = '42501';
  END IF;

  IF p_expected_version IS NULL THEN
    INSERT INTO public."fgis_grain_tenant_read_authorizations" (
      "id", "tenantId", "organizationId", "configurationId",
      "configurationVersion", "allowedOperations", "authorizationReference",
      "status", "validUntil", "reason", "version",
      "createdByUserId", "updatedByUserId"
    ) VALUES (
      p_authorization_id,
      current_setting('app.current_tenant_id', true),
      current_setting('app.current_org_id', true),
      p_configuration_id,
      p_configuration_version,
      p_allowed_operations,
      p_authorization_reference,
      'AUTHORIZED_NOT_ATTESTED',
      p_valid_until,
      p_reason,
      0,
      current_setting('app.current_user_id', true),
      current_setting('app.current_user_id', true)
    );
    RETURN QUERY SELECT p_authorization_id, 0::bigint;
    RETURN;
  END IF;

  SELECT *
  INTO current_row
  FROM public."fgis_grain_tenant_read_authorizations" AS target_authorization
  WHERE target_authorization."id" = p_authorization_id
    AND target_authorization."tenantId" = current_setting('app.current_tenant_id', true)
    AND target_authorization."organizationId" = current_setting('app.current_org_id', true)
  FOR UPDATE;

  IF NOT FOUND OR current_row."version" IS DISTINCT FROM p_expected_version THEN
    RAISE EXCEPTION 'FGIS Grain tenant-read authorization version changed'
      USING ERRCODE = '40001';
  END IF;
  IF current_row."status" = 'REVOKED' THEN
    RAISE EXCEPTION 'Revoked FGIS Grain tenant-read authorization cannot be reused'
      USING ERRCODE = '55000';
  END IF;

  UPDATE public."fgis_grain_tenant_read_authorizations"
  SET "configurationVersion" = p_configuration_version,
      "allowedOperations" = p_allowed_operations,
      "authorizationReference" = p_authorization_reference,
      "status" = 'AUTHORIZED_NOT_ATTESTED',
      "validUntil" = p_valid_until,
      "attestationEvidenceReference" = NULL,
      "attestationValidUntil" = NULL,
      "attestationJustification" = NULL,
      "attestedByUserId" = NULL,
      "reason" = p_reason,
      "version" = p_expected_version + 1,
      "updatedByUserId" = current_setting('app.current_user_id', true),
      "updatedAt" = clock_timestamp()
  WHERE "id" = p_authorization_id
    AND "tenantId" = current_setting('app.current_tenant_id', true)
    AND "organizationId" = current_setting('app.current_org_id', true)
    AND "version" = p_expected_version;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'FGIS Grain tenant-read authorization version changed'
      USING ERRCODE = '40001';
  END IF;
  RETURN QUERY SELECT p_authorization_id, p_expected_version + 1;
END;
$function$;

CREATE OR REPLACE FUNCTION public.attest_fgis_grain_tenant_read_authorization(
  p_authorization_id text,
  p_expected_version bigint,
  p_evidence_reference text,
  p_valid_until timestamptz,
  p_justification text
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  current_row public."fgis_grain_tenant_read_authorizations"%ROWTYPE;
BEGIN
  IF session_user NOT IN ('app_runtime', 'app_service')
     AND NOT COALESCE((
       SELECT role_row.rolsuper
       FROM pg_catalog.pg_roles AS role_row
       WHERE role_row.rolname = session_user
     ), false)
  THEN
    RAISE EXCEPTION 'FGIS Grain tenant-read command principal is denied'
      USING ERRCODE = '42501';
  END IF;

  IF NOT public.fgis_grain_tenant_read_context_ready(true)
     OR current_setting('app.current_role', true) NOT IN ('ADMIN', 'COMPLIANCE_OFFICER')
  THEN
    RAISE EXCEPTION 'FGIS Grain external-read attestation context is denied'
      USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO current_row
  FROM public."fgis_grain_tenant_read_authorizations" AS target_authorization
  WHERE target_authorization."id" = p_authorization_id
    AND target_authorization."tenantId" = current_setting('app.current_tenant_id', true)
    AND target_authorization."organizationId" = current_setting('app.current_org_id', true)
  FOR UPDATE;

  IF NOT FOUND
     OR current_row."version" IS DISTINCT FROM p_expected_version
     OR current_row."status" IS DISTINCT FROM 'AUTHORIZED_NOT_ATTESTED'
  THEN
    RAISE EXCEPTION 'FGIS Grain tenant-read authorization cannot be attested'
      USING ERRCODE = '40001';
  END IF;
  IF current_row."validUntil" <= statement_timestamp()
     OR p_valid_until <= statement_timestamp()
     OR p_valid_until > current_row."validUntil"
  THEN
    RAISE EXCEPTION 'FGIS Grain tenant-read attestation lifetime is invalid'
      USING ERRCODE = '22023';
  END IF;
  IF NOT public.fgis_grain_tenant_read_provider_authority_valid(
    current_row."configurationId",
    current_row."configurationVersion"
  ) THEN
    RAISE EXCEPTION 'FGIS Grain provider authority is missing or stale'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public."fgis_grain_tenant_read_authorizations"
  SET "status" = 'READ_ONLY_ATTESTED',
      "attestationEvidenceReference" = p_evidence_reference,
      "attestationValidUntil" = p_valid_until,
      "attestationJustification" = p_justification,
      "attestedByUserId" = current_setting('app.current_user_id', true),
      "version" = p_expected_version + 1,
      "updatedByUserId" = current_setting('app.current_user_id', true),
      "updatedAt" = clock_timestamp()
  WHERE "id" = p_authorization_id
    AND "tenantId" = current_setting('app.current_tenant_id', true)
    AND "organizationId" = current_setting('app.current_org_id', true)
    AND "version" = p_expected_version
    AND "status" = 'AUTHORIZED_NOT_ATTESTED';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'FGIS Grain tenant-read authorization state changed'
      USING ERRCODE = '40001';
  END IF;
  RETURN p_expected_version + 1;
END;
$function$;

CREATE OR REPLACE FUNCTION public.append_fgis_grain_tenant_read_audit(
  p_id text,
  p_authorization_id text,
  p_authorization_version bigint,
  p_configuration_id text,
  p_operation_code text,
  p_correlation_id text,
  p_idempotency_key text,
  p_request_idempotency_key text,
  p_request_reference text,
  p_request_sha256 text,
  p_decision text,
  p_reason_code text,
  p_provider_request_id text,
  p_response_reference text,
  p_response_sha256 text,
  p_received_at timestamptz
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  current_authorization public."fgis_grain_tenant_read_authorizations"%ROWTYPE;
  current_head text;
  computed_hash text;
  require_mfa boolean;
BEGIN
  IF session_user NOT IN ('app_runtime', 'app_service')
     AND NOT COALESCE((
       SELECT role_row.rolsuper
       FROM pg_catalog.pg_roles AS role_row
       WHERE role_row.rolname = session_user
     ), false)
  THEN
    RAISE EXCEPTION 'FGIS Grain tenant-read audit principal is denied'
      USING ERRCODE = '42501';
  END IF;

  require_mfa := p_decision IN ('AUTHORIZED', 'ATTESTED');
  IF NOT public.fgis_grain_tenant_read_context_ready(require_mfa) THEN
    RAISE EXCEPTION 'FGIS Grain tenant-read audit context is denied'
      USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO current_authorization
  FROM public."fgis_grain_tenant_read_authorizations" AS candidate
  WHERE candidate."id" = p_authorization_id
    AND candidate."tenantId" = current_setting('app.current_tenant_id', true)
    AND candidate."organizationId" = current_setting('app.current_org_id', true)
    AND candidate."configurationId" = p_configuration_id;

  IF NOT FOUND
     OR (
       p_decision NOT IN ('SUCCEEDED', 'FAILED')
       AND current_authorization."version" IS DISTINCT FROM p_authorization_version
     )
  THEN
    RAISE EXCEPTION 'FGIS Grain tenant-read audit authorization binding is invalid'
      USING ERRCODE = '42501';
  END IF;

  IF p_decision = 'AUTHORIZED' THEN
    IF p_operation_code <> 'AUTHORIZE'
       OR current_setting('app.current_role', true)
         NOT IN ('EXECUTIVE', 'ADMIN', 'COMPLIANCE_OFFICER')
       OR current_authorization."status" <> 'AUTHORIZED_NOT_ATTESTED'
    THEN
      RAISE EXCEPTION 'FGIS Grain authorization audit transition is denied'
        USING ERRCODE = '42501';
    END IF;
  ELSIF p_decision = 'ATTESTED' THEN
    IF p_operation_code <> 'ATTEST'
       OR current_setting('app.current_role', true) NOT IN ('ADMIN', 'COMPLIANCE_OFFICER')
       OR current_authorization."status" <> 'READ_ONLY_ATTESTED'
       OR current_authorization."attestedByUserId"
         IS DISTINCT FROM current_setting('app.current_user_id', true)
    THEN
      RAISE EXCEPTION 'FGIS Grain attestation audit transition is denied'
        USING ERRCODE = '42501';
    END IF;
  ELSE
    IF current_setting('app.current_role', true) NOT IN (
      'FARMER', 'BUYER', 'LOGISTICIAN', 'ELEVATOR', 'LAB', 'ACCOUNTING',
      'EXECUTIVE', 'ADMIN', 'COMPLIANCE_OFFICER', 'SUPPORT_MANAGER'
    ) THEN
      RAISE EXCEPTION 'FGIS Grain read audit role is denied'
        USING ERRCODE = '42501';
    END IF;
    IF p_operation_code NOT IN (
      'DICTIONARIES',
      'GET_LIST_GPB',
      'GET_LIST_GPB_DEBIT',
      'GET_LIST_GPB_EXTINCTION',
      'GET_LIST_GPB_EXTINCTION_REFUSAL',
      'GET_LIST_GPB_SDIZ',
      'GET_LIST_GM_APPLICATION',
      'GET_LIST_HARVESTED_CROP',
      'GET_LIST_PRIMARY_STORAGE_PLACE',
      'GET_LIST_RESEARCH',
      'GET_LIST_SAMPLES_PICKING',
      'GET_LIST_LOT',
      'GET_LIST_LOT_DEBIT',
      'GET_LIST_PURCHASE_FROM_INDIVIDUAL_DOC',
      'GET_LIST_EXTINCTION',
      'GET_LIST_EXTINCTION_REFUSAL',
      'GET_LIST_SDIZ',
      'GET_LIST_SDIZ_ELEVATOR',
      'GET_LIST_VED_CONTRACT'
    ) THEN
      RAISE EXCEPTION 'FGIS Grain mutation operation cannot enter read audit'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF p_decision = 'IN_FLIGHT' THEN
    IF current_authorization."status" <> 'READ_ONLY_ATTESTED'
       OR current_authorization."validUntil" <= statement_timestamp()
       OR current_authorization."attestationValidUntil" IS NULL
       OR current_authorization."attestationValidUntil" <= statement_timestamp()
       OR NOT (
         p_operation_code = ANY(current_authorization."allowedOperations")
       )
       OR NOT public.fgis_grain_tenant_read_provider_authority_valid(
         current_authorization."configurationId",
         current_authorization."configurationVersion"
       )
    THEN
      RAISE EXCEPTION 'FGIS Grain read execution authority is missing or stale'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF p_decision = 'IN_FLIGHT' THEN
    IF p_reason_code <> 'PROVIDER_READ_CLAIMED'
       OR p_provider_request_id IS NOT NULL
       OR p_response_reference IS NOT NULL
       OR p_response_sha256 IS NOT NULL
       OR p_received_at IS NOT NULL
       OR EXISTS (
         SELECT 1
         FROM public."fgis_grain_tenant_read_audits" AS prior
         WHERE prior."tenantId" = current_setting('app.current_tenant_id', true)
           AND prior."organizationId" = current_setting('app.current_org_id', true)
           AND prior."requestIdempotencyKey" = p_request_idempotency_key
       )
    THEN
      RAISE EXCEPTION 'FGIS Grain read execution claim is invalid'
        USING ERRCODE = '23505';
    END IF;
  ELSIF p_decision IN ('SUCCEEDED', 'FAILED') THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public."fgis_grain_tenant_read_audits" AS claim
      WHERE claim."tenantId" = current_setting('app.current_tenant_id', true)
        AND claim."organizationId" = current_setting('app.current_org_id', true)
        AND claim."authorizationId" = p_authorization_id
        AND claim."authorizationVersion" = p_authorization_version
        AND claim."configurationId" = p_configuration_id
        AND claim."actorUserId" = current_setting('app.current_user_id', true)
        AND claim."actorRole" = current_setting('app.current_role', true)
        AND claim."operationCode" = p_operation_code
        AND claim."correlationId" = p_correlation_id
        AND claim."requestIdempotencyKey" = p_request_idempotency_key
        AND claim."requestReference" = p_request_reference
        AND claim."requestSha256" = p_request_sha256
        AND claim."decision" = 'IN_FLIGHT'
        AND claim."reasonCode" = 'PROVIDER_READ_CLAIMED'
    ) OR EXISTS (
      SELECT 1
      FROM public."fgis_grain_tenant_read_audits" AS outcome
      WHERE outcome."tenantId" = current_setting('app.current_tenant_id', true)
        AND outcome."organizationId" = current_setting('app.current_org_id', true)
        AND outcome."requestIdempotencyKey" = p_request_idempotency_key
        AND outcome."decision" IN ('SUCCEEDED', 'FAILED')
    ) OR (
      p_decision = 'SUCCEEDED'
      AND (
        p_provider_request_id IS NULL
        OR p_response_reference IS NULL
        OR p_response_sha256 IS NULL
        OR p_received_at IS NULL
      )
    ) OR (
      p_decision = 'FAILED'
      AND (
        p_provider_request_id IS NOT NULL
        OR p_response_reference IS NOT NULL
        OR p_response_sha256 IS NOT NULL
        OR p_received_at IS NOT NULL
      )
    ) THEN
      RAISE EXCEPTION 'FGIS Grain read execution outcome is not claim-bound'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      'platform-v7:fgis-grain-tenant-read-audit-chain'
        || ':' || current_setting('app.current_tenant_id', true)
        || ':' || current_setting('app.current_org_id', true),
      0
    )
  );
  SELECT audit."hash"
  INTO current_head
  FROM public."fgis_grain_tenant_read_audits" AS audit
  WHERE audit."tenantId" = current_setting('app.current_tenant_id', true)
    AND audit."organizationId" = current_setting('app.current_org_id', true)
  ORDER BY audit."createdAt" DESC, audit."id" DESC
  LIMIT 1;

  computed_hash := encode(public.digest(convert_to(jsonb_build_object(
    'id', p_id,
    'tenantId', current_setting('app.current_tenant_id', true),
    'organizationId', current_setting('app.current_org_id', true),
    'authorizationId', p_authorization_id,
    'authorizationVersion', p_authorization_version::text,
    'configurationId', p_configuration_id,
    'actorUserId', current_setting('app.current_user_id', true),
    'actorRole', current_setting('app.current_role', true),
    'operationCode', p_operation_code,
    'correlationId', p_correlation_id,
    'idempotencyKey', p_idempotency_key,
    'requestIdempotencyKey', p_request_idempotency_key,
    'requestReference', p_request_reference,
    'requestSha256', p_request_sha256,
    'decision', p_decision,
    'reasonCode', p_reason_code,
    'providerRequestId', p_provider_request_id,
    'responseReference', p_response_reference,
    'responseSha256', p_response_sha256,
    'receivedAt', CASE
      WHEN p_received_at IS NULL THEN NULL
      ELSE to_char(
        p_received_at AT TIME ZONE 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
      )
    END,
    'prevHash', current_head
  )::text, 'UTF8'), 'sha256'), 'hex');

  INSERT INTO public."fgis_grain_tenant_read_audits" (
    "id", "tenantId", "organizationId", "authorizationId",
    "authorizationVersion", "configurationId", "actorUserId", "actorRole",
    "operationCode", "correlationId", "idempotencyKey",
    "requestIdempotencyKey", "requestReference", "requestSha256", "decision",
    "reasonCode", "providerRequestId", "responseReference", "responseSha256",
    "receivedAt", "hash", "prevHash"
  ) VALUES (
    p_id,
    current_setting('app.current_tenant_id', true),
    current_setting('app.current_org_id', true),
    p_authorization_id,
    p_authorization_version,
    p_configuration_id,
    current_setting('app.current_user_id', true),
    current_setting('app.current_role', true),
    p_operation_code,
    p_correlation_id,
    p_idempotency_key,
    p_request_idempotency_key,
    p_request_reference,
    p_request_sha256,
    p_decision,
    p_reason_code,
    p_provider_request_id,
    p_response_reference,
    p_response_sha256,
    p_received_at,
    computed_hash,
    current_head
  );
  RETURN p_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reject_fgis_grain_tenant_read_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  RAISE EXCEPTION 'FGIS Grain tenant-read audits are immutable'
    USING ERRCODE = '55000';
END;
$function$;

CREATE TRIGGER "fgis_grain_tenant_read_audits_no_update"
BEFORE UPDATE ON public."fgis_grain_tenant_read_audits"
FOR EACH ROW EXECUTE FUNCTION public.reject_fgis_grain_tenant_read_audit_mutation();

CREATE TRIGGER "fgis_grain_tenant_read_audits_no_delete"
BEFORE DELETE ON public."fgis_grain_tenant_read_audits"
FOR EACH ROW EXECUTE FUNCTION public.reject_fgis_grain_tenant_read_audit_mutation();

ALTER TABLE public."fgis_grain_tenant_read_authorizations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."fgis_grain_tenant_read_authorizations" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."fgis_grain_tenant_read_audits" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."fgis_grain_tenant_read_audits" FORCE ROW LEVEL SECURITY;

CREATE POLICY "fgis_grain_tenant_read_auth_select_policy"
ON public."fgis_grain_tenant_read_authorizations"
FOR SELECT
USING (
  public.fgis_grain_tenant_read_context_ready(false)
  AND "tenantId" = current_setting('app.current_tenant_id', true)
  AND "organizationId" = current_setting('app.current_org_id', true)
  AND current_setting('app.current_role', true) IN (
    'FARMER', 'BUYER', 'LOGISTICIAN', 'ELEVATOR', 'LAB', 'ACCOUNTING',
    'EXECUTIVE', 'ADMIN', 'COMPLIANCE_OFFICER', 'SUPPORT_MANAGER'
  )
);

CREATE POLICY "fgis_grain_tenant_read_auth_insert_policy"
ON public."fgis_grain_tenant_read_authorizations"
FOR INSERT
WITH CHECK (
  public.fgis_grain_tenant_read_context_ready(true)
  AND "tenantId" = current_setting('app.current_tenant_id', true)
  AND "organizationId" = current_setting('app.current_org_id', true)
  AND current_setting('app.current_role', true) IN ('EXECUTIVE', 'ADMIN', 'COMPLIANCE_OFFICER')
);

CREATE POLICY "fgis_grain_tenant_read_auth_update_policy"
ON public."fgis_grain_tenant_read_authorizations"
FOR UPDATE
USING (
  public.fgis_grain_tenant_read_context_ready(true)
  AND "tenantId" = current_setting('app.current_tenant_id', true)
  AND "organizationId" = current_setting('app.current_org_id', true)
  AND current_setting('app.current_role', true) IN ('EXECUTIVE', 'ADMIN', 'COMPLIANCE_OFFICER')
)
WITH CHECK (
  public.fgis_grain_tenant_read_context_ready(true)
  AND "tenantId" = current_setting('app.current_tenant_id', true)
  AND "organizationId" = current_setting('app.current_org_id', true)
  AND current_setting('app.current_role', true) IN ('EXECUTIVE', 'ADMIN', 'COMPLIANCE_OFFICER')
);

CREATE POLICY "fgis_grain_tenant_read_audit_select_policy"
ON public."fgis_grain_tenant_read_audits"
FOR SELECT
USING (
  public.fgis_grain_tenant_read_context_ready(false)
  AND "tenantId" = current_setting('app.current_tenant_id', true)
  AND "organizationId" = current_setting('app.current_org_id', true)
  AND current_setting('app.current_role', true) IN (
    'FARMER', 'BUYER', 'LOGISTICIAN', 'ELEVATOR', 'LAB', 'ACCOUNTING',
    'EXECUTIVE', 'ADMIN', 'COMPLIANCE_OFFICER', 'SUPPORT_MANAGER'
  )
);

CREATE POLICY "fgis_grain_tenant_read_audit_insert_policy"
ON public."fgis_grain_tenant_read_audits"
FOR INSERT
WITH CHECK (
  public.fgis_grain_tenant_read_context_ready(false)
  AND "tenantId" = current_setting('app.current_tenant_id', true)
  AND "organizationId" = current_setting('app.current_org_id', true)
  AND current_setting('app.current_role', true) IN (
    'FARMER', 'BUYER', 'LOGISTICIAN', 'ELEVATOR', 'LAB', 'ACCOUNTING',
    'EXECUTIVE', 'ADMIN', 'COMPLIANCE_OFFICER', 'SUPPORT_MANAGER'
  )
);

REVOKE ALL ON TABLE public."fgis_grain_tenant_read_authorizations" FROM PUBLIC;
REVOKE ALL ON TABLE public."fgis_grain_tenant_read_audits" FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fgis_grain_tenant_read_context_ready(boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fgis_grain_tenant_read_provider_authority_valid(text, bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.write_fgis_grain_tenant_read_authorization(
  text, text, bigint, text[], text, timestamptz, text, bigint
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.attest_fgis_grain_tenant_read_authorization(
  text, bigint, text, timestamptz, text
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.append_fgis_grain_tenant_read_audit(
  text, text, bigint, text, text, text, text, text, text, text,
  text, text, text, text, text, timestamptz
) FROM PUBLIC;

DO $grants$
DECLARE
  runtime_role text;
BEGIN
  FOREACH runtime_role IN ARRAY ARRAY['app_runtime', 'app_service']
  LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = runtime_role) THEN
      EXECUTE format(
        'GRANT SELECT ON TABLE public."fgis_grain_tenant_read_authorizations" TO %I',
        runtime_role
      );
      EXECUTE format(
        'GRANT SELECT ON TABLE public."fgis_grain_tenant_read_audits" TO %I',
        runtime_role
      );
      EXECUTE format(
        'GRANT SELECT ON TABLE public."fgis_grain_provider_configurations", public."fgis_grain_provider_attestations" TO %I',
        runtime_role
      );
      EXECUTE format(
        'GRANT EXECUTE ON FUNCTION public.fgis_grain_tenant_read_context_ready(boolean) TO %I',
        runtime_role
      );
      EXECUTE format(
        'GRANT EXECUTE ON FUNCTION public.fgis_grain_tenant_read_provider_authority_valid(text, bigint) TO %I',
        runtime_role
      );
      EXECUTE format(
        'GRANT EXECUTE ON FUNCTION public.write_fgis_grain_tenant_read_authorization(text, text, bigint, text[], text, timestamptz, text, bigint) TO %I',
        runtime_role
      );
      EXECUTE format(
        'GRANT EXECUTE ON FUNCTION public.attest_fgis_grain_tenant_read_authorization(text, bigint, text, timestamptz, text) TO %I',
        runtime_role
      );
      EXECUTE format(
        'GRANT EXECUTE ON FUNCTION public.append_fgis_grain_tenant_read_audit(text, text, bigint, text, text, text, text, text, text, text, text, text, text, text, text, timestamptz) TO %I',
        runtime_role
      );
    END IF;
  END LOOP;
END;
$grants$;
